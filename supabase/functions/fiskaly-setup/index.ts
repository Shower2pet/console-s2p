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

/**
 * Ottieni un bearer token Fiskaly.
 * Se scopeId è fornito, aggiunge X-Scope-Identifier per ottenere un token scoped alla UNIT.
 */
async function getToken(baseUrl: string, key: string, secret: string, scopeId?: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
    "X-Idempotency-Key": crypto.randomUUID(),
  };
  if (scopeId) headers["X-Scope-Identifier"] = scopeId;

  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: { type: "API_KEY", key, secret } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fiskaly auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer received from Fiskaly");
  return bearer;
}

/** Chiamata generica all'API Fiskaly. */
async function fCall(
  method: string,
  url: string,
  bearer: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
  };
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

    // Shortcut: salva manualmente un system_id
    if (providedSystemId) {
      await supabase.from("profiles").update({ fiskaly_system_id: providedSystemId }).eq("id", partner_id);
      return jsonOk({ success: true, system_id: providedSystemId, message: "System ID salvato manualmente" });
    }

    // Già configurato e non si forza la riconfigurazione
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        already_configured: true,
        system_id: partner.fiskaly_system_id,
        message: "Già configurato.",
      });
    }

    // Validazione campi fiscali obbligatori
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
    if (!MASTER_KEY || !MASTER_SECRET) return jsonErr("Credenziali Fiskaly non configurate", {}, 500);

    const BASE = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";

    // ── STEP 0: Token master (tenant) ────────────────────────────────────────
    console.log("Step 0: tenant token...");
    const tenantBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET);
    console.log("Step 0: OK");

    // ── STEP 1: Trova o crea UNIT asset ──────────────────────────────────────
    // Cerca prima per partner_id nei metadata, poi per fiskaly_unit_id già salvato nel DB.
    let unitAssetId: string | null = partner.fiskaly_unit_id ?? null;

    if (!unitAssetId || force) {
      console.log("Step 1: ricerca UNIT esistente per partner...");
      const listR = await fCall("GET", `${BASE}/assets?limit=100`, tenantBearer);
      const existingUnit = (listR.data?.results ?? []).find(
        (a: any) => a.content?.type === "UNIT" && a.metadata?.partner_id === partner_id,
      );
      if (existingUnit) {
        unitAssetId = existingUnit.content?.id ?? null;
        console.log("Step 1: UNIT esistente trovata:", unitAssetId);
        await supabase.from("profiles").update({ fiskaly_unit_id: unitAssetId }).eq("id", partner_id);
      }
    }

    if (!unitAssetId) {
      console.log("Step 1: creazione nuova UNIT...");
      const r = await fCall("POST", `${BASE}/assets`, tenantBearer, {
        content: { type: "UNIT", name: partner.legal_name.trim() },
        metadata: { partner_id },
      });
      console.log(`Step 1: UNIT → ${r.status} ${r.text.slice(0, 200)}`);
      if (r.status === 200 || r.status === 201 || r.status === 409) {
        // La risposta POST /assets ha: content.asset.id (ID reale asset) e content.id (ID assegnazione)
        // Dobbiamo usare content.asset.id come scope identifier per il token scoped
        unitAssetId = r.data?.content?.asset?.id ?? r.data?.content?.id ?? null;
        console.log(`Step 1: asset.id=${r.data?.content?.asset?.id} content.id=${r.data?.content?.id} → uso=${unitAssetId}`);
      }
      if (!unitAssetId) return jsonErr(`Errore creazione UNIT (${r.status})`, { details: r.data?.content?.message ?? r.text.slice(0, 200) });
      await supabase.from("profiles").update({ fiskaly_unit_id: unitAssetId }).eq("id", partner_id);
      console.log("Step 1: UNIT pronta:", unitAssetId);
    }

    // ── STEP 2: Ottieni token scoped alla UNIT ────────────────────────────────
    // Strategia: usa direttamente master key + X-Scope-Identifier sull'endpoint /tokens.
    // Questo è il metodo più affidabile e non crea Subject duplicati.
    console.log("Step 2: token scoped alla UNIT...");
    let unitBearer: string;
    try {
      unitBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET, unitAssetId);
      console.log("Step 2: token scoped OK ✓");
    } catch (e) {
      console.warn("Step 2: token scoped fallito:", (e as Error).message, "— uso token master come fallback");
      unitBearer = tenantBearer;
    }

    // ── STEP 3: Trova o crea Entity ───────────────────────────────────────────
    let entityId: string | null = force ? null : (partner.fiskaly_entity_id ?? null);

    if (!entityId) {
      console.log("Step 3: creazione Entity con token scoped...");
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
      const er = await fCall("POST", `${BASE}/entities`, unitBearer, entityBody);
      console.log(`Step 3: Entity → ${er.status} ${er.text.slice(0, 300)}`);

      if (er.status === 200 || er.status === 201) {
        entityId = er.data?.content?.id ?? null;
        console.log("Step 3: Entity creata:", entityId);
      } else if (er.status === 409) {
        // Conflict: entity esiste già — cerca per partner_id nei metadata
        entityId = er.data?.content?.id ?? null;
        if (!entityId) {
          const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer);
          const found = (lr.data?.results ?? []).find(
            (e: any) => e.metadata?.partner_id === partner_id,
          );
          entityId = found?.content?.id ?? null;
        }
        if (!entityId) return jsonErr("Entity conflict (409): ID non trovato. Usa 'Azzera IDs Fiskaly nel DB' nel pannello admin e riprova.", { unit_id: unitAssetId });
        console.log("Step 3: Entity conflict — uso esistente:", entityId);
      } else if (er.status === 405) {
        // 405 = il token non è scoped correttamente alla UNIT
        return jsonErr(
          "Errore 405: il token non è scoped alla UNIT. Premi 'Azzera IDs Fiskaly nel DB' nel pannello admin e riconfigura.",
          { unit_id: unitAssetId, details: er.data?.content?.message },
        );
      } else {
        return jsonErr(`Errore entity (${er.status})`, { details: er.data?.content?.message ?? er.text.slice(0, 200) });
      }

      if (!entityId) return jsonErr("Entity ID non ricevuto da Fiskaly");
      await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
    } else {
      console.log("Step 3: uso entity_id esistente:", entityId);
    }

    // ── STEP 4: Commissioning Entity ─────────────────────────────────────────
    console.log("Step 4: commissioning entity", entityId);
    const cr = await fCall("PATCH", `${BASE}/entities/${entityId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    console.log(`Step 4: Commission → ${cr.status} ${cr.text.slice(0, 200)}`);
    if (!cr.status.toString().startsWith("2")) {
      const code = cr.data?.content?.code ?? "";
      const msg  = (cr.data?.content?.message ?? "").toLowerCase();
      const alreadyDone = code === "E_CONFLICT" || code === "E_INVALID_STATE_TRANSITION" || msg.includes("already") || msg.includes("commissioned");
      if (!alreadyDone) {
        return jsonErr(`Errore commissioning entity (${cr.status})`, {
          details: cr.data?.content?.message,
          hint: cr.status === 405 ? "Token non scoped. Azzera gli IDs nel DB e riconfigura." : undefined,
        });
      }
      console.log("Step 4: già commissionata — OK");
    }

    // ── STEP 5: Trova o crea System ───────────────────────────────────────────
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        system_id: partner.fiskaly_system_id,
        entity_id: entityId,
        message: "Configurazione già presente",
      });
    }

    console.log("Step 5: creazione System per entity", entityId);
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
    });
    console.log(`Step 5: System → ${syr.status} ${syr.text.slice(0, 400)}`);

    let systemId: string | null = null;
    if (syr.status === 200 || syr.status === 201) {
      systemId = syr.data?.content?.id ?? null;
    } else if (syr.status === 409) {
      systemId = syr.data?.content?.id ?? null;
      if (!systemId) {
        const slr = await fCall("GET", `${BASE}/systems?limit=100`, tenantBearer);
        const found = (slr.data?.results ?? []).find(
          (s: any) => s.content?.entity?.id === entityId || s.metadata?.partner_id === partner_id,
        );
        systemId = found?.content?.id ?? null;
      }
      if (!systemId) return jsonErr("System conflict (409): ID non trovato. Usa 'Salva System ID manuale' nell'admin.", { entity_id: entityId });
      console.log("Step 5: System conflict — uso esistente:", systemId);
    } else {
      return jsonErr(`Errore system (${syr.status})`, {
        details: syr.data?.content?.message ?? syr.text.slice(0, 200),
        entity_id: entityId,
      });
    }
    if (!systemId) return jsonErr("System ID non ricevuto da Fiskaly");

    // ── STEP 6: Commissioning System ─────────────────────────────────────────
    console.log("Step 6: commissioning system", systemId);
    const scr = await fCall("PATCH", `${BASE}/systems/${systemId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    console.log(`Step 6: System commission → ${scr.status} ${scr.text.slice(0, 200)}`);
    if (!scr.status.toString().startsWith("2")) {
      const code = scr.data?.content?.code ?? "";
      const msg  = (scr.data?.content?.message ?? "").toLowerCase();
      const alreadyDone = code === "E_CONFLICT" || code === "E_INVALID_STATE_TRANSITION" || msg.includes("already") || msg.includes("commissioned");
      if (!alreadyDone) {
        console.warn("Step 6: system commissioning warning:", scr.data?.content?.message, "— proseguo comunque");
      } else {
        console.log("Step 6: già commissionato — OK");
      }
    }

    // Salva sul DB
    await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId, fiskaly_entity_id: entityId, fiskaly_unit_id: unitAssetId })
      .eq("id", partner_id);

    console.log("✅ Completato → system_id:", systemId, "entity_id:", entityId, "unit_id:", unitAssetId);
    return jsonOk({
      success: true,
      system_id: systemId,
      entity_id: entityId,
      unit_id: unitAssetId,
      env: ENV,
      message: "Configurazione Fiskaly completata con successo ✓",
    });

  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return jsonErr(err.message ?? "Errore interno", {}, 500);
  }
});
