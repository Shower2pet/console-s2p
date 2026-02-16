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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let receiptId: string | null = null;

  try {
    const { session_id, partner_id, amount } = await req.json();

    if (!partner_id || !amount) {
      return new Response(
        JSON.stringify({ error: "partner_id and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Insert PENDING receipt
    const { data: receipt, error: insertErr } = await supabase
      .from("transaction_receipts")
      .insert({
        session_id: session_id || null,
        partner_id,
        amount,
        tax_rate: 22,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (insertErr || !receipt) {
      console.error("Insert receipt error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create receipt record", details: insertErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    receiptId = receipt.id;

    // 2. Get partner fiscal data
    const { data: partner, error: partnerErr } = await supabase
      .from("profiles")
      .select("acube_company_id, vat_number, legal_name")
      .eq("id", partner_id)
      .single();

    if (partnerErr || !partner?.acube_company_id) {
      await markError(supabase, receiptId, "Partner non configurato su A-Cube (acube_company_id mancante)");
      return new Response(
        JSON.stringify({ error: "Partner non configurato su A-Cube", receipt_id: receiptId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Login to A-Cube
    const acubeEmail = Deno.env.get("ACUBE_EMAIL");
    const acubePassword = Deno.env.get("ACUBE_PASSWORD");

    if (!acubeEmail || !acubePassword) {
      await markError(supabase, receiptId, "Credenziali A-Cube non configurate (ACUBE_EMAIL / ACUBE_PASSWORD)");
      return new Response(
        JSON.stringify({ error: "A-Cube credentials not configured", receipt_id: receiptId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loginRes = await fetch("https://common-sandbox.api.acubeapi.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: acubeEmail, password: acubePassword }),
    });

    if (!loginRes.ok) {
      const loginBody = await loginRes.text();
      await markError(supabase, receiptId, `A-Cube login failed [${loginRes.status}]: ${loginBody}`);
      return new Response(
        JSON.stringify({ error: "A-Cube login failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loginData = await loginRes.json();
    const jwtToken = loginData.token;

    if (!jwtToken) {
      await markError(supabase, receiptId, "A-Cube login response missing token");
      return new Response(
        JSON.stringify({ error: "A-Cube token missing", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Emit Smart Receipt
    // Calculate net amount and VAT from gross amount (IVA 22% included)
    const taxRate = 22;
    const grossAmount = Number(amount);
    const netAmount = +(grossAmount / (1 + taxRate / 100)).toFixed(2);
    const vatAmount = +(grossAmount - netAmount).toFixed(2);

    const receiptPayload = {
      business_registry: partner.acube_company_id,
      date: new Date().toISOString().split("T")[0],
      items: [
        {
          description: "Servizio lavaggio",
          quantity: 1,
          unit_price: netAmount,
          vat_rate: taxRate,
          amount: netAmount,
          vat_amount: vatAmount,
          total_amount: grossAmount,
        },
      ],
      payments: [
        {
          method: "electronic",
          amount: grossAmount,
        },
      ],
    };

    const receiptRes = await fetch("https://api-sandbox.acubeapi.com/receipts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(receiptPayload),
    });

    const receiptBody = await receiptRes.text();

    if (receiptRes.ok) {
      // 5a. Success
      let acubeId: string | null = null;
      try {
        const parsed = JSON.parse(receiptBody);
        acubeId = parsed.uuid || parsed.id || null;
      } catch { /* response might not be JSON */ }

      await supabase
        .from("transaction_receipts")
        .update({
          status: "SENT",
          acube_transaction_id: acubeId,
        })
        .eq("id", receiptId);

      return new Response(
        JSON.stringify({ success: true, receipt_id: receiptId, acube_id: acubeId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // 5b. Error
      await markError(supabase, receiptId, `A-Cube receipt failed [${receiptRes.status}]: ${receiptBody}`);
      return new Response(
        JSON.stringify({ error: "A-Cube receipt emission failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[GENERATE-RECEIPT] Unexpected error:", err);
    if (receiptId) {
      await markError(supabase, receiptId, `Unexpected: ${String(err)}`);
    }
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function markError(supabase: ReturnType<typeof createClient>, receiptId: string, errorDetails: string) {
  try {
    await supabase
      .from("transaction_receipts")
      .update({ status: "ERROR", error_details: errorDetails })
      .eq("id", receiptId);
  } catch (e) {
    console.error("[GENERATE-RECEIPT] Failed to mark error:", e);
  }
}
