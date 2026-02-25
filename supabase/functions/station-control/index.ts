import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import mqtt from "npm:mqtt@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  // --- Get user role ---
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const role = profile?.role as string | null;
  if (!role) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Parse & validate body ---
  const { station_id, command, duration_minutes } = await req.json();

  if (!station_id || typeof station_id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(station_id)) {
    return new Response(JSON.stringify({ error: "Invalid or missing station_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validCommands = ["PULSE", "ON", "OFF"];
  if (!command || typeof command !== "string" || !validCommands.includes(command)) {
    return new Response(JSON.stringify({ error: `Invalid command. Must be one of: ${validCommands.join(", ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- RBAC ---
  if (role === "user" && (command === "ON" || command === "OFF")) {
    return new Response(JSON.stringify({ error: "Forbidden: users can only use PULSE command" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Build MQTT topic & payload ---
  let topic: string;
  let payload: string;

  if (command === "PULSE") {
    if (!duration_minutes || typeof duration_minutes !== "number" || duration_minutes <= 0 || duration_minutes > 120) {
      return new Response(JSON.stringify({ error: "duration_minutes is required for PULSE (1-120)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const durationMs = Math.round(duration_minutes * 60 * 1000);
    topic = `shower2pet/${station_id}/relay1/pulse`;
    payload = durationMs.toString();
  } else if (command === "ON") {
    topic = `shower2pet/${station_id}/relay1/command`;
    payload = "1";
  } else {
    // OFF
    topic = `shower2pet/${station_id}/relay1/command`;
    payload = "0";
  }

  // --- MQTT publish ---
  // Deno Edge Functions only support WebSocket connections (no raw TCP).
  // Convert mqtts:// URL to wss:// on port 8884 for HiveMQ Cloud.
  const rawHost = Deno.env.get("MQTT_HOST")!;
  let mqttHost = rawHost
    .replace(/^mqtts?:\/\//, "wss://")
    .replace(/:8883\b/, ":8884");
  // If no protocol was present, prepend wss://
  if (!/^wss?:\/\//.test(mqttHost)) {
    mqttHost = "wss://" + mqttHost;
  }
  // Ensure port 8884 for HiveMQ Cloud WebSocket
  if (!/:(\d+)/.test(mqttHost)) {
    mqttHost += ":8884";
  }
  mqttHost += mqttHost.includes("/mqtt") ? "" : "/mqtt";
  const mqttUser = Deno.env.get("MQTT_USER")!;
  const mqttPass = Deno.env.get("MQTT_PASSWORD")!;

  try {
    const published = await publishMqtt(mqttHost, mqttUser, mqttPass, topic, payload);
    if (!published) {
      return new Response(JSON.stringify({ error: "MQTT publish timed out" }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the command
    await adminClient.from("gate_commands").insert({
      station_id,
      command,
      user_id: userId,
      status: "sent",
    });

    return new Response(JSON.stringify({ success: true, topic, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MQTT error:", err);
    return new Response(JSON.stringify({ error: "MQTT publish failed", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function publishMqtt(
  host: string,
  username: string,
  password: string,
  topic: string,
  payload: string,
  timeoutMs = 10000
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { client.end(true); } catch { /* ignore */ }
      resolve(false);
    }, timeoutMs);

    const client = mqtt.connect(host, {
      username,
      password,
      connectTimeout: 5000,
      protocolVersion: 5,
    });

    client.on("connect", () => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        clearTimeout(timer);
        client.end(true);
        resolve(!err);
      });
    });

    client.on("error", (err) => {
      console.error("MQTT connect error:", err);
      clearTimeout(timer);
      try { client.end(true); } catch { /* ignore */ }
      resolve(false);
    });
  });
}
