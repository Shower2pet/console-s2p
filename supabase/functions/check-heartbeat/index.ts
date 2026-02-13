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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Find stations whose last_heartbeat_at is older than 2 minutes and are not already OFFLINE
  const threshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: staleStations, error } = await supabase
    .from("stations")
    .select("id, structure_id, status, last_heartbeat_at")
    .lt("last_heartbeat_at", threshold)
    .not("status", "in", '("OFFLINE","MAINTENANCE")');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const station of staleStations ?? []) {
    // Set station OFFLINE
    await supabase
      .from("stations")
      .update({ status: "OFFLINE" })
      .eq("id", station.id);

    // Check if an open heartbeat ticket already exists
    const { data: existing } = await supabase
      .from("maintenance_logs")
      .select("id")
      .eq("station_id", station.id)
      .eq("severity", "high")
      .neq("status", "risolto")
      .ilike("reason", "%Nessun segnale%")
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("maintenance_logs").insert({
        station_id: station.id,
        severity: "high",
        status: "open",
        reason: "Stazione scollegata / Nessun segnale",
      });
      results.push({ station_id: station.id, action: "ticket_created" });
    } else {
      results.push({ station_id: station.id, action: "already_has_ticket" });
    }
  }

  return new Response(
    JSON.stringify({ checked: (staleStations ?? []).length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
