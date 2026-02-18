import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FISKALY_API_VERSION = "2025-08-12";

// ── Auth helper ────────────────────────────────────────────────────────────────
async function getFiskalyToken(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  scopeId?: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
    "X-Idempotency-Key": crypto.randomUUID(),
  };
  if (scopeId) headers["X-Scope-Identifier"] = scopeId;

  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: { type: "API_KEY", key: apiKey, secret: apiSecret },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fiskaly auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("Fiskaly: bearer token non ricevuto nella risposta");
  return bearer;
}

// ── JSON error ────────────────────────────────────────────────────────────────
function jsonErr(msg: string, extras: Record<string, unknown> = {}, status = 502) {
  return new Response(JSON.stringify({ error: msg, ...extras }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      partner_id,
      force = false,
      entity_id: providedEntityId = null,
      system_id: providedSystemId = null,
    } = await req.json();

    if (!partner_id) return jsonErr("partner_id è obbligatorio", {}, 400);

    // ── Supabase service role ─────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partner, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partner_id)
      .maybeSingle();

    if (profileError || !partner) return jsonErr("Partner non trovato", {}, 404);

    // ── SHORTCUT: salva system_id manuale ─────────────────────────────────────
    if (providedSystemId) {
      console.log("Shortcut: saving system_id:", providedSystemId);
      const { error } = await supabase
        .from("profiles")
        .update({ fiskaly_system_id: providedSystemId })
        .eq("id", partner_id);
      if (error) return jsonErr("Errore salvataggio System ID", { db_error: error.message }, 500);
      return jsonOk({ success: true, system_id: providedSystemId, message: "System ID salvato manualmente" });
    }

    // ── Già configurato (idempotente) ────────────────────────────────────────
    if (partner.fiskaly_system_id && !force && !providedEntityId) {
      return jsonOk({
        success: true,
        already_configured: true,
        system_id: partner.fiskaly_system_id,
        message: "Fiskaly già configurato. Usa force=true per riconfigurare.",
      });
    }

    // ── Validazione campi obbligatori ─────────────────────────────────────────
    const missing: string[] = [];
    if (!partner.legal_name?.trim())    missing.push("Ragione Sociale (legal_name)");
    if (!partner.vat_number?.trim())    missing.push("Partita IVA (vat_number)");
    if (!partner.address_street?.trim()) missing.push("Via/Indirizzo (address_street)");
    if (!partner.zip_code?.trim())      missing.push("CAP (zip_code)");
    if (!partner.city?.trim())          missing.push("Città (city)");
    if (!partner.province?.trim())      missing.push("Provincia (province)");
    if (missing.length > 0) {
      return jsonErr(
        `Dati obbligatori mancanti: ${missing.join(", ")}`,
        { missing_fields: missing },
        422
      );
    }

    // ── Credenziali Fiskaly ───────────────────────────────────────────────────
    const API_KEY    = Deno.env.get("FISKALY_API_KEY");
    const API_SECRET = Deno.env.get("FISKALY_API_SECRET");
    const ENV        = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    if (!API_KEY || !API_SECRET) return jsonErr("Credenziali Fiskaly non configurate", {}, 500);

    const BASE_URL = ENV === "LIVE"
      ? "https://live.api.fiskaly.com"
      : "https://test.api.fiskaly.com";

    // ── Step 0: Autenticazione (token TENANT-level) ──────────────────────────
    console.log("Step 0: Authenticating with Fiskaly...");
    const tenantBearer = await getFiskalyToken(BASE_URL, API_KEY, API_SECRET);
    console.log("Step 0: Auth OK");

    const baseHeaders = {
      "Authorization": `Bearer ${tenantBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    let entityId: string | null = providedEntityId;

    if (!entityId) {
      // ── Step 1: Crea asset UNIT per il partner ──────────────────────────────
      // La struttura Fiskaly è: TENANT (account root) → UNIT (merchant) → Entity
      // Dobbiamo creare un UNIT per ogni partner prima di creare la sua Entity.
      // Usiamo il partner_id come metadata per idempotenza.
      const unitName = partner.legal_name.trim();
      console.log(`Step 1: Creating UNIT asset for "${unitName}"...`);

      const assetRes = await fetch(`${BASE_URL}/assets`, {
        method: "POST",
        headers: { ...baseHeaders, "X-Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          content: { type: "UNIT", name: unitName },
          metadata: { partner_id, vat_number: partner.vat_number?.trim() ?? "" },
        }),
      });

      const assetText = await assetRes.text();
      console.log(`Asset response: ${assetRes.status} ${assetText}`);

      let unitAssetId: string | null = null;

      if (assetRes.status === 200 || assetRes.status === 201) {
        const assetData = JSON.parse(assetText);
        unitAssetId = assetData?.content?.id ?? null;
        console.log("UNIT asset created:", unitAssetId);
      } else if (assetRes.status === 405) {
        // 405 su POST /assets = account TENANT non supporta creazione UNIT via API
        // (profilo Fiskaly in modalità single-tenant)
        // Proviamo comunque a creare l'entity senza scope (usa TENANT di default)
        console.warn("POST /assets returned 405 — proceeding without explicit UNIT scope");
        unitAssetId = null;
      } else if (assetRes.status === 409) {
        // Asset già esistente — estraiamo l'id dalla risposta se presente
        try {
          const conflict = JSON.parse(assetText);
          unitAssetId = conflict?.content?.id ?? null;
          console.log("UNIT asset already exists:", unitAssetId);
        } catch { /* ignore */ }
      } else {
        let parsed: any = null;
        try { parsed = JSON.parse(assetText); } catch { /* ignore */ }
        return jsonErr(
          `Fiskaly: errore creazione asset UNIT (${assetRes.status})`,
          { details: parsed?.content?.message ?? assetText }
        );
      }

      // ── Step 2: Crea Entity sotto l'asset UNIT ─────────────────────────────
      // Se abbiamo un UNIT, otteniamo un token scoped al UNIT per la creazione entity.
      // Il token UNIT-scoped permette di creare entity nel contesto corretto.
      let entityBearerToken = tenantBearer;
      if (unitAssetId) {
        try {
          console.log("Getting UNIT-scoped token for entity creation...");
          entityBearerToken = await getFiskalyToken(BASE_URL, API_KEY, API_SECRET, unitAssetId);
          console.log("UNIT-scoped token obtained");
        } catch (e) {
          console.warn("Failed to get UNIT-scoped token, using tenant token:", e);
        }
      }

      const entityHeaders: Record<string, string> = {
        "Authorization": `Bearer ${entityBearerToken}`,
        "Content-Type": "application/json",
        "X-Api-Version": FISKALY_API_VERSION,
        "X-Idempotency-Key": crypto.randomUUID(),
      };

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
        metadata: { partner_id },
      };

      console.log("Step 2: Creating entity...", JSON.stringify({ ...entityBody, unit_asset_id: unitAssetId }));
      const entityRes = await fetch(`${BASE_URL}/entities`, {
        method: "POST",
        headers: entityHeaders,
        body: JSON.stringify(entityBody),
      });

      const entityText = await entityRes.text();
      console.log(`Entity response: ${entityRes.status} ${entityText}`);

      if (entityRes.status === 200 || entityRes.status === 201) {
        const entityData = JSON.parse(entityText);
        entityId = entityData?.content?.id ?? null;
        console.log("Entity created:", entityId);
      } else if (entityRes.status === 405) {
        // Ancora bloccato — l'account non supporta la struttura richiesta
        let parsed: any = null;
        try { parsed = JSON.parse(entityText); } catch { /* ignore */ }
        return jsonErr(
          "Fiskaly: impossibile creare Entity — account non configurato correttamente",
          {
            details: parsed?.content?.message ?? entityText,
            code: parsed?.content?.code,
            hint: "Verifica che il tuo account Fiskaly supporti la creazione di Entity via API. " +
                  "Potrebbe essere necessario contattare il supporto Fiskaly per abilitare questa funzionalità " +
                  "o usare il portale Fiskaly Dashboard per creare manualmente l'Entity, poi inserire l'Entity ID qui.",
          },
          409
        );
      } else {
        let parsed: any = null;
        try { parsed = JSON.parse(entityText); } catch { /* ignore */ }
        return jsonErr(
          `Fiskaly: errore creazione entity (${entityRes.status})`,
          { details: parsed?.content?.message ?? entityText, code: parsed?.content?.code }
        );
      }

      if (!entityId) return jsonErr("Fiskaly: entity ID non ricevuto dopo la creazione");
    } else {
      console.log("Step 2: Skipped — using provided entity_id:", entityId);
    }

    // ── Step 3: PATCH /entities/:id → COMMISSIONED ───────────────────────────
    console.log("Step 3: Commissioning entity", entityId);
    const commRes = await fetch(`${BASE_URL}/entities/${entityId}`, {
      method: "PATCH",
      headers: { ...baseHeaders, "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ content: { state: "COMMISSIONED" } }),
    });

    const commText = await commRes.text();
    console.log(`Commission response: ${commRes.status} ${commText}`);

    if (!commRes.ok) {
      let parsed: any = null;
      try { parsed = JSON.parse(commText); } catch { /* ignore */ }
      const msg = parsed?.content?.message ?? commText;
      // Se già COMMISSIONED va bene
      const alreadyDone = msg?.toLowerCase().includes("already") ||
                          parsed?.content?.code === "E_CONFLICT" ||
                          parsed?.content?.code === "E_INVALID_STATE_TRANSITION";
      if (!alreadyDone) {
        return jsonErr(`Fiskaly: errore commissioning entity (${commRes.status})`, { details: msg });
      }
      console.log("Entity already commissioned — continuing");
    }

    // ── Step 4: POST /systems ─────────────────────────────────────────────────
    console.log("Step 4: Creating system for entity", entityId);
    const sysRes = await fetch(`${BASE_URL}/systems`, {
      method: "POST",
      headers: { ...baseHeaders, "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        content: {
          type: "FISCAL_DEVICE",
          entity: { id: entityId },
          software: { name: "Shower2Pet", version: "1.0" },
          producer: { number: "S2P-CLOUD-001" },
        },
        metadata: { partner_id },
      }),
    });

    const sysText = await sysRes.text();
    console.log(`System response: ${sysRes.status} ${sysText}`);

    if (!sysRes.ok) {
      let parsed: any = null;
      try { parsed = JSON.parse(sysText); } catch { /* ignore */ }
      return jsonErr(
        `Fiskaly: errore creazione system (${sysRes.status})`,
        { details: parsed?.content?.message ?? sysText, entity_id: entityId }
      );
    }

    const sysData = JSON.parse(sysText);
    const systemId = sysData?.content?.id;
    if (!systemId) return jsonErr("Fiskaly: system ID non ricevuto", { details: sysData });

    // ── Step 5: Salva system_id nel profilo ──────────────────────────────────
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId })
      .eq("id", partner_id);

    if (updateError) {
      return jsonErr(
        "System creato su Fiskaly ma errore nel salvataggio del system_id",
        { system_id: systemId, entity_id: entityId, db_error: updateError.message },
        500
      );
    }

    console.log("Setup complete. system_id:", systemId, "entity_id:", entityId);

    return jsonOk({
      success: true,
      system_id: systemId,
      entity_id: entityId,
      message: providedEntityId
        ? "Configurazione Fiskaly completata da Entity esistente"
        : "Configurazione Fiskaly completata con successo",
    });
  } catch (err: any) {
    console.error("fiskaly-setup unhandled error:", err);
    return jsonErr(err.message ?? "Errore interno", {}, 500);
  }
});
