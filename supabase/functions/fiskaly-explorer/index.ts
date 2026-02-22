import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FISKALY_API_VERSION = "2025-08-12";

async function getMasterToken(baseUrl: string, apiKey: string, apiSecret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ content: { type: "API_KEY", key: apiKey, secret: apiSecret } }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer token received");
  return bearer;
}

async function getScopedToken(baseUrl: string, apiKey: string, apiSecret: string, unitAssetId: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Version": FISKALY_API_VERSION,
        "X-Idempotency-Key": crypto.randomUUID(),
        "X-Scope-Identifier": unitAssetId,
      },
      body: JSON.stringify({ content: { type: "API_KEY", key: apiKey, secret: apiSecret } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.authentication?.bearer ?? null;
  } catch {
    return null;
  }
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: REQUIRE admin role ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return jsonResp({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return jsonResp({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json();
    const { action, resource, resource_id, payload } = body;

    const API_KEY = Deno.env.get("FISKALY_API_KEY");
    const API_SECRET = Deno.env.get("FISKALY_API_SECRET");
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    if (!API_KEY || !API_SECRET) return jsonResp({ error: "Credenziali Fiskaly non configurate" }, 500);

    const BASE_URL = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";
    const masterBearer = await getMasterToken(BASE_URL, API_KEY, API_SECRET);

    // ── ACTION: list_unit_entities ──────────────────────────────────────────
    if (action === "list_unit_entities") {
      const assetsRes = await fetch(`${BASE_URL}/assets?limit=100`, {
        headers: {
          Authorization: `Bearer ${masterBearer}`,
          "X-Api-Version": FISKALY_API_VERSION,
        },
      });
      const assetsData = await assetsRes.json();
      const units: any[] = (assetsData?.results ?? []).filter((a: any) => a?.content?.type === "UNIT");

      const results: any[] = [];
      for (const unit of units) {
        const unitId = unit?.content?.id;
        if (!unitId) continue;
        const unitName = unit?.content?.name ?? unitId;
        const unitMeta = unit?.metadata ?? {};

        const scopedBearer = await getScopedToken(BASE_URL, API_KEY, API_SECRET, unitId);
        if (!scopedBearer) {
          results.push({ unit_id: unitId, unit_name: unitName, unit_metadata: unitMeta, entities: [], error: "Token scoped non ottenuto" });
          continue;
        }

        const entRes = await fetch(`${BASE_URL}/entities?limit=100`, {
          headers: {
            Authorization: `Bearer ${scopedBearer}`,
            "X-Api-Version": FISKALY_API_VERSION,
          },
        });
        const entData = await entRes.json();
        const entities = entData?.results ?? [];
        results.push({ unit_id: unitId, unit_name: unitName, unit_metadata: unitMeta, unit_state: unit?.content?.state, entities });
      }

      return jsonResp({ ok: true, results, env: ENV, total_units: units.length });
    }

    // ── ACTION: decommission_entity ─────────────────────────────────────────
    if (action === "decommission_entity" && resource_id) {
      const { unit_asset_id } = body;
      if (!unit_asset_id) return jsonResp({ error: "unit_asset_id obbligatorio" }, 400);

      const scopedBearer = await getScopedToken(BASE_URL, API_KEY, API_SECRET, unit_asset_id);
      if (!scopedBearer) return jsonResp({ error: "Impossibile ottenere token scoped" }, 502);

      const decommRes = await fetch(`${BASE_URL}/entities/${resource_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${scopedBearer}`,
          "Content-Type": "application/json",
          "X-Api-Version": FISKALY_API_VERSION,
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ content: { state: "DECOMMISSIONED" } }),
      });
      const decommText = await decommRes.text();
      let decommData: unknown;
      try { decommData = JSON.parse(decommText); } catch { decommData = { raw: decommText }; }
      return jsonResp({ status: decommRes.status, ok: decommRes.ok, data: decommData, env: ENV });
    }

    // ── Standard CRUD actions ────────────────────────────────────────────────
    const allowedResources = ["assets", "entities", "systems", "subjects"];
    if (!allowedResources.includes(resource)) {
      return jsonResp({ error: "Resource non valida" }, 400);
    }

    const authHeaders: Record<string, string> = {
      "Authorization": `Bearer ${masterBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    const scopeId = body.scope_id as string | undefined;
    if (scopeId) authHeaders["X-Scope-Identifier"] = scopeId;

    let url = `${BASE_URL}/${resource}`;
    let method = "GET";
    let reqBody: string | undefined;

    if (action === "list") {
      url = `${BASE_URL}/${resource}?limit=100`;
      method = "GET";
    } else if (action === "get" && resource_id) {
      url = `${BASE_URL}/${resource}/${resource_id}`;
      method = "GET";
    } else if (action === "patch" && resource_id) {
      url = `${BASE_URL}/${resource}/${resource_id}`;
      method = "PATCH";
      reqBody = JSON.stringify(payload ?? {});
      authHeaders["X-Idempotency-Key"] = crypto.randomUUID();
    } else if (action === "post") {
      url = `${BASE_URL}/${resource}`;
      method = "POST";
      reqBody = JSON.stringify(payload ?? {});
      authHeaders["X-Idempotency-Key"] = crypto.randomUUID();
    } else {
      return jsonResp({ error: "Azione non valida" }, 400);
    }

    const fiskalyRes = await fetch(url, { method, headers: authHeaders, body: reqBody });
    const resText = await fiskalyRes.text();
    let resData: unknown;
    try { resData = JSON.parse(resText); } catch { resData = { raw: resText }; }

    return jsonResp({ status: fiskalyRes.status, ok: fiskalyRes.ok, data: resData, env: ENV });

  } catch (err: any) {
    console.error("fiskaly-explorer error:", err);
    return jsonResp({ error: "Errore interno" }, 500);
  }
});
