import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FISKALY_API_VERSION = "2025-08-12";

async function markError(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  errorDetails: string,
) {
  try {
    await supabase
      .from("transaction_receipts")
      .update({ status: "ERROR", error_details: errorDetails })
      .eq("id", receiptId);
  } catch (e) {
    console.error("[GENERATE-RECEIPT] Failed to mark error:", e);
  }
}

/** Ottieni un bearer token Fiskaly con key/secret qualsiasi */
async function getFiskalyToken(baseUrl: string, key: string, secret: string): Promise<string> {
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
    throw new Error(`Fiskaly auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer received from Fiskaly");
  return bearer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let receiptId: string | null = null;

  try {
    const body = await req.json();
    const { session_id } = body;
    let { partner_id, amount } = body;

    console.log("generate-receipt called:", { session_id });

    // ── Risolvi partner_id e amount dalla sessione se non forniti ─────────────
    if (session_id && (!partner_id || !amount)) {
      const { data: session } = await supabase
        .from("wash_sessions")
        .select("station_id")
        .eq("id", session_id)
        .maybeSingle();

      if (session?.station_id) {
        const { data: station } = await supabase
          .from("stations")
          .select("owner_id, washing_options")
          .eq("id", session.station_id)
          .maybeSingle();

        if (!partner_id && station?.owner_id) {
          partner_id = station.owner_id;
          console.log("Resolved partner_id:", partner_id, "for station:", session.station_id);
        }

        if (!amount && station?.washing_options) {
          const { data: sessionDetail } = await supabase
            .from("wash_sessions")
            .select("option_id")
            .eq("id", session_id)
            .maybeSingle();

          const opts = Array.isArray(station.washing_options) ? station.washing_options : [];
          const opt = opts.find((o: any) => o.id === sessionDetail?.option_id);
          if (opt?.price) {
            amount = opt.price;
          }
        }

        // Fallback: cerca il prezzo nella transazione collegata
        if (!amount) {
          const { data: tx } = await supabase
            .from("transactions")
            .select("total_value")
            .eq("station_id", session.station_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (tx?.total_value) {
            amount = tx.total_value;
            console.log("Amount resolved:", amount, "from transaction: true");
          }
        }
      }
    }

    if (!partner_id || !amount) {
      return new Response(
        JSON.stringify({ error: "partner_id and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Inserisci record PENDING ───────────────────────────────────────────────
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    receiptId = receipt.id;
    console.log("Receipt row ID:", receiptId);

    // ── Dati fiscali partner ───────────────────────────────────────────────────
    const { data: partner } = await supabase
      .from("profiles")
      .select("fiskaly_system_id, vat_number, legal_name")
      .eq("id", partner_id)
      .single();

    if (!partner?.fiskaly_system_id) {
      await markError(supabase, receiptId, "Partner non configurato su Fiskaly (fiskaly_system_id mancante)");
      return new Response(
        JSON.stringify({ error: "Partner non configurato su Fiskaly", receipt_id: receiptId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Leggi credenziali Subject del partner (Option A) ──────────────────────
    // Se il partner ha credenziali Subject salvate in partners_fiscal_data, usale.
    // Altrimenti fallback al master key globale.
    const { data: fiscalData } = await supabase
      .from("partners_fiscal_data")
      .select("fiscal_api_credentials")
      .eq("profile_id", partner_id)
      .maybeSingle();

    const creds = fiscalData?.fiscal_api_credentials as {
      api_key?: string;
      api_secret?: string;
      env?: string;
    } | null;

    // Determina le credenziali da usare
    const fiskalyApiKey    = creds?.api_key    ?? Deno.env.get("FISKALY_API_KEY");
    const fiskalyApiSecret = creds?.api_secret ?? Deno.env.get("FISKALY_API_SECRET");
    const fiskalyEnv       = creds?.env?.toUpperCase() ?? (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    const credSource = creds?.api_key ? "partner Subject" : "global master key";
    console.log(`Authenticating with Fiskaly [${credSource}]...`);

    if (!fiskalyApiKey || !fiskalyApiSecret) {
      await markError(supabase, receiptId, "Credenziali Fiskaly non configurate");
      return new Response(
        JSON.stringify({ error: "Fiskaly credentials not configured", receipt_id: receiptId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fiskalyBaseUrl = fiskalyEnv === "LIVE"
      ? "https://live.api.fiskaly.com"
      : "https://test.api.fiskaly.com";

    console.log("Authenticating with Fiskaly...", fiskalyBaseUrl);

    // ── Ottieni token Bearer ───────────────────────────────────────────────────
    let jwtBearer: string;
    try {
      jwtBearer = await getFiskalyToken(fiskalyBaseUrl, fiskalyApiKey, fiskalyApiSecret);
    } catch (e: any) {
      await markError(supabase, receiptId, `Fiskaly auth error: ${e.message}`);
      return new Response(
        JSON.stringify({ error: "Fiskaly authentication failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Fiskaly auth OK.");

    const authHeaders = {
      Authorization: `Bearer ${jwtBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    // ── Crea INTENTION::TRANSACTION ───────────────────────────────────────────
    console.log("Creating INTENTION record...");
    const intentionRes = await fetch(`${fiskalyBaseUrl}/records`, {
      method: "POST",
      headers: { ...authHeaders, "X-Idempotency-Key": crypto.randomUUID() },
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
      const errMsg = `Fiskaly INTENTION failed [${intentionRes.status}]: ${intentionBody}`;
      console.error(errMsg);
      await markError(supabase, receiptId, errMsg);
      return new Response(
        JSON.stringify({ error: "Fiskaly intention creation failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const intentionData = await intentionRes.json();
    const intentionId = intentionData?.content?.id;

    if (!intentionId) {
      await markError(supabase, receiptId, "Fiskaly INTENTION response missing id");
      return new Response(
        JSON.stringify({ error: "Fiskaly intention id missing", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Crea TRANSACTION::RECEIPT ──────────────────────────────────────────────
    const taxRate = 22;
    const grossAmount = Number(amount);
    const netAmount = +(grossAmount / (1 + taxRate / 100)).toFixed(2);
    const vatAmount = +(grossAmount - netAmount).toFixed(2);
    const transactionDate = new Date().toISOString().split("T")[0];

    const transactionRes = await fetch(`${fiskalyBaseUrl}/records`, {
      method: "POST",
      headers: { ...authHeaders, "X-Idempotency-Key": crypto.randomUUID() },
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
            payments: [{ type: "ELECTRONIC", amount: grossAmount.toFixed(2) }],
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
      let fiskalyRecordId: string | null = null;
      try {
        const parsed = JSON.parse(transactionBody);
        fiskalyRecordId = parsed?.content?.id || null;
      } catch { /* ok */ }

      await supabase
        .from("transaction_receipts")
        .update({ status: "SENT", fiskaly_record_id: fiskalyRecordId })
        .eq("id", receiptId);

      console.log("✅ Receipt emessa:", receiptId, "fiskaly_record_id:", fiskalyRecordId);

      return new Response(
        JSON.stringify({ success: true, receipt_id: receiptId, fiskaly_record_id: fiskalyRecordId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      const errMsg = `Fiskaly TRANSACTION::RECEIPT failed [${transactionRes.status}]: ${transactionBody}`;
      console.error(errMsg);
      await markError(supabase, receiptId, errMsg);
      return new Response(
        JSON.stringify({ error: "Fiskaly receipt emission failed", receipt_id: receiptId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    console.error("[GENERATE-RECEIPT] Unexpected error:", err);
    if (receiptId) {
      await markError(supabase, receiptId, `Unexpected: ${String(err)}`);
    }
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
