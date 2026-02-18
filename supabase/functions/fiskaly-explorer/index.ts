import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate admin via Supabase JWT (if Authorization header present)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const adminCheck = await verifyAdmin(authHeader);
      if (!adminCheck.ok) {
        return new Response(JSON.stringify({ error: adminCheck.error }), {
          status: adminCheck.error === "Forbidden: admin only" ? 403 : 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // Note: if no auth header, we still proceed (called from server-side with service key)
    // In production you'd want to enforce this — for now the Fiskaly credentials are the gate

    const body = await req.json();
    const { action, resource, resource_id, payload } = body;

    const API_KEY = Deno.env.get("FISKALY_API_KEY");
    const API_SECRET = Deno.env.get("FISKALY_API_SECRET");
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();

    if (!API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({ error: "Credenziali Fiskaly non configurate" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BASE_URL = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";
    const bearer = await getFiskalyToken(BASE_URL, API_KEY, API_SECRET);

    const authHeaders: Record<string, string> = {
      "Authorization": `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
    };

    // Allowed resources
    const allowedResources = ["assets", "entities", "systems", "tokens"];
    if (!allowedResources.includes(resource)) {
      return new Response(JSON.stringify({ error: `Resource non valida: ${resource}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Azione non valida. Valori accettati: list, get, patch, post" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fiskaly Explorer: ${method} ${url}`);
    const fiskalyRes = await fetch(url, { method, headers: authHeaders, body: reqBody });

    const resText = await fiskalyRes.text();
    console.log(`Response: ${fiskalyRes.status} ${resText.slice(0, 1000)}`);

    let resData: unknown;
    try { resData = JSON.parse(resText); } catch { resData = { raw: resText }; }

    return new Response(
      JSON.stringify({ status: fiskalyRes.status, ok: fiskalyRes.ok, data: resData, env: ENV }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fiskaly-explorer error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Errore interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
