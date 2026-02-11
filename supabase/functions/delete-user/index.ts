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

    // Verify caller
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Token non valido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Only admins can delete users
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo gli admin possono eliminare utenti" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Non puoi eliminare il tuo stesso account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up ALL related data before deleting auth user (order matters for FK constraints)
    
    // 1. Get structures owned by this user
    const { data: ownedStructures } = await adminClient
      .from("structures")
      .select("id")
      .eq("owner_id", userId);
    const structureIds = (ownedStructures ?? []).map((s) => s.id);

    // 2. Get ALL stations owned by this user (via structure OR owner_id)
    const { data: allOwnedStations } = await adminClient
      .from("stations")
      .select("id")
      .or(`owner_id.eq.${userId}${structureIds.length > 0 ? `,structure_id.in.(${structureIds.join(",")})` : ""}`);
    const stationIds = (allOwnedStations ?? []).map((s) => s.id);

    if (stationIds.length > 0) {
      await adminClient.from("maintenance_logs").delete().in("station_id", stationIds);
      await adminClient.from("wash_sessions").delete().in("station_id", stationIds);
      await adminClient.from("transactions").delete().in("station_id", stationIds);
    }

    if (structureIds.length > 0) {
      // Delete transactions linked to owned structures
      await adminClient.from("transactions").delete().in("structure_id", structureIds);
      // Delete credit_packages for owned structures
      await adminClient.from("credit_packages").delete().in("structure_id", structureIds);
      // Delete structure_wallets for owned structures
      await adminClient.from("structure_wallets").delete().in("structure_id", structureIds);
      // Delete structure_managers for owned structures
      await adminClient.from("structure_managers").delete().in("structure_id", structureIds);
    }

    // Reset stations back to inventory (clear ALL user-specific data)
    if (stationIds.length > 0) {
      const { error: resetError } = await adminClient.from("stations").update({ 
        owner_id: null, 
        structure_id: null,
        geo_lat: null,
        geo_lng: null,
        washing_options: [],
        image_url: null,
        category: null,
        access_token: null,
        status: "OFFLINE",
        visibility: "HIDDEN",
      }).in("id", stationIds);
      if (resetError) {
        console.error("Station reset error:", resetError);
      } else {
        console.log(`Reset ${stationIds.length} stations:`, stationIds);
      }
    }

    // Delete structures
    if (structureIds.length > 0) {
      await adminClient.from("structures").delete().in("id", structureIds);
    }

    // Delete remaining references to this user_id
    await adminClient.from("structure_managers").delete().eq("user_id", userId);
    await adminClient.from("credit_packages").delete().eq("owner_id", userId);
    await adminClient.from("structure_wallets").delete().eq("user_id", userId);
    await adminClient.from("transactions").delete().eq("user_id", userId);
    await adminClient.from("maintenance_logs").delete().eq("performed_by", userId);
    await adminClient.from("wash_sessions").delete().eq("user_id", userId);
    await adminClient.from("partners_fiscal_data").delete().eq("profile_id", userId);

    // Delete profile
    await adminClient.from("profiles").delete().eq("id", userId);

    // 11. Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Delete user error:", deleteError);
      return new Response(JSON.stringify({ 
        error: "Impossibile eliminare l'utente dall'autenticazione. Potrebbe esserci un riferimento residuo nel database. Contatta il supporto tecnico.",
        detail: deleteError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: "Utente eliminato con successo" }),
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
