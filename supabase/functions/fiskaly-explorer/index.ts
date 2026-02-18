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
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer token received");
  return bearer;
}

/** Get a token scoped to a specific UNIT asset via X-Scope-Identifier */
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

async function verifyAdmin(authHeader: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, error: "Unauthorized" };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const userSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Forbidden: admin only" };
  return { ok: true };
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
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const adminCheck = await verifyAdmin(authHeader);
      if (!adminCheck.ok) {
        return jsonResp({ error: adminCheck.error }, adminCheck.error === "Forbidden: admin only" ? 403 : 401);
      }
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
    // Lists all UNIT assets, then for each UNIT gets a scoped token and lists its entities.
    // This is the correct way since entities are not visible with a master token.
    if (action === "list_unit_entities") {
      console.log("list_unit_entities: fetching UNIT assets...");
      const assetsRes = await fetch(`${BASE_URL}/assets?limit=100`, {
        headers: {
          Authorization: `Bearer ${masterBearer}`,
          "X-Api-Version": FISKALY_API_VERSION,
        },
      });
      const assetsData = await assetsRes.json();
      const units: any[] = (assetsData?.results ?? []).filter((a: any) => a?.content?.type === "UNIT");
      console.log(`list_unit_entities: found ${units.length} UNIT assets`);

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
        console.log(`list_unit_entities: unit ${unitId} → ${entities.length} entities`);
        results.push({ unit_id: unitId, unit_name: unitName, unit_metadata: unitMeta, unit_state: unit?.content?.state, entities });
      }

      return jsonResp({ ok: true, results, env: ENV, total_units: units.length });
    }

    // ── ACTION: decommission_entity ─────────────────────────────────────────
    // Decommissions an entity using a scoped token for its UNIT.
    if (action === "decommission_entity" && resource_id) {
      const { unit_asset_id } = body;
      if (!unit_asset_id) return jsonResp({ error: "unit_asset_id obbligatorio per decommission_entity" }, 400);

      console.log(`decommission_entity: entity=${resource_id} unit=${unit_asset_id}`);
      const scopedBearer = await getScopedToken(BASE_URL, API_KEY, API_SECRET, unit_asset_id);
      if (!scopedBearer) return jsonResp({ error: "Impossibile ottenere token scoped per questa UNIT" }, 502);

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
      console.log(`decommission_entity: ${decommRes.status} ${decommText.slice(0, 300)}`);
      let decommData: unknown;
      try { decommData = JSON.parse(decommText); } catch { decommData = { raw: decommText }; }
      return jsonResp({ status: decommRes.status, ok: decommRes.ok, data: decommData, env: ENV });
    }

    // ── ACTION: disable_unit ────────────────────────────────────────────────
    // Disables a UNIT asset (sets state DISABLED) using master token.
    if (action === "disable_unit" && resource_id) {
      console.log(`disable_unit: asset=${resource_id}`);
      const patchRes = await fetch(`${BASE_URL}/assets/${resource_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${masterBearer}`,
          "Content-Type": "application/json",
          "X-Api-Version": FISKALY_API_VERSION,
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ content: { state: "DISABLED" } }),
      });
      const patchText = await patchRes.text();
      console.log(`disable_unit: ${patchRes.status} ${patchText.slice(0, 300)}`);
      let patchData: unknown;
      try { patchData = JSON.parse(patchText); } catch { patchData = { raw: patchText }; }
      return jsonResp({ status: patchRes.status, ok: patchRes.ok, data: patchData, env: ENV });
    }

    // ── Standard CRUD actions ────────────────────────────────────────────────
    const allowedResources = ["assets", "entities", "systems", "subjects"];
    if (!allowedResources.includes(resource)) {
      return jsonResp({ error: `Resource non valida: ${resource}` }, 400);
    }

    const authHeaders: Record<string, string> = {
      "Authorization": `Bearer ${masterBearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    // Optional scope override
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
      return jsonResp({ error: "Azione non valida. Usa: list_unit_entities, decommission_entity, disable_unit, list, get, patch, post" }, 400);
    }

    console.log(`Fiskaly Explorer: ${method} ${url}`);
    const fiskalyRes = await fetch(url, { method, headers: authHeaders, body: reqBody });
    const resText = await fiskalyRes.text();
    console.log(`Response: ${fiskalyRes.status} ${resText.slice(0, 500)}`);
    let resData: unknown;
    try { resData = JSON.parse(resText); } catch { resData = { raw: resText }; }

    return jsonResp({ status: fiskalyRes.status, ok: fiskalyRes.ok, data: resData, env: ENV });

  } catch (err: any) {
    console.error("fiskaly-explorer error:", err);
    return jsonResp({ error: err.message ?? "Errore interno" }, 500);
  }
});
