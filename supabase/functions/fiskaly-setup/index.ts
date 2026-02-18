import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FISKALY_API_VERSION = "2025-08-12";

function jsonErr(msg: string, extras: Record<string, unknown> = {}, status = 502) {
  return new Response(JSON.stringify({ error: msg, ...extras }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Get a Fiskaly JWT bearer using the provided API key credentials. */
async function getToken(baseUrl: string, key: string, secret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ content: { type: "API_KEY", key, secret } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fiskaly auth failed (${res.status}): ${t}`);
  }
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer received from Fiskaly");
  return bearer;
}

/** Generic Fiskaly API call. scopeId adds X-Scope-Identifier header. */
async function fCall(
  method: string,
  url: string,
  bearer: string,
  body?: unknown,
  scopeId?: string | null,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
  };
  if (scopeId) headers["X-Scope-Identifier"] = scopeId;
  if (method === "POST" || method === "PATCH") {
    headers["X-Idempotency-Key"] = crypto.randomUUID();
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ok */ }
  return { status: res.status, data, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      partner_id,
      force = false,
      system_id: providedSystemId = null,
    } = await req.json();

    if (!partner_id) return jsonErr("partner_id è obbligatorio", {}, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: partner } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partner_id)
      .maybeSingle();
    if (!partner) return jsonErr("Partner non trovato", {}, 404);

    // Shortcut: save a manually-provided system_id
    if (providedSystemId) {
      await supabase
        .from("profiles")
        .update({ fiskaly_system_id: providedSystemId })
        .eq("id", partner_id);
      return jsonOk({ success: true, system_id: providedSystemId, message: "System ID salvato manualmente" });
    }

    // Already fully configured?
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        already_configured: true,
        system_id: partner.fiskaly_system_id,
        message: "Già configurato.",
      });
    }

    // Validate required fiscal fields
    const missing: string[] = [];
    if (!partner.legal_name?.trim())     missing.push("Ragione Sociale");
    if (!partner.vat_number?.trim())     missing.push("Partita IVA");
    if (!partner.address_street?.trim()) missing.push("Via/Indirizzo");
    if (!partner.zip_code?.trim())       missing.push("CAP");
    if (!partner.city?.trim())           missing.push("Città");
    if (!partner.province?.trim())       missing.push("Provincia");
    if (missing.length > 0) {
      return jsonErr(`Dati mancanti: ${missing.join(", ")}`, { missing_fields: missing }, 422);
    }

    const MASTER_KEY    = Deno.env.get("FISKALY_API_KEY")!;
    const MASTER_SECRET = Deno.env.get("FISKALY_API_SECRET")!;
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();
    if (!MASTER_KEY || !MASTER_SECRET) {
      return jsonErr("Credenziali Fiskaly non configurate", {}, 500);
    }
    const BASE = ENV === "LIVE"
      ? "https://live.api.fiskaly.com"
      : "https://test.api.fiskaly.com";

    // ── STEP 0: Tenant (master) token ────────────────────────────────────────
    console.log("Step 0: tenant token...");
    const tenantBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET);
    console.log("Step 0: OK");

    // ── STEP 1: Find or create UNIT asset ────────────────────────────────────
    // Always try to reuse existing UNIT (idempotency).
    // On force=true we still look for an existing one rather than creating duplicates.
    let unitAssetId: string | null = (partner as any).fiskaly_unit_id ?? null;

    if (!unitAssetId || force) {
      console.log("Step 1: searching existing UNIT assets for this partner...");
      const listR = await fCall("GET", `${BASE}/assets?limit=100`, tenantBearer);
      const existingUnit = (listR.data?.results ?? []).find(
        (a: any) =>
          a.content?.type === "UNIT" &&
          a.content?.state !== "DISABLED" &&
          a.metadata?.partner_id === partner_id,
      );
      if (existingUnit) {
        unitAssetId = existingUnit.content?.id ?? null;
        console.log("Step 1: reusing existing UNIT:", unitAssetId);
        await supabase.from("profiles").update({ fiskaly_unit_id: unitAssetId }).eq("id", partner_id);
      }
    }

    if (!unitAssetId) {
      console.log("Step 1: creating new UNIT asset...");
      const r = await fCall("POST", `${BASE}/assets`, tenantBearer, {
        content: { type: "UNIT", name: partner.legal_name.trim() },
        metadata: { partner_id },
      });
      console.log(`Step 1: UNIT → ${r.status}`, r.text.slice(0, 100));
      if (r.status === 200 || r.status === 201) {
        unitAssetId = r.data?.content?.id ?? null;
      } else if (r.status === 409) {
        unitAssetId = r.data?.content?.id ?? null;
      }
      if (!unitAssetId) {
        return jsonErr(`Errore creazione UNIT (${r.status})`, { details: r.data?.content?.message ?? r.text });
      }
      await supabase.from("profiles").update({ fiskaly_unit_id: unitAssetId }).eq("id", partner_id);
      console.log("Step 1: UNIT created:", unitAssetId);
    }

    // ── STEP 2: Create Subject (API Key) scoped to UNIT ──────────────────────
    // Use a unique name per partner so we can track it.
    // If the subject already exists (409 or 500 from Fiskaly bug), use fallback scope token.
    console.log("Step 2: creating Subject scoped to UNIT...");
    // Use a short stable name; if it conflicts Fiskaly returns 409 or 500
    const subjectName = `p-${partner_id.slice(0, 8)}`;
    const sr = await fCall(
      "POST",
      `${BASE}/subjects`,
      tenantBearer,
      { content: { type: "API_KEY", name: subjectName } },
      unitAssetId, // X-Scope-Identifier → links Subject to this UNIT
    );
    console.log(`Step 2: Subject → ${sr.status}`, sr.text.slice(0, 200));

    let subjectKey: string | null = sr.data?.content?.credentials?.key ?? null;
    let subjectSecret: string | null = sr.data?.content?.credentials?.secret ?? null;

    if ((sr.status === 200 || sr.status === 201) && subjectKey && subjectSecret) {
      console.log("Step 2: Subject credentials obtained ✓");
    } else {
      // Subject conflict (409) or Fiskaly internal error (500) when name is already taken.
      // Try with a randomized name to force a fresh Subject.
      console.log(`Step 2: Subject failed (${sr.status}), retrying with unique name...`);
      const uniqueName = `p-${partner_id.slice(0, 8)}-${Date.now().toString(36)}`;
      const sr2 = await fCall(
        "POST",
        `${BASE}/subjects`,
        tenantBearer,
        { content: { type: "API_KEY", name: uniqueName } },
        unitAssetId,
      );
      console.log(`Step 2 retry: Subject → ${sr2.status}`, sr2.text.slice(0, 200));
      if ((sr2.status === 200 || sr2.status === 201)) {
        subjectKey    = sr2.data?.content?.credentials?.key    ?? null;
        subjectSecret = sr2.data?.content?.credentials?.secret ?? null;
        console.log("Step 2: Subject credentials obtained on retry ✓", subjectKey ? "YES" : "NO");
      } else {
        console.log("Step 2: Subject creation failed on retry too — will use fallback");
      }
    }

    // ── STEP 3: Obtain UNIT-scoped bearer ────────────────────────────────────
    // Per Fiskaly docs: use Subject credentials with POST /tokens to get a UNIT-scoped token.
    // This token MUST be used for entity creation, commissioning, and system operations.
    let unitBearer = tenantBearer;

    if (subjectKey && subjectSecret) {
      try {
        console.log("Step 3: getting UNIT-scoped token via Subject credentials...");
        unitBearer = await getToken(BASE, subjectKey, subjectSecret);
        console.log("Step 3: UNIT-scoped token obtained ✓");
      } catch (e) {
        console.log("Step 3: Subject token failed:", (e as Error).message);
        // Fallback: master token with X-Scope-Identifier header on the token endpoint
        try {
          console.log("Step 3: fallback — master key + X-Scope-Identifier on /tokens...");
          const scopedRes = await fetch(`${BASE}/tokens`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Version": FISKALY_API_VERSION,
              "X-Idempotency-Key": crypto.randomUUID(),
              "X-Scope-Identifier": unitAssetId,
            },
            body: JSON.stringify({ content: { type: "API_KEY", key: MASTER_KEY, secret: MASTER_SECRET } }),
          });
          if (scopedRes.ok) {
            const td = await scopedRes.json();
            const scoped = td?.content?.authentication?.bearer;
            if (scoped) { unitBearer = scoped; console.log("Step 3: fallback scoped token OK ✓"); }
          }
        } catch { /* ignore */ }
      }
    } else {
      // No Subject credentials — try master + X-Scope-Identifier on /tokens endpoint
      try {
        console.log("Step 3: no Subject creds — trying master + X-Scope-Identifier on /tokens...");
        const scopedRes = await fetch(`${BASE}/tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Version": FISKALY_API_VERSION,
            "X-Idempotency-Key": crypto.randomUUID(),
            "X-Scope-Identifier": unitAssetId,
          },
          body: JSON.stringify({ content: { type: "API_KEY", key: MASTER_KEY, secret: MASTER_SECRET } }),
        });
        if (scopedRes.ok) {
          const td = await scopedRes.json();
          const scoped = td?.content?.authentication?.bearer;
          if (scoped) { unitBearer = scoped; console.log("Step 3: scoped token via master OK ✓"); }
          else { console.log("Step 3: no bearer in scoped token response"); }
        } else {
          const t = await scopedRes.text();
          console.log("Step 3: scoped token via master failed:", scopedRes.status, t.slice(0, 200));
        }
      } catch (e) {
        console.log("Step 3: scoped token attempt failed:", (e as Error).message);
      }
    }

    // ── STEP 4: Create Entity (COMPANY) ──────────────────────────────────────
    // Entity MUST be created using a UNIT-scoped token.
    // No X-Scope-Identifier needed here — the scope is embedded in the token.
    let entityId: string | null = force ? null : ((partner as any).fiskaly_entity_id ?? null);

    if (!entityId) {
      console.log("Step 4: creating Entity with UNIT-scoped token...");
      const entityBody = {
        content: {
          type: "COMPANY",
          name: {
            legal: partner.legal_name.trim(),
            trade: partner.legal_name.trim(),
          },
          address: {
            line: {
              type: "STREET_NUMBER",
              street: partner.address_street.trim(),
              number: partner.address_number?.trim() || "SNC",
            },
            code: partner.zip_code.trim(),
            city: partner.city.trim(),
            country: "IT",
          },
        },
        metadata: { partner_id, vat_number: partner.vat_number?.trim() ?? "" },
      };
      // No scopeId here — scope is in the token itself
      const er = await fCall("POST", `${BASE}/entities`, unitBearer, entityBody, null);
      console.log(`Step 4: Entity → ${er.status}`, er.text.slice(0, 300));

      if (er.status === 200 || er.status === 201) {
        entityId = er.data?.content?.id ?? null;
        console.log("Step 4: Entity created:", entityId);
      } else if (er.status === 409) {
        entityId = er.data?.content?.id ?? null;
        if (!entityId) {
          // List entities visible to this unit-scoped token
          const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer, undefined, null);
          const found = (lr.data?.results ?? []).find(
            (e: any) => e.metadata?.partner_id === partner_id,
          );
          entityId = found?.content?.id ?? null;
        }
        if (!entityId) {
          return jsonErr("Entity conflict (409): ID non trovato. Usa 'Salva System ID manuale' o riprova con force=true.");
        }
        console.log("Step 4: Entity conflict — using existing:", entityId);
      } else {
        return jsonErr(`Errore entity (${er.status})`, {
          details: er.data?.content?.message ?? er.text,
          hint: er.status === 405
            ? "Errore 405: il token non è scoped alla UNIT corretta. Il Subject non ha funzionato. Premi Riconfigura (force)."
            : undefined,
        });
      }

      if (!entityId) return jsonErr("Entity ID non ricevuto");
      await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
    } else {
      console.log("Step 4: using existing entity_id:", entityId);
    }

    // ── STEP 5: Commission Entity (ACQUIRED → COMMISSIONED) ──────────────────
    // Must use the UNIT-scoped token (unitBearer), no extra scopeId header.
    console.log("Step 5: commissioning entity", entityId);
    const cr = await fCall(
      "PATCH",
      `${BASE}/entities/${entityId}`,
      unitBearer,
      { content: { state: "COMMISSIONED" } },
      null, // no X-Scope-Identifier — scope is in the token
    );
    console.log(`Step 5: Commission → ${cr.status}`, cr.text.slice(0, 200));
    if (!cr.status.toString().startsWith("2")) {
      const code = cr.data?.content?.code ?? "";
      const msg  = (cr.data?.content?.message ?? "").toLowerCase();
      const alreadyDone =
        code === "E_CONFLICT" ||
        code === "E_INVALID_STATE_TRANSITION" ||
        msg.includes("already") ||
        msg.includes("commissioned");
      if (!alreadyDone) {
        return jsonErr(`Errore commissioning entity (${cr.status})`, {
          details: cr.data?.content?.message,
          code,
          hint: cr.status === 405
            ? "Errore 405: l'entity appartiene a una UNIT diversa dal token. Premi Riconfigura (force) per ricreare tutto."
            : undefined,
        });
      }
      console.log("Step 5: already commissioned — OK");
    }

    // ── STEP 6: Create System (FISCAL_DEVICE) ────────────────────────────────
    if ((partner as any).fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        system_id: (partner as any).fiskaly_system_id,
        entity_id: entityId,
        message: "Configurazione già presente",
      });
    }

    console.log("Step 6: creating System for entity", entityId);
    // System creation uses the unit-scoped token (unitBearer) since it's an operational resource
    // producer: type="MPN", number=MPN code, details={name, brand, started_at} per Fiskaly 2025-08-12
    const systemStartedAt = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const syr = await fCall("POST", `${BASE}/systems`, unitBearer, {
      content: {
        type: "FISCAL_DEVICE",
        entity: { id: entityId },
        software: { name: "Shower2Pet", version: "1.0" },
        producer: {
          type: "MPN",
          number: "S2P-CLOUD-001",
          details: {
            name: "Shower2Pet Cloud POS",
            brand: "Shower2Pet",
            model: "S2P-1.0",
          },
        },
      },
      metadata: { partner_id },
    }, null);
    console.log(`Step 6: System → ${syr.status}`, syr.text.slice(0, 400));

    let systemId: string | null = null;
    if (syr.status === 200 || syr.status === 201) {
      systemId = syr.data?.content?.id ?? null;
    } else if (syr.status === 409) {
      systemId = syr.data?.content?.id ?? null;
      if (!systemId) {
        const slr = await fCall("GET", `${BASE}/systems?limit=100`, tenantBearer, undefined, null);
        const found = (slr.data?.results ?? []).find(
          (s: any) =>
            s.content?.entity?.id === entityId ||
            s.metadata?.partner_id === partner_id,
        );
        systemId = found?.content?.id ?? null;
      }
      if (!systemId) {
        return jsonErr("System conflict (409): ID non trovato. Usa 'Salva System ID manuale'.", {
          entity_id: entityId,
        });
      }
    } else {
      return jsonErr(`Errore system (${syr.status})`, {
        details: syr.data?.content?.message ?? syr.text,
        entity_id: entityId,
      });
    }
    if (!systemId) return jsonErr("System ID non ricevuto");

    // ── STEP 7: Commission System ─────────────────────────────────────────────
    console.log("Step 7: commissioning system", systemId);
    const scr = await fCall(
      "PATCH",
      `${BASE}/systems/${systemId}`,
      unitBearer, // use unit-scoped token for system commissioning too
      { content: { state: "COMMISSIONED" } },
      null,
    );
    console.log(`Step 7: System commission → ${scr.status}`, scr.text.slice(0, 200));
    if (!scr.status.toString().startsWith("2")) {
      const code = scr.data?.content?.code ?? "";
      const msg  = (scr.data?.content?.message ?? "").toLowerCase();
      const alreadyDone =
        code === "E_CONFLICT" ||
        code === "E_INVALID_STATE_TRANSITION" ||
        msg.includes("already") ||
        msg.includes("commissioned");
      if (!alreadyDone) {
        // Log but don't fail — system_id is valid even if commissioning has a transient error
        console.warn("Step 7: system commissioning issue:", scr.data?.content?.message);
      } else {
        console.log("Step 7: already commissioned — OK");
      }
    }

    await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId, fiskaly_entity_id: entityId })
      .eq("id", partner_id);

    console.log("✅ Done → system_id:", systemId);
    return jsonOk({
      success: true,
      system_id: systemId,
      entity_id: entityId,
      unit_id: unitAssetId,
      message: "Configurazione Fiskaly completata con successo ✓",
    });

  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return jsonErr(err.message ?? "Errore interno", {}, 500);
  }
});
