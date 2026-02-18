import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FISKALY_API_VERSION = "2025-08-12";

async function getFiskalyToken(baseUrl: string, apiKey: string, apiSecret: string): Promise<string> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate admin via Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, resource, resource_id, payload } = await req.json();

    const API_KEY = Deno.env.get("FISKALY_API_KEY");
    const API_SECRET = Deno.env.get("FISKALY_API_SECRET");
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    if (!API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({ error: "Credenziali Fiskaly non configurate" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const BASE_URL = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";
    const bearer = await getFiskalyToken(BASE_URL, API_KEY, API_SECRET);

    const authHeaders: Record<string, string> = {
      "Authorization": `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    // Allowed resources: assets, entities, systems
    const allowedResources = ["assets", "entities", "systems"];
    if (!allowedResources.includes(resource)) {
      return new Response(JSON.stringify({ error: `Resource non valida: ${resource}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let url = `${BASE_URL}/${resource}`;
    let method = "GET";
    let body: string | undefined;

    if (action === "list") {
      // GET /resource?limit=50
      url = `${BASE_URL}/${resource}?limit=50`;
      method = "GET";
    } else if (action === "get" && resource_id) {
      // GET /resource/:id
      url = `${BASE_URL}/${resource}/${resource_id}`;
      method = "GET";
    } else if (action === "patch" && resource_id) {
      // PATCH /resource/:id — e.g. disable asset, change entity/system state
      url = `${BASE_URL}/${resource}/${resource_id}`;
      method = "PATCH";
      body = JSON.stringify(payload ?? {});
      authHeaders["X-Idempotency-Key"] = crypto.randomUUID();
    } else {
      return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Fiskaly Explorer: ${method} ${url}`);
    const fiskalyRes = await fetch(url, {
      method,
      headers: authHeaders,
      body,
    });

    const resText = await fiskalyRes.text();
    console.log(`Response: ${fiskalyRes.status} ${resText.slice(0, 500)}`);

    let resData: unknown;
    try { resData = JSON.parse(resText); } catch { resData = { raw: resText }; }

    return new Response(
      JSON.stringify({ status: fiskalyRes.status, ok: fiskalyRes.ok, data: resData, env: ENV }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fiskaly-explorer error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Errore interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
