import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FISKALY_API_VERSION = "2025-08-12";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      partner_id,
      force = false,
      entity_id: providedEntityId = null,
      system_id: providedSystemId = null,
    } = await req.json();

    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: "partner_id è obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Init Supabase with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch partner profile
    const { data: partner, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partner_id)
      .maybeSingle();

    if (profileError || !partner) {
      return new Response(
        JSON.stringify({ error: "Partner non trovato" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SHORTCUT: Save system_id directly if provided ───────────────────────
    if (providedSystemId) {
      console.log("Shortcut: saving provided system_id directly:", providedSystemId);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ fiskaly_system_id: providedSystemId })
        .eq("id", partner_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Errore nel salvataggio del System ID", db_error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          system_id: providedSystemId,
          message: "System ID salvato manualmente con successo",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already configured (idempotent)
    if (partner.fiskaly_system_id && !force && !providedEntityId) {
      return new Response(
        JSON.stringify({
          success: true,
          already_configured: true,
          system_id: partner.fiskaly_system_id,
          message: "Fiskaly già configurato. Usa force=true per riconfigurare.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!partner.legal_name?.trim()) missingFields.push("Ragione Sociale (legal_name)");
    if (!partner.vat_number?.trim()) missingFields.push("Partita IVA (vat_number)");
    if (!partner.address_street?.trim()) missingFields.push("Via/Indirizzo (address_street)");
    if (!partner.zip_code?.trim()) missingFields.push("CAP (zip_code)");
    if (!partner.city?.trim()) missingFields.push("Città (city)");
    if (!partner.province?.trim()) missingFields.push("Provincia (province)");

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Dati obbligatori mancanti nel profilo del partner: ${missingFields.join(", ")}`,
          missing_fields: missingFields,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fiskaly credentials
    const API_KEY = Deno.env.get("FISKALY_API_KEY");
    const API_SECRET = Deno.env.get("FISKALY_API_SECRET");
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    if (!API_KEY || !API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Credenziali Fiskaly non configurate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const BASE_URL =
      ENV === "LIVE"
        ? "https://live.api.fiskaly.com"
        : "https://test.api.fiskaly.com";

    // ── Step 0: Authenticate with Fiskaly (OAuth2 JWT) ─────────────────────
    console.log("Step 0: Authenticating with Fiskaly...");
    const tokenRes = await fetch(`${BASE_URL}/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Version": FISKALY_API_VERSION,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        content: {
          type: "API_KEY",
          key: API_KEY,
          secret: API_SECRET,
        },
      }),
    });

    if (!tokenRes.ok) {
      const tokenBody = await tokenRes.text();
      console.error("Token error:", tokenRes.status, tokenBody);
      return new Response(
        JSON.stringify({
          error: `Fiskaly: autenticazione fallita (${tokenRes.status})`,
          details: tokenBody,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenRes.json();
    const jwtBearer = tokenData?.content?.authentication?.bearer;

    if (!jwtBearer) {
      console.error("Token response missing bearer:", JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ error: "Fiskaly: token JWT non ricevuto", details: tokenData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Step 0: Auth successful, got bearer token");

    const authHeaders = {
      "Authorization": `Bearer ${jwtBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    let entityId: string | null = providedEntityId;

    // ── Step 1: POST /entities (skip if entity_id provided) ────────────────
    if (!entityId) {
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
      };

      console.log("Step 1: Creating entity...", JSON.stringify(entityBody));
      const entityRes = await fetch(`${BASE_URL}/entities`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(entityBody),
      });

      const entityText = await entityRes.text();
      console.log("Entity response:", entityRes.status, entityText);

      if (entityRes.status === 201 || entityRes.status === 200) {
        const entityData = JSON.parse(entityText);
        entityId = entityData?.content?.id;
      } else if (entityRes.status === 405) {
        // Entity "fantasma" bloccante — UUID non valido su Fiskaly, impossibile procedere
        // L'admin deve usare la sezione "Gestione Fiskaly" in AdminSettings per sbloccare
        const errorContent = (() => {
          try { return JSON.parse(entityText)?.content; } catch { return null; }
        })();
        console.error("Entity 405 — asset non-unit bloccante:", entityText);
        return new Response(
          JSON.stringify({
            error: "Fiskaly: entity bloccata (asset non-unit)",
            details: errorContent?.message ?? entityText,
            instructions: [
              "Su Fiskaly esiste già un asset con un ID non compatibile (UUID v4) che blocca la creazione automatica.",
              "Per sbloccare WashDog, usa la sezione 'Gestione Fiskaly' in Impostazioni Sistema:",
              "• Opzione A: inserisci il System ID corretto (se già esiste un System su Fiskaly) e clicca 'Salva System ID'",
              "• Opzione B: inserisci un Entity ID valido (UUID v7) e clicca 'Configura da Entity esistente' — la funzione eseguirà solo il commissioning e la creazione del System",
              "• Opzione C: azzera e riprova dopo aver eliminato l'asset corrotto su Fiskaly tramite API diretta",
            ],
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            error: `Fiskaly: errore creazione entity (${entityRes.status})`,
            details: entityText,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!entityId) {
        return new Response(
          JSON.stringify({ error: "Fiskaly: entity ID non ricevuto", details: entityText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("Step 1: Skipped — using provided entity_id:", entityId);
    }

    // ── Step 2: PATCH /entities/:id → COMMISSIONED ─────────────────────────
    console.log("Step 2: Commissioning entity", entityId);
    const commissionRes = await fetch(`${BASE_URL}/entities/${entityId}`, {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ content: { state: "COMMISSIONED" } }),
    });

    const commissionText = await commissionRes.text();
    console.log("Commission response:", commissionRes.status, commissionText);

    if (!commissionRes.ok) {
      const commissionContent = (() => {
        try { return JSON.parse(commissionText)?.content; } catch { return null; }
      })();
      return new Response(
        JSON.stringify({
          error: `Fiskaly: errore commissioning entity (${commissionRes.status})`,
          details: commissionContent?.message ?? commissionText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: POST /systems ───────────────────────────────────────────────
    const systemBody = {
      content: {
        type: "FISCAL_DEVICE",
        entity: { id: entityId },
        software: {
          name: "Shower2Pet",
          version: "1.0",
        },
        producer: {
          number: "S2P-CLOUD-001",
        },
      },
    };

    console.log("Step 3: Creating system...", JSON.stringify(systemBody));
    const systemRes = await fetch(`${BASE_URL}/systems`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(systemBody),
    });

    const systemText = await systemRes.text();
    console.log("System response:", systemRes.status, systemText);

    if (!systemRes.ok) {
      const systemContent = (() => {
        try { return JSON.parse(systemText)?.content; } catch { return null; }
      })();
      return new Response(
        JSON.stringify({
          error: `Fiskaly: errore creazione system (${systemRes.status})`,
          details: systemContent?.message ?? systemText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemData = JSON.parse(systemText);
    const systemId = systemData?.content?.id;

    if (!systemId) {
      return new Response(
        JSON.stringify({ error: "Fiskaly: system ID non ricevuto", details: systemData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Save system_id to profiles ─────────────────────────────────
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId })
      .eq("id", partner_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "System creato su Fiskaly ma errore nel salvataggio del system_id nel profilo",
          system_id: systemId,
          entity_id: entityId,
          db_error: updateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        system_id: systemId,
        entity_id: entityId,
        message: providedEntityId
          ? "Configurazione Fiskaly completata da Entity esistente"
          : "Configurazione Fiskaly completata con successo",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
