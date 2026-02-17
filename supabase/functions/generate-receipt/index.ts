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

    // 2. Get partner fiscal data (fiskaly_system_id)
    const { data: partner, error: partnerErr } = await supabase
      .from("profiles")
      .select("fiskaly_system_id, vat_number, legal_name")
      .eq("id", partner_id)
      .single();

    if (partnerErr || !partner?.fiskaly_system_id) {
      await markError(supabase, receiptId, "Partner non configurato su Fiskaly (fiskaly_system_id mancante)");
      return new Response(
        JSON.stringify({ error: "Partner non configurato su Fiskaly", receipt_id: receiptId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Authenticate with Fiskaly SIGN IT API
    const fiskalyApiKey = Deno.env.get("FISKALY_API_KEY");
    const fiskalyApiSecret = Deno.env.get("FISKALY_API_SECRET");

    if (!fiskalyApiKey || !fiskalyApiSecret) {
      await markError(supabase, receiptId, "Credenziali Fiskaly non configurate (FISKALY_API_KEY / FISKALY_API_SECRET)");
      return new Response(
        JSON.stringify({ error: "Fiskaly credentials not configured", receipt_id: receiptId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fiskalyBaseUrl = Deno.env.get("FISKALY_ENV") === "LIVE"
      ? "https://live.api.fiskaly.com"
      : "https://test.api.fiskaly.com";

    // Create JWT token
    const tokenRes = await fetch(`${fiskalyBaseUrl}/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Version": FISKALY_API_VERSION,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        content: {
          type: "API_KEY",
          key: fiskalyApiKey,
          secret: fiskalyApiSecret,
        },
      }),
    });

    if (!tokenRes.ok) {
      const tokenBody = await tokenRes.text();
      await markError(supabase, receiptId, `Fiskaly token creation failed [${tokenRes.status}]: ${tokenBody}`);
      return new Response(
        JSON.stringify({ error: "Fiskaly authentication failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenRes.json();
    const jwtBearer = tokenData?.content?.authentication?.bearer;

    if (!jwtBearer) {
      await markError(supabase, receiptId, "Fiskaly token response missing bearer");
      return new Response(
        JSON.stringify({ error: "Fiskaly token missing", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeaders = {
      Authorization: `Bearer ${jwtBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    // 4a. Create Record: INTENTION::TRANSACTION
    const intentionRes = await fetch(`${fiskalyBaseUrl}/records`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        content: {
          type: "INTENTION",
          system: { id: partner.fiskaly_system_id },
          operation: { type: "TRANSACTION" },
        },
      }),
    });

    if (!intentionRes.ok) {
      const intentionBody = await intentionRes.text();
      await markError(supabase, receiptId, `Fiskaly INTENTION failed [${intentionRes.status}]: ${intentionBody}`);
      return new Response(
        JSON.stringify({ error: "Fiskaly intention creation failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intentionData = await intentionRes.json();
    const intentionId = intentionData?.content?.id;

    if (!intentionId) {
      await markError(supabase, receiptId, "Fiskaly INTENTION response missing id");
      return new Response(
        JSON.stringify({ error: "Fiskaly intention id missing", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4b. Create Record: TRANSACTION::RECEIPT
    const taxRate = 22;
    const grossAmount = Number(amount);
    const netAmount = +(grossAmount / (1 + taxRate / 100)).toFixed(2);
    const vatAmount = +(grossAmount - netAmount).toFixed(2);
    const transactionDate = new Date().toISOString().split("T")[0];

    const transactionRes = await fetch(`${fiskalyBaseUrl}/records`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        content: {
          type: "TRANSACTION",
          record: { id: intentionId },
          operation: {
            type: "RECEIPT",
            date: transactionDate,
            amounts: {
              total: grossAmount.toFixed(2),
              payment: grossAmount.toFixed(2),
            },
            payments: [
              {
                type: "ELECTRONIC",
                amount: grossAmount.toFixed(2),
              },
            ],
            entries: [
              {
                type: "SALE",
                description: "Servizio lavaggio",
                quantity: "1",
                amount: netAmount.toFixed(2),
                vat: {
                  rate: taxRate.toFixed(2),
                  amount: vatAmount.toFixed(2),
                },
              },
            ],
          },
        },
        metadata: {
          session_id: session_id || "",
          receipt_id: receiptId,
        },
      }),
    });

    const transactionBody = await transactionRes.text();

    if (transactionRes.ok) {
      // 5a. Success
      let fiskalyRecordId: string | null = null;
      try {
        const parsed = JSON.parse(transactionBody);
        fiskalyRecordId = parsed?.content?.id || null;
      } catch { /* response might not be JSON */ }

      await supabase
        .from("transaction_receipts")
        .update({
          status: "SENT",
          fiskaly_record_id: fiskalyRecordId,
        })
        .eq("id", receiptId);

      return new Response(
        JSON.stringify({ success: true, receipt_id: receiptId, fiskaly_record_id: fiskalyRecordId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // 5b. Error
      await markError(supabase, receiptId, `Fiskaly TRANSACTION::RECEIPT failed [${transactionRes.status}]: ${transactionBody}`);
      return new Response(
        JSON.stringify({ error: "Fiskaly receipt emission failed", receipt_id: receiptId }),
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
