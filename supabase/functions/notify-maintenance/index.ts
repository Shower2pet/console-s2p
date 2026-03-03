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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin/partner/manager
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "partner", "manager"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, station_id, reason, severity } = await req.json();

    if (!type || !station_id) {
      return new Response(JSON.stringify({ error: "type and station_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find station's structure owner email
    const { data: station } = await adminClient
      .from("stations")
      .select("structure_id")
      .eq("id", station_id)
      .single();

    let ownerEmail: string | null = null;
    if (station?.structure_id) {
      const { data: struct } = await adminClient
        .from("structures")
        .select("owner_id")
        .eq("id", station.structure_id)
        .single();
      if (struct?.owner_id) {
        const { data: ownerProfile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("id", struct.owner_id)
          .single();
        ownerEmail = ownerProfile?.email ?? null;
      }
    }

    if (!ownerEmail) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_owner_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailType: string;
    let emailData: Record<string, any>;

    if (type === "opened") {
      emailType = "maintenance_ticket_opened";
      emailData = { station_id, reason: reason ?? "N/A", severity: severity ?? "low" };
    } else if (type === "closed") {
      emailType = "maintenance_ticket_closed";
      emailData = { station_id };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'opened' or 'closed'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send to structure owner
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ to: ownerEmail, type: emailType, data: emailData }),
    });

    const sentTo = [ownerEmail];

    // Send support email when a ticket is opened
    if (type === "opened") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const supportEmail = "alberto.c@shower2pet.com";

        // Get station details for richer email
        const { data: stationInfo } = await adminClient
          .from("stations")
          .select("type, structure_id, structures(name)")
          .eq("id", station_id)
          .single();

        const structureName = (stationInfo as any)?.structures?.name ?? "N/A";
        const stationType = stationInfo?.type ?? "N/A";

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 24px;">
              <h2 style="margin: 0 0 16px; color: #991B1B; font-size: 20px;">🔧 Nuovo Ticket di Manutenzione</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
                <tr><td style="padding: 6px 0; font-weight: bold;">Stazione:</td><td>${station_id}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">Tipo:</td><td>${stationType}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">Struttura:</td><td>${structureName}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">Gravità:</td><td style="color: ${severity === 'high' ? '#DC2626' : '#D97706'}; font-weight: bold;">${severity === 'high' ? 'ALTA' : 'BASSA'}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">Motivo:</td><td>${reason ?? 'N/A'}</td></tr>
              </table>
            </div>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
            <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Shower2Pet — Notifica automatica ticket</p>
          </div>`;

        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Shower2Pet <noreply@shower2pet.com>",
              to: supportEmail,
              subject: `🔧 Nuovo Ticket ${severity === 'high' ? '[ALTA]' : '[BASSA]'} — Stazione ${station_id}`,
              html: htmlBody,
            }),
          });
          sentTo.push(supportEmail);
        } catch (e) {
          console.error("Failed to send support email:", e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent_to: sentTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-maintenance error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
