import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExpiredSession = {
  id: string;
  station_id: string | null;
  option_name: string;
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

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();

  const { data: expiredSessions, error: expiredErr } = await adminClient
    .from("wash_sessions")
    .select("id, station_id, option_name")
    .eq("status", "ACTIVE")
    .lte("ends_at", nowIso)
    .limit(500);

  if (expiredErr) {
    console.error("[check-expired-sessions] Failed fetching expired sessions:", expiredErr);
    return new Response(JSON.stringify({ error: "FETCH_EXPIRED_FAILED", details: expiredErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessions = (expiredSessions ?? []) as ExpiredSession[];
  if (sessions.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0, turned_off: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group sessions by station+relay
  type StationRelay = { stationId: string; relay: string };
  const sessionsByStationRelay = new Map<string, { sessionIds: string[]; relay: string; stationId: string }>();
  const orphanSessionIds: string[] = [];

  for (const session of sessions) {
    if (!session.station_id) {
      orphanSessionIds.push(session.id);
      continue;
    }
    const relay = session.option_name === "Manual Tub Clean" ? "relay2" : "relay1";
    const key = `${session.station_id}::${relay}`;
    const entry = sessionsByStationRelay.get(key) ?? { sessionIds: [], relay, stationId: session.station_id };
    entry.sessionIds.push(session.id);
    sessionsByStationRelay.set(key, entry);
  }

  const completedSessionIds = [...orphanSessionIds];
  let turnedOffCount = 0;

  // MQTT credentials
  const rawHost = Deno.env.get("MQTT_HOST")?.trim();
  const mqttUser = Deno.env.get("MQTT_USER");
  const mqttPass = Deno.env.get("MQTT_PASSWORD");

  if (!rawHost || !mqttUser || !mqttPass) {
    return new Response(JSON.stringify({ error: "MQTT_SECRETS_MISSING" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cleanHost = rawHost.replace(/^(wss?|mqtts?):\/\//, "").replace(/:\d+.*$/, "").replace(/\/.*$/, "");
  const mqttHost = `wss://${cleanHost}:8084/mqtt`;

  for (const [_key, { stationId, relay, sessionIds: stationSessionIds }] of sessionsByStationRelay.entries()) {
    const { count: stillActiveCount, error: activeErr } = await adminClient
      .from("wash_sessions")
      .select("id", { count: "exact", head: true })
      .eq("station_id", stationId)
      .eq("status", "ACTIVE")
      .gt("ends_at", nowIso);

    if (activeErr) {
      console.error(`[check-expired-sessions] Failed active-check for ${stationId}:`, activeErr);
      continue;
    }

    if ((stillActiveCount ?? 0) > 0) {
      completedSessionIds.push(...stationSessionIds);
      continue;
    }

    // Resolve board_id for MQTT topic
    const { data: boardRow } = await adminClient
      .from("boards")
      .select("id")
      .eq("station_id", stationId)
      .maybeSingle();
    const mqttTargetId = boardRow?.id ?? stationId;

    const topic = `shower2pet/${mqttTargetId}/${relay}/command`;
    const payload = "0";

    const published = await mqttPublishNative(mqttHost, mqttUser, mqttPass, topic, payload);
    if (!published) {
      console.error(`[check-expired-sessions] MQTT OFF timed out for station ${stationId} ${relay}`);
      continue;
    }

    turnedOffCount += 1;
    completedSessionIds.push(...stationSessionIds);

    const { error: gateInsertErr } = await adminClient.from("gate_commands").insert({
      station_id: stationId,
      command: `OFF_${relay.toUpperCase()}`,
      user_id: null,
      status: "sent",
    });

    if (gateInsertErr) {
      console.error(`[check-expired-sessions] Failed gate_commands insert for ${stationId}:`, gateInsertErr);
    }
  }

  if (completedSessionIds.length > 0) {
    const { error: updateErr } = await adminClient
      .from("wash_sessions")
      .update({ status: "COMPLETED" })
      .in("id", completedSessionIds);

    if (updateErr) {
      console.error("[check-expired-sessions] Failed updating completed sessions:", updateErr);
      return new Response(JSON.stringify({ error: "UPDATE_SESSIONS_FAILED", details: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    processed: sessions.length,
    completed: completedSessionIds.length,
    turned_off: turnedOffCount,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

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
  const protocolLevel = new Uint8Array([0x04]);
  const connectFlags = new Uint8Array([0xc2]);
  const keepAlive = new Uint8Array([0x00, 0x3c]);
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
  packet[0] = 0x10;
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
  packet[0] = 0x30;
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
  timeoutMs = 15000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const clientId = `s2p-cleanup-${Date.now()}`;

    let resolved = false;
    const done = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(() => done(false), timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, ["mqtt"]);
      ws.binaryType = "arraybuffer";
    } catch {
      clearTimeout(timer);
      resolve(false);
      return;
    }

    ws.onopen = () => ws.send(buildConnectPacket(clientId, username, password));

    ws.onmessage = (event) => {
      const data = new Uint8Array(event.data as ArrayBuffer);
      const packetType = data[0] >> 4;

      if (packetType === 2) {
        const returnCode = data[3];
        if (returnCode === 0) {
          ws.send(buildPublishPacket(topic, payload));
          ws.send(buildDisconnectPacket());
          done(true);
        } else {
          done(false);
        }
      }
    };

    ws.onerror = () => done(false);
    ws.onclose = () => {
      if (!resolved) done(false);
    };
  });
}
