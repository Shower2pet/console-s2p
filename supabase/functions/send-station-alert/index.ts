import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { station_id, new_status, old_status } = await req.json();

    if (!station_id || !new_status || !old_status) {
      return new Response(JSON.stringify({ error: "station_id, new_status, old_status required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only handle OFFLINE and back-to-AVAILABLE transitions
    const isOffline = new_status === "OFFLINE" && old_status !== "OFFLINE";
    const isBackOnline = new_status === "AVAILABLE" && old_status === "OFFLINE";

    if (!isOffline && !isBackOnline) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_email_needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find station details
    const { data: station } = await supabase
      .from("stations")
      .select("structure_id, owner_id")
      .eq("id", station_id)
      .single();

    if (!station) {
      return new Response(JSON.stringify({ error: "Station not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine owner
    let ownerId = station.owner_id;
    if (!ownerId && station.structure_id) {
      const { data: struct } = await supabase
        .from("structures")
        .select("owner_id")
        .eq("id", station.structure_id)
        .single();
      ownerId = struct?.owner_id ?? null;
    }

    // Collect recipient emails (owner + managers)
    const recipientEmails: string[] = [];

    if (ownerId) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", ownerId)
        .single();
      if (ownerProfile?.email) recipientEmails.push(ownerProfile.email);
    }

    if (station.structure_id) {
      const { data: managers } = await supabase
        .from("structure_managers")
        .select("user_id")
        .eq("structure_id", station.structure_id);

      for (const m of managers ?? []) {
        if (m.user_id) {
          const { data: mProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", m.user_id)
            .single();
          if (mProfile?.email && !recipientEmails.includes(mProfile.email)) {
            recipientEmails.push(mProfile.email);
          }
        }
      }
    }

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content
    let subject: string;
    let htmlBody: string;

    if (isOffline) {
      subject = `⚠️ Stazione ${station_id} — Offline`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 24px;">
            <h2 style="margin: 0 0 12px; color: #991B1B; font-size: 20px;">⚠️ Stazione Offline</h2>
            <p style="margin: 0 0 8px; color: #7F1D1D; font-size: 15px;">
              La stazione <strong>${station_id}</strong> è andata offline.
            </p>
            <p style="margin: 0; color: #991B1B; font-size: 13px;">
              Stato precedente: <strong>${old_status}</strong> → <strong>OFFLINE</strong>
            </p>
          </div>
          <p style="margin: 20px 0 0; color: #6B7280; font-size: 13px;">
            Ti consigliamo di verificare la connessione della stazione. Se il problema persiste, apri un ticket di manutenzione dalla console.
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Shower2Pet — Notifica automatica</p>
        </div>`;
    } else {
      subject = `✅ Stazione ${station_id} — Tornata Online`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 24px;">
            <h2 style="margin: 0 0 12px; color: #166534; font-size: 20px;">✅ Stazione Tornata Online</h2>
            <p style="margin: 0 0 8px; color: #14532D; font-size: 15px;">
              La stazione <strong>${station_id}</strong> è tornata online autonomamente.
            </p>
            <p style="margin: 0; color: #166534; font-size: 13px;">
              Stato: <strong>OFFLINE</strong> → <strong>AVAILABLE</strong>
            </p>
          </div>
          <p style="margin: 20px 0 0; color: #6B7280; font-size: 13px;">
            La stazione è di nuovo operativa e pronta per l'uso.
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Shower2Pet — Notifica automatica</p>
        </div>`;
    }

    // Send emails via Resend
    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const email of recipientEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Shower2Pet <noreply@shower2pet.com>",
            to: email,
            subject,
            html: htmlBody,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Resend error for ${email}:`, errBody);
          results.push({ email, ok: false, error: errBody });
        } else {
          await res.json();
          results.push({ email, ok: true });
        }
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
        results.push({ email, ok: false, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-station-alert error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
