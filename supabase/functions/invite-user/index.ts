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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, firstName, lastName, role, structureId, stationIds } = await req.json();

    if (!email || !firstName || !lastName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (role === "partner" && callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo gli admin possono invitare partner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "manager" && !["admin", "partner"].includes(callerProfile?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permesso negato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with temporary password
    const tempPassword = crypto.randomUUID().slice(0, 8) + "A1!";
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (createError) {
      console.error("Create user error:", createError);
      const msg = createError.message?.includes("already been registered")
        ? "Un utente con questa email è già registrato."
        : createError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with role and must_change_password flag
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, first_name: firstName, last_name: lastName, email, must_change_password: true })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // If manager, assign to structure
    if (role === "manager" && structureId) {
      const { error: managerError } = await adminClient
        .from("structure_managers")
        .insert({ user_id: newUser.user.id, structure_id: structureId });

      if (managerError) {
        console.error("Manager assignment error:", managerError);
      }
    }

    // If partner with selected stations, assign owner_id
    if (role === "partner" && Array.isArray(stationIds) && stationIds.length > 0) {
      const { error: stationError } = await adminClient
        .from("stations")
        .update({ owner_id: newUser.user.id })
        .in("id", stationIds);

      if (stationError) {
        console.error("Station assignment error:", stationError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Utente creato con successo", userId: newUser.user.id, tempPassword }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
