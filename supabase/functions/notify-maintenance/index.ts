import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    // Get station + structure info
    const { data: stationInfo } = await adminClient
      .from("stations")
      .select("type, structure_id, structures(name, owner_id)")
      .eq("id", station_id)
      .single();

    const structureName = (stationInfo as any)?.structures?.name ?? "N/A";
    const stationType = stationInfo?.type ?? "N/A";
    const ownerId = (stationInfo as any)?.structures?.owner_id ?? null;

    // Get owner email
    let ownerEmail: string | null = null;
    if (ownerId) {
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", ownerId)
        .single();
      ownerEmail = ownerProfile?.email ?? null;
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supportEmail = "alberto.c@shower2pet.com";
    const sentTo: string[] = [];

    const sendEmail = async (to: string, subject: string, html: string) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Shower2Pet <noreply@shower2pet.com>",
            to,
            subject,
            html,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Resend error for ${to}:`, errBody);
        } else {
          await res.json();
          sentTo.push(to);
        }
      } catch (e) {
        console.error(`Failed to send email to ${to}:`, e);
      }
    };

    if (type === "opened") {
      const sevLabel = severity === "high" ? "ALTA" : "BASSA";
      const sevColor = severity === "high" ? "#DC2626" : "#D97706";
      const subject = `🔧 Nuovo Ticket [${sevLabel}] — Stazione ${station_id}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 24px;">
            <h2 style="margin: 0 0 16px; color: #991B1B; font-size: 20px;">🔧 Nuovo Ticket di Manutenzione</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
              <tr><td style="padding: 6px 0; font-weight: bold; width: 120px;">Stazione:</td><td>${station_id}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Tipo:</td><td>${stationType}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Struttura:</td><td>${structureName}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Gravità:</td><td style="color: ${sevColor}; font-weight: bold;">${sevLabel}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Motivo:</td><td>${reason ?? 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Apertura:</td><td>${formatDate(new Date().toISOString())}</td></tr>
            </table>
            ${severity === "high" ? '<p style="margin: 16px 0 0; color: #991B1B; font-size: 13px; font-weight: bold;">⚠️ La stazione è stata messa in MANUTENZIONE automaticamente.</p>' : ''}
          </div>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Shower2Pet — Notifica automatica ticket</p>
        </div>`;

      // Send to partner
      if (ownerEmail) await sendEmail(ownerEmail, subject, htmlBody);
      // Send to support
      await sendEmail(supportEmail, subject, htmlBody);

    } else if (type === "closed") {
      // Fetch the most recent resolved ticket for this station
      const { data: ticket } = await adminClient
        .from("maintenance_logs")
        .select("*")
        .eq("station_id", station_id)
        .eq("status", "risolto")
        .order("ended_at", { ascending: false })
        .limit(1)
        .single();

      const ticketReason = ticket?.reason ?? reason ?? "N/A";
      const ticketSeverity = ticket?.severity ?? severity ?? "low";
      const sevLabel = ticketSeverity === "high" ? "ALTA" : "BASSA";
      const startedAt = formatDate(ticket?.created_at ?? null);
      const endedAt = formatDate(ticket?.ended_at ?? null);
      const ticketNotes = ticket?.notes ?? null;

      const subject = `✅ Ticket Risolto — Stazione ${station_id}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 24px;">
            <h2 style="margin: 0 0 16px; color: #166534; font-size: 20px;">✅ Ticket di Manutenzione Risolto</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
              <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">Stazione:</td><td>${station_id}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Tipo:</td><td>${stationType}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Struttura:</td><td>${structureName}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Gravità:</td><td>${sevLabel}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Motivo:</td><td>${ticketReason}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Inizio manutenzione:</td><td>${startedAt}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Fine manutenzione:</td><td>${endedAt}</td></tr>
              ${ticketNotes ? `<tr><td style="padding: 6px 0; font-weight: bold;">Note:</td><td>${ticketNotes}</td></tr>` : ''}
            </table>
            ${ticketSeverity === "high" ? '<p style="margin: 16px 0 0; color: #166534; font-size: 13px;">La stazione è tornata DISPONIBILE automaticamente.</p>' : ''}
          </div>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Shower2Pet — Notifica automatica ticket</p>
        </div>`;

      // Send to partner
      if (ownerEmail) await sendEmail(ownerEmail, subject, htmlBody);
      // Send to support
      await sendEmail(supportEmail, subject, htmlBody);

    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'opened' or 'closed'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
