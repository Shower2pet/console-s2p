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

    const { email, firstName, lastName, role, structureId, stationIds, legalName, vatNumber } = await req.json();

    // ── Input validation ────────────────────────────────────────────────────
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRe.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: "Email non valida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!firstName || typeof firstName !== "string" || firstName.length > 100) {
      return new Response(JSON.stringify({ error: "Nome obbligatorio (max 100 caratteri)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lastName && (typeof lastName !== "string" || lastName.length > 100)) {
      return new Response(JSON.stringify({ error: "Cognome non valido (max 100 caratteri)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validRoles = ["partner", "manager", "tester"];
    if (!role || !validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Ruolo non valido. Deve essere: partner, manager o tester" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (structureId && (typeof structureId !== "string" || !uuidRe.test(structureId))) {
      return new Response(JSON.stringify({ error: "structureId non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (stationIds && (!Array.isArray(stationIds) || stationIds.some((id: any) => typeof id !== "string"))) {
      return new Response(JSON.stringify({ error: "stationIds non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (legalName && (typeof legalName !== "string" || legalName.length > 200)) {
      return new Response(JSON.stringify({ error: "Ragione sociale non valida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (vatNumber && (typeof vatNumber !== "string" || vatNumber.length > 20)) {
      return new Response(JSON.stringify({ error: "Partita IVA non valida" }), {
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
    let userId: string;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (createError) {
      if (createError.message?.includes("already been registered")) {
        // Look up the existing auth user
        const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);
        if (listErr || !existingUser) {
          return new Response(JSON.stringify({ error: "Un utente con questa email è già registrato e non è stato possibile recuperarlo." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Security check: only reuse if the profile is missing (post-DB cleanup scenario)
        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (existingProfile) {
          // Profile exists → this is an active user, block re-creation
          return new Response(JSON.stringify({ error: "Un utente con questa email è già registrato nel sistema." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // No profile → safe to reuse (orphan auth user after DB cleanup)
        await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName },
        });
        userId = existingUser.id;
      } else {
        console.error("Create user error:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = newUser.user.id;
    }

    // Update profile with role and partner data
    const profileUpdate: Record<string, any> = {
      role,
      first_name: firstName,
      last_name: lastName,
      email,
      must_change_password: true,
    };
    if (legalName) profileUpdate.legal_name = legalName;
    if (vatNumber) {
      profileUpdate.vat_number = vatNumber;
      profileUpdate.fiscal_code = vatNumber; // default fiscal_code = vat_number
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // If manager, assign to structure
    if (role === "manager" && structureId) {
      const { error: managerError } = await adminClient
        .from("structure_managers")
        .insert({ user_id: userId, structure_id: structureId });

      if (managerError) {
        console.error("Manager assignment error:", managerError);
      }
    }

    // If partner with selected stations, assign owner_id
    if (role === "partner" && Array.isArray(stationIds) && stationIds.length > 0) {
      const { error: stationError } = await adminClient
        .from("stations")
        .update({ owner_id: userId })
        .in("id", stationIds);

      if (stationError) {
        console.error("Station assignment error:", stationError);
      }
    }

    // ── Send onboarding email for partners ──────────────────────────────────
    if (role === "partner") {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            to: email,
            type: "partner_credentials",
            data: {
              email,
              temp_password: tempPassword,
              partner_name: legalName || `${firstName} ${lastName}`.trim(),
              console_url: "https://console-s2p.lovable.app",
            },
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send partner credentials email:", emailErr);
        // Non-blocking: account is created even if email fails
      }
    }

    return new Response(
      JSON.stringify({ message: "Utente creato con successo", userId, tempPassword }),
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
