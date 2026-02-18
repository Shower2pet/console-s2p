import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FISKALY_API_VERSION = "2025-08-12";

function jsonErr(msg: string, extras: Record<string, unknown> = {}, status = 502) {
  return new Response(JSON.stringify({ error: msg, ...extras }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getToken(baseUrl: string, key: string, secret: string, scopeId?: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
    "X-Idempotency-Key": crypto.randomUUID(),
  };
  if (scopeId) headers["X-Scope-Identifier"] = scopeId;
  const res = await fetch(`${baseUrl}/tokens`, { method: "POST", headers, body: JSON.stringify({ content: { type: "API_KEY", key, secret } }) });
  if (!res.ok) throw new Error(`Fiskaly auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer received");
  return bearer;
}

async function fCall(method: string, url: string, bearer: string, body?: unknown, scopeId?: string) {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
  };
  if (scopeId) headers["X-Scope-Identifier"] = scopeId;
  if (method === "POST" || method === "PATCH") headers["X-Idempotency-Key"] = crypto.randomUUID();
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ok */ }
  return { status: res.status, data, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { partner_id, force = false, entity_id: providedEntityId = null, system_id: providedSystemId = null } = await req.json();
    if (!partner_id) return jsonErr("partner_id è obbligatorio", {}, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: partner } = await supabase.from("profiles").select("*").eq("id", partner_id).maybeSingle();
    if (!partner) return jsonErr("Partner non trovato", {}, 404);

    // Shortcut: save manual system_id
    if (providedSystemId) {
      await supabase.from("profiles").update({ fiskaly_system_id: providedSystemId }).eq("id", partner_id);
      return jsonOk({ success: true, system_id: providedSystemId, message: "System ID salvato manualmente" });
    }

    if (partner.fiskaly_system_id && !force && !providedEntityId) {
      return jsonOk({ success: true, already_configured: true, system_id: partner.fiskaly_system_id, message: "Già configurato." });
    }

    const missing: string[] = [];
    if (!partner.legal_name?.trim())     missing.push("Ragione Sociale");
    if (!partner.vat_number?.trim())     missing.push("Partita IVA");
    if (!partner.address_street?.trim()) missing.push("Via/Indirizzo");
    if (!partner.zip_code?.trim())       missing.push("CAP");
    if (!partner.city?.trim())           missing.push("Città");
    if (!partner.province?.trim())       missing.push("Provincia");
    if (missing.length > 0) return jsonErr(`Dati mancanti: ${missing.join(", ")}`, { missing_fields: missing }, 422);

    const MASTER_KEY = Deno.env.get("FISKALY_API_KEY")!;
    const MASTER_SECRET = Deno.env.get("FISKALY_API_SECRET")!;
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();
    if (!MASTER_KEY || !MASTER_SECRET) return jsonErr("Credenziali Fiskaly non configurate", {}, 500);
    const BASE = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";

    // ── STEP 0: TENANT token ──────────────────────────────────────────────────
    console.log("Step 0: Tenant auth...");
    const tenantBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET);
    console.log("Step 0: OK");

    // ── STEP 1: UNIT asset (idempotent — saved in DB) ─────────────────────────
    let unitAssetId: string | null = (partner as any).fiskaly_unit_id ?? null;
    if (!unitAssetId || force) {
      console.log("Step 1: Creating UNIT asset...");
      const r = await fCall("POST", `${BASE}/assets`, tenantBearer, { content: { type: "UNIT", name: partner.legal_name.trim() } });
      console.log(`Step 1: ${r.status}`);
      if (r.status === 200 || r.status === 201) unitAssetId = r.data?.content?.id ?? null;
      else if (r.status === 409) unitAssetId = r.data?.content?.id ?? null;
      else if (r.status !== 405) return jsonErr(`Errore UNIT asset (${r.status})`, { details: r.data?.content?.message ?? r.text });
      if (unitAssetId) {
        await supabase.from("profiles").update({ fiskaly_unit_id: unitAssetId }).eq("id", partner_id);
        console.log("Step 1: unit_id saved:", unitAssetId);
      }
    } else {
      console.log("Step 1: Using existing unit_id:", unitAssetId);
    }

    // ── STEP 1b: UNIT-scoped bearer via Subject (API Key scoped to UNIT) ──────
    // The entity must be created with a token belonging to a Subject scoped to the UNIT.
    // The master API key belongs to TENANT, so we create a Subject scoped to UNIT.
    let unitBearer = tenantBearer;
    if (unitAssetId) {
      console.log("Step 1b: Creating UNIT-scoped Subject...");
      const sr = await fCall("POST", `${BASE}/subjects`, tenantBearer,
        { content: { type: "API_KEY", name: `p-${partner_id.slice(0, 8)}` } }, unitAssetId);
      console.log(`Step 1b: Subject → ${sr.status}`);
      if (sr.status === 200 || sr.status === 201) {
        const k = sr.data?.content?.credentials?.key;
        const s = sr.data?.content?.credentials?.secret;
        if (k && s) { unitBearer = await getToken(BASE, k, s); console.log("Step 1b: UNIT token OK"); }
      } else if (sr.status === 409 || sr.status === 405 || sr.status === 501) {
        try { unitBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET, unitAssetId); } catch { /* use tenant */ }
      }
    }

    // ── STEP 2: Entity (use UNIT-scoped bearer) ───────────────────────────────
    let entityId: string | null = providedEntityId ?? (partner as any).fiskaly_entity_id ?? null;
    if (!entityId || force) {
      console.log("Step 2: Creating entity...");
      const entityBody = {
        content: {
          type: "COMPANY",
          name: { legal: partner.legal_name.trim(), trade: partner.legal_name.trim() },
          address: { line: { type: "STREET_NUMBER", street: partner.address_street.trim(), number: partner.address_number?.trim() || "SNC" }, code: partner.zip_code.trim(), city: partner.city.trim(), country: "IT" },
        },
        metadata: { partner_id, vat_number: partner.vat_number?.trim() ?? "" },
      };
      const er = await fCall("POST", `${BASE}/entities`, unitBearer, entityBody, unitAssetId ?? undefined);
      console.log(`Step 2: Entity → ${er.status}`, er.text.slice(0, 300));
      if (er.status === 200 || er.status === 201) {
        entityId = er.data?.content?.id ?? null;
        console.log("Step 2: Entity created:", entityId);
      } else if (er.status === 409) {
        entityId = er.data?.content?.id ?? null;
        if (!entityId) {
          const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer, undefined, unitAssetId ?? undefined);
          const found = (lr.data?.results ?? []).find((e: any) => e.metadata?.partner_id === partner_id);
          entityId = found?.content?.id ?? lr.data?.results?.[0]?.content?.id ?? null;
        }
        if (!entityId) return jsonErr("Entity conflict: ID non trovato. Usa 'Configura da Entity esistente'.");
      } else if (er.status === 405) {
        return jsonErr("Fiskaly: impossibile creare Entity", { details: er.data?.content?.message, unit_id: unitAssetId, hint: "Vai su API Explorer → GET /entities, copia l'Entity ID e usalo nel campo 'Configura da Entity esistente'." }, 409);
      } else {
        return jsonErr(`Errore entity (${er.status})`, { details: er.data?.content?.message ?? er.text });
      }
      if (!entityId) return jsonErr("Entity ID non ricevuto");
      await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
    } else {
      console.log("Step 2: Using existing entity_id:", entityId);
    }

    // ── STEP 3: Commission (ACQUIRED → COMMISSIONED) ─────────────────────────
    // Must use unitBearer since the entity belongs to the UNIT scope
    console.log("Step 3: Commissioning entity", entityId);
    const cr = await fCall("PATCH", `${BASE}/entities/${entityId}`, unitBearer, { content: { state: "COMMISSIONED" } }, unitAssetId ?? undefined);
    console.log(`Step 3: Commission → ${cr.status}`);
    if (!cr.status.toString().startsWith("2")) {
      const code = cr.data?.content?.code ?? "";
      const alreadyDone = code === "E_CONFLICT" || code === "E_INVALID_STATE_TRANSITION" || (cr.data?.content?.message ?? "").toLowerCase().includes("already");
      if (!alreadyDone) return jsonErr(`Errore commissioning (${cr.status})`, { details: cr.data?.content?.message, code });
      console.log("Step 3: Already commissioned — OK");
    }

    // ── STEP 4: System ────────────────────────────────────────────────────────
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({ success: true, system_id: partner.fiskaly_system_id, entity_id: entityId, message: "Configurazione già presente" });
    }
    console.log("Step 4: Creating system for entity", entityId);
    const syr = await fCall("POST", `${BASE}/systems`, tenantBearer, {
      content: { type: "FISCAL_DEVICE", entity: { id: entityId }, software: { name: "Shower2Pet", version: "1.0" }, producer: { number: "S2P-CLOUD-001" } },
      metadata: { partner_id },
    });
    console.log(`Step 4: System → ${syr.status}`);
    let systemId: string | null = null;
    if (syr.status === 200 || syr.status === 201) {
      systemId = syr.data?.content?.id ?? null;
    } else if (syr.status === 409) {
      systemId = syr.data?.content?.id ?? null;
      if (!systemId) {
        const slr = await fCall("GET", `${BASE}/systems?limit=100`, tenantBearer);
        const found = (slr.data?.results ?? []).find((s: any) => s.content?.entity?.id === entityId || s.metadata?.partner_id === partner_id);
        systemId = found?.content?.id ?? null;
      }
      if (!systemId) return jsonErr("System conflict: ID non trovato. Usa 'Salva System ID manuale'.", { entity_id: entityId });
    } else {
      return jsonErr(`Errore system (${syr.status})`, { details: syr.data?.content?.message ?? syr.text, entity_id: entityId });
    }
    if (!systemId) return jsonErr("System ID non ricevuto");

    await supabase.from("profiles").update({ fiskaly_system_id: systemId, fiskaly_entity_id: entityId }).eq("id", partner_id);
    console.log("✅ Done → system_id:", systemId);
    return jsonOk({ success: true, system_id: systemId, entity_id: entityId, unit_id: unitAssetId, message: "Configurazione Fiskaly completata con successo ✓" });

  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return jsonErr(err.message ?? "Errore interno", {}, 500);
  }
});
