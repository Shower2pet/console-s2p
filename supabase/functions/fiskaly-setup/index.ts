import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { partner_id, force = false } = await req.json();

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

    // Check if already configured (idempotent)
    if (partner.fiskaly_system_id && !force) {
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
        ? "https://api.fiskaly.com/sign/it/v1"
        : "https://test.api.fiskaly.com/sign/it/v1";

    // ── Step 0: Authenticate with Fiskaly ──────────────────────────────────
    const authResp = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDummy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);

    // Fiskaly SIGN IT uses API Key + Secret directly as Bearer via base64
    const credentials = btoa(`${API_KEY}:${API_SECRET}`);
    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    };

    // ── Step 1: POST /entities ──────────────────────────────────────────────
    const fiscalCode = partner.fiscal_code?.trim() || partner.vat_number?.trim();
    const addressFull = [partner.address_street?.trim(), partner.address_number?.trim()]
      .filter(Boolean)
      .join(" ");

    const entityBody = {
      type: "COMPANY",
      name: partner.legal_name.trim(),
      address: {
        street: addressFull,
        postal_code: partner.zip_code.trim(),
        city: partner.city.trim(),
        country: "IT",
      },
      tax_id: {
        vat_number: partner.vat_number.trim(),
        fiscal_code: fiscalCode,
      },
    };

    console.log("Step 1: Creating entity...", JSON.stringify(entityBody));
    const entityResp = await fetch(`${BASE_URL}/entities`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(entityBody),
    });

    const entityData = await entityResp.json();
    console.log("Entity response:", entityResp.status, JSON.stringify(entityData));

    if (!entityResp.ok) {
      return new Response(
        JSON.stringify({
          error: `Fiskaly: errore creazione entity (${entityResp.status})`,
          details: entityData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entityId = entityData.id;

    // ── Step 2: PATCH /entities/:id → COMMISSIONED ─────────────────────────
    console.log("Step 2: Commissioning entity", entityId);
    const commissionResp = await fetch(`${BASE_URL}/entities/${entityId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ state: "COMMISSIONED" }),
    });

    const commissionData = await commissionResp.json();
    console.log("Commission response:", commissionResp.status, JSON.stringify(commissionData));

    if (!commissionResp.ok) {
      return new Response(
        JSON.stringify({
          error: `Fiskaly: errore commissioning entity (${commissionResp.status})`,
          details: commissionData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: POST /systems ───────────────────────────────────────────────
    const systemBody = {
      type: "FISCAL_DEVICE",
      entity: { id: entityId },
      software: {
        name: "Shower2Pet",
        version: "1.0",
      },
      producer: {
        number: "S2P-CLOUD-001",
      },
    };

    console.log("Step 3: Creating system...", JSON.stringify(systemBody));
    const systemResp = await fetch(`${BASE_URL}/systems`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(systemBody),
    });

    const systemData = await systemResp.json();
    console.log("System response:", systemResp.status, JSON.stringify(systemData));

    if (!systemResp.ok) {
      return new Response(
        JSON.stringify({
          error: `Fiskaly: errore creazione system (${systemResp.status})`,
          details: systemData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemId = systemData.id;

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
        message: "Configurazione Fiskaly completata con successo",
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
