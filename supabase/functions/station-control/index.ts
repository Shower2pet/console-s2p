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

  // --- MQTT publish via native WebSocket ---
  const rawHost = Deno.env.get("MQTT_HOST")!.trim();
  const mqttUser = Deno.env.get("MQTT_USER")!;
  const mqttPass = Deno.env.get("MQTT_PASSWORD")!;

  // Normalize: ensure wss:// prefix and /mqtt path
  let mqttHost = rawHost;
  mqttHost = mqttHost.replace(/^mqtts?:\/\//, "wss://");
  if (!/^wss?:\/\//.test(mqttHost)) {
    mqttHost = "wss://" + mqttHost;
  }
  if (!mqttHost.includes("/mqtt")) {
    mqttHost += "/mqtt";
  }

  console.log(`[station-control] MQTT target: ${mqttHost}, topic: ${topic}, payload: ${payload}`);

  try {
    const published = await mqttPublishNative(mqttHost, mqttUser, mqttPass, topic, payload);
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

// ──────────────────────────────────────────────────────────────
// Native WebSocket MQTT 3.1.1 — minimal publish-only client
// ──────────────────────────────────────────────────────────────

function encodeUtf8String(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const buf = new Uint8Array(2 + encoded.length);
  buf[0] = (encoded.length >> 8) & 0xff;
  buf[1] = encoded.length & 0xff;
  buf.set(encoded, 2);
  return buf;
}

function encodeRemainingLength(length: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let encodedByte = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) encodedByte |= 0x80;
    bytes.push(encodedByte);
  } while (length > 0);
  return new Uint8Array(bytes);
}

function buildConnectPacket(clientId: string, username: string, password: string): Uint8Array {
  const protocolName = encodeUtf8String("MQTT");
  const protocolLevel = new Uint8Array([0x04]); // MQTT 3.1.1
  const connectFlags = new Uint8Array([0xc2]); // username + password + clean session
  const keepAlive = new Uint8Array([0x00, 0x3c]); // 60 seconds
  const clientIdBytes = encodeUtf8String(clientId);
  const usernameBytes = encodeUtf8String(username);
  const passwordBytes = encodeUtf8String(password);

  const variableHeaderAndPayload = new Uint8Array([
    ...protocolName,
    ...protocolLevel,
    ...connectFlags,
    ...keepAlive,
    ...clientIdBytes,
    ...usernameBytes,
    ...passwordBytes,
  ]);

  const remainingLength = encodeRemainingLength(variableHeaderAndPayload.length);
  const packet = new Uint8Array(1 + remainingLength.length + variableHeaderAndPayload.length);
  packet[0] = 0x10; // CONNECT
  packet.set(remainingLength, 1);
  packet.set(variableHeaderAndPayload, 1 + remainingLength.length);
  return packet;
}

function buildPublishPacket(topic: string, payload: string): Uint8Array {
  const topicBytes = encodeUtf8String(topic);
  const payloadBytes = new TextEncoder().encode(payload);

  const variableHeaderAndPayload = new Uint8Array(topicBytes.length + payloadBytes.length);
  variableHeaderAndPayload.set(topicBytes, 0);
  variableHeaderAndPayload.set(payloadBytes, topicBytes.length);

  const remainingLength = encodeRemainingLength(variableHeaderAndPayload.length);
  const packet = new Uint8Array(1 + remainingLength.length + variableHeaderAndPayload.length);
  packet[0] = 0x30; // PUBLISH, QoS 0
  packet.set(remainingLength, 1);
  packet.set(variableHeaderAndPayload, 1 + remainingLength.length);
  return packet;
}

function buildDisconnectPacket(): Uint8Array {
  return new Uint8Array([0xe0, 0x00]);
}

function mqttPublishNative(
  wsUrl: string,
  username: string,
  password: string,
  topic: string,
  payload: string,
  timeoutMs = 15000
): Promise<boolean> {
  return new Promise((resolve) => {
    const clientId = `s2p-edge-${Date.now()}`;
    console.log(`[MQTT-native] Connecting to ${wsUrl}...`);

    let resolved = false;
    const done = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };

    const timer = setTimeout(() => {
      console.error("[MQTT-native] Overall timeout reached");
      done(false);
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, ["mqtt"]);
      ws.binaryType = "arraybuffer";
    } catch (err) {
      console.error("[MQTT-native] WebSocket creation failed:", err);
      clearTimeout(timer);
      resolve(false);
      return;
    }

    ws.onopen = () => {
      console.log("[MQTT-native] WebSocket open, sending CONNECT...");
      ws.send(buildConnectPacket(clientId, username, password));
    };

    ws.onmessage = (event) => {
      const data = new Uint8Array(event.data as ArrayBuffer);
      const packetType = data[0] >> 4;

      if (packetType === 2) {
        // CONNACK
        const returnCode = data[3];
        if (returnCode === 0) {
          console.log("[MQTT-native] CONNACK OK, publishing...");
          ws.send(buildPublishPacket(topic, payload));
          // QoS 0 — no PUBACK expected, just send DISCONNECT
          ws.send(buildDisconnectPacket());
          console.log("[MQTT-native] Published OK (QoS 0)");
          done(true);
        } else {
          console.error(`[MQTT-native] CONNACK refused, code: ${returnCode}`);
          done(false);
        }
      }
    };

    ws.onerror = (event) => {
      console.error("[MQTT-native] WebSocket error:", event);
      done(false);
    };

    ws.onclose = () => {
      console.log("[MQTT-native] WebSocket closed");
      if (!resolved) done(false);
    };
  });
}
