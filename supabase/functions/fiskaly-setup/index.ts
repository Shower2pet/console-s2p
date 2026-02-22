import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FISKALY_API_VERSION = "2025-08-12";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonErr(msg: string, extras: Record<string, unknown> = {}, status = 502) {
  return new Response(JSON.stringify({ error: msg, ...extras }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Chiamata generica all'API Fiskaly. */
async function fCall(
  method: string,
  url: string,
  bearer: string,
  body?: unknown,
  scopeId?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "X-Api-Version": FISKALY_API_VERSION,
  };
  if (method === "POST" || method === "PATCH") {
    headers["X-Idempotency-Key"] = crypto.randomUUID();
  }
  if (scopeId) {
    headers["X-Scope-Identifier"] = scopeId;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ok */ }
  return { status: res.status, data, text };
}

/**
 * Ottieni un bearer token Fiskaly.
 */
async function getToken(baseUrl: string, key: string, secret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Version": FISKALY_API_VERSION,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ content: { type: "API_KEY", key, secret } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fiskaly auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const bearer = data?.content?.authentication?.bearer;
  if (!bearer) throw new Error("No bearer received from Fiskaly");
  return bearer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: require a valid JWT and admin/partner role ─────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonErr("Unauthorized", {}, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonErr("Unauthorized", {}, 401);
    }

    const callerId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (!callerProfile || !["admin", "partner"].includes(callerProfile.role)) {
      return jsonErr("Forbidden", {}, 403);
    }

    const {
      partner_id,
      force = false,
      system_id: providedSystemId = null,
      fisconline_password = null,
      fisconline_pin = null,
    } = await req.json();

    // ── Input validation ────────────────────────────────────────────────────
    if (!partner_id || typeof partner_id !== "string" || !UUID_RE.test(partner_id)) {
      return jsonErr("partner_id è obbligatorio e deve essere un UUID valido", {}, 400);
    }

    // Partners can only configure themselves
    if (callerProfile.role === "partner" && partner_id !== callerId) {
      return jsonErr("Forbidden: can only configure own fiscal data", {}, 403);
    }

    if (providedSystemId && (typeof providedSystemId !== "string" || providedSystemId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(providedSystemId))) {
      return jsonErr("system_id non valido", {}, 400);
    }
    if (fisconline_password && (typeof fisconline_password !== "string" || fisconline_password.length < 8 || fisconline_password.length > 100 || !/^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:',.<>?]+$/.test(fisconline_password))) {
      return jsonErr("Password Fisconline non valida (min 8 caratteri, solo caratteri alfanumerici e speciali consentiti)", {}, 400);
    }
    if (fisconline_pin && (typeof fisconline_pin !== "string" || !/^[0-9]{5,10}$/.test(fisconline_pin))) {
      return jsonErr("PIN Fisconline non valido (deve essere composto da 5-10 cifre numeriche)", {}, 400);
    }
    if (force !== undefined && force !== null && typeof force !== "boolean") {
      return jsonErr("Il campo 'force' deve essere un booleano", {}, 400);
    }

    const { data: partner } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partner_id)
      .maybeSingle();
    if (!partner) return jsonErr("Partner non trovato", {}, 404);

    // Shortcut: salva manualmente un system_id
    if (providedSystemId) {
      await supabase.from("profiles").update({ fiskaly_system_id: providedSystemId }).eq("id", partner_id);
      return jsonOk({ success: true, system_id: providedSystemId, message: "System ID salvato manualmente" });
    }

    // Già configurato e non si forza la riconfigurazione
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        already_configured: true,
        system_id: partner.fiskaly_system_id,
        message: "Già configurato.",
      });
    }

    // Validazione campi fiscali obbligatori
    const missing: string[] = [];
    if (!partner.legal_name?.trim())     missing.push("Ragione Sociale");
    if (!partner.vat_number?.trim())     missing.push("Partita IVA");
    if (!partner.legal_rep_fiscal_code?.trim()) missing.push("CF Rappresentante Legale (16 caratteri)");
    if (!partner.address_street?.trim()) missing.push("Via/Indirizzo");
    if (!partner.zip_code?.trim())       missing.push("CAP");
    if (!partner.city?.trim())           missing.push("Città");
    if (!partner.province?.trim())       missing.push("Provincia");
    if (!fisconline_password)            missing.push("Password Fisconline");
    if (!fisconline_pin)                 missing.push("PIN Fisconline");
    if (missing.length > 0) {
      return jsonErr(`Dati mancanti: ${missing.join(", ")}`, { missing_fields: missing }, 422);
    }

    const MASTER_KEY    = Deno.env.get("FISKALY_API_KEY")!;
    const MASTER_SECRET = Deno.env.get("FISKALY_API_SECRET")!;
    const ENV = (Deno.env.get("FISKALY_ENV") ?? "TEST").toUpperCase();
    if (!MASTER_KEY || !MASTER_SECRET) return jsonErr("Credenziali Fiskaly non configurate", {}, 500);

    const BASE = ENV === "LIVE" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";

    // ── STEP 0: Token master (tenant) ────────────────────────────────────────
    console.log("Step 0: tenant token...");
    const tenantBearer = await getToken(BASE, MASTER_KEY, MASTER_SECRET);
    console.log("Step 0: OK");

    // ── STEP 1: Trova o crea UNIT asset ──────────────────────────────────────
    let unitId: string | null = partner.fiskaly_unit_id ?? null;

    if (!unitId || force) {
      console.log("Step 1: ricerca UNIT esistente per partner_id...");
      const listR = await fCall("GET", `${BASE}/assets?limit=100`, tenantBearer);
      const existingUnit = (listR.data?.results ?? []).find(
        (a: any) => a.content?.type === "UNIT" && a.metadata?.partner_id === partner_id,
      );
      if (existingUnit) {
        unitId = existingUnit.content?.id ?? null;
        console.log("Step 1: UNIT esistente trovata:", unitId);
        await supabase.from("profiles").update({ fiskaly_unit_id: unitId }).eq("id", partner_id);
      }
    }

    if (!unitId) {
      console.log("Step 1: creazione nuova UNIT...");
      const r = await fCall("POST", `${BASE}/assets`, tenantBearer, {
        content: { type: "UNIT", name: partner.legal_name.trim() },
        metadata: { partner_id },
      });
      if (r.status === 200 || r.status === 201 || r.status === 409) {
        unitId = r.data?.content?.id ?? null;
      }
      if (!unitId) {
        console.error(`Errore creazione UNIT: status=${r.status}, body=${r.text?.slice(0, 300)}`);
        return jsonErr("Errore nella creazione della UNIT fiscale. Contattare il supporto.", {}, 502);
      }
      await supabase.from("profiles").update({ fiskaly_unit_id: unitId }).eq("id", partner_id);
    }

    // ── STEP 2: Trova o crea Subject (API Key) per la UNIT ───────────────────
    let subjectKey: string | null = null;
    let subjectSecret: string | null = null;
    let subjectId: string | null = null;

    console.log("Step 2: ricerca Subject esistente per UNIT...");
    const subjListR = await fCall("GET", `${BASE}/subjects?limit=100`, tenantBearer, undefined, unitId);
    const existingSubject = (subjListR.data?.results ?? []).find(
      (s: any) => s.metadata?.partner_id === partner_id,
    );

    if (existingSubject && !force) {
      subjectId = existingSubject.content?.id ?? null;
    }

    if (!subjectKey || !subjectSecret) {
      console.log("Step 2: creazione nuovo Subject per UNIT:", unitId);
      const subjectBody = {
        content: {
          type: "API_KEY",
          name: `s2p-${partner.legal_name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}-${Date.now()}`,
        },
        metadata: { partner_id, unit_id: unitId },
      };
      const sr = await fCall("POST", `${BASE}/subjects`, tenantBearer, subjectBody, unitId);

      if (sr.status === 200 || sr.status === 201) {
        subjectKey    = sr.data?.content?.credentials?.key ?? null;
        subjectSecret = sr.data?.content?.credentials?.secret ?? null;
        subjectId     = sr.data?.content?.id ?? null;
      } else if (sr.status === 409) {
        console.warn("Step 2: Subject 409 conflict");
      } else {
        console.error(`Errore creazione Subject: status=${sr.status}, body=${sr.text?.slice(0, 300)}`);
        return jsonErr("Errore nella creazione delle credenziali fiscali. Contattare il supporto.", {}, 502);
      }
    }

    // ── STEP 3: Token operativo per la UNIT ──────────────────────────────────
    let unitBearer: string;
    if (subjectKey && subjectSecret) {
      unitBearer = await getToken(BASE, subjectKey, subjectSecret);
    } else {
      unitBearer = tenantBearer;
    }

    // ── STEP 4: Trova o crea Entity ───────────────────────────────────────────
    let entityId: string | null = force ? null : (partner.fiskaly_entity_id ?? null);

    if (!entityId) {
      console.log("Step 4: ricerca Entity esistente...");
      const existingEntities = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer);
      const foundEntity = (existingEntities.data?.results ?? []).find(
        (e: any) => e.metadata?.partner_id === partner_id,
      );
      if (foundEntity) {
        entityId = foundEntity.content?.id ?? null;
        if (entityId) {
          await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
        }
      }
    }

    if (!entityId) {
      console.log("Step 4: creazione Entity...");
      const entityBody = {
        content: {
          type: "COMPANY",
          name: {
            legal: partner.legal_name.trim(),
            trade: partner.legal_name.trim(),
          },
          address: {
            line: {
              type: "STREET_NUMBER",
              street: partner.address_street.trim(),
              number: partner.address_number?.trim() || "SNC",
            },
            code: partner.zip_code.trim(),
            city: partner.city.trim(),
            country: "IT",
          },
          fiscalization: {
            type: "IT",
            tax_id_number: (partner.fiscal_code?.trim() || partner.vat_number.trim()),
            vat_id_number: partner.vat_number.trim(),
            credentials: {
              type: "FISCONLINE",
              tax_id_number: partner.legal_rep_fiscal_code!.trim(),
              password: fisconline_password,
              pin: fisconline_pin,
            },
          },
        },
        metadata: { partner_id, vat_number: partner.vat_number?.trim() ?? "" },
      };
      const er = await fCall("POST", `${BASE}/entities`, unitBearer, entityBody);

      if (er.status === 200 || er.status === 201) {
        entityId = er.data?.content?.id ?? null;
      } else if (er.status === 409) {
        entityId = er.data?.content?.id ?? null;
        if (!entityId) {
          const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer);
          const found = (lr.data?.results ?? []).find(
            (e: any) => e.metadata?.partner_id === partner_id,
          );
          entityId = found?.content?.id ?? null;
        }
        if (!entityId) {
          console.error("Entity conflict (409): ID non trovato", { unit_id: unitId });
          return jsonErr("Conflitto nella configurazione fiscale. Usa 'Azzera IDs Fiskaly' nel pannello admin e riprova.", {}, 409);
        }
      } else if (er.status === 405) {
        const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer);
        const found = (lr.data?.results ?? []).find(
          (e: any) => e.metadata?.partner_id === partner_id || e.content?.state,
        );
        entityId = found?.content?.id ?? null;
        if (!entityId) {
          console.error("Errore 405: entity già esistente per UNIT", { unit_id: unitId });
          return jsonErr("Esiste già una configurazione fiscale per questa unità. Usa 'Azzera IDs Fiskaly' nel pannello admin.", {}, 409);
        }
      } else {
        console.error(`Errore entity: status=${er.status}, body=${er.text?.slice(0, 300)}`);
        return jsonErr("Errore nella creazione dell'entità fiscale. Contattare il supporto.", {}, 502);
      }

      if (!entityId) return jsonErr("Entity ID non ricevuto da Fiskaly");
      await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
    }

    // ── STEP 5: Commissioning Entity ─────────────────────────────────────────
    const cr = await fCall("PATCH", `${BASE}/entities/${entityId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    if (!cr.status.toString().startsWith("2")) {
      const checkEr = await fCall("GET", `${BASE}/entities/${entityId}`, unitBearer);
      const entityState = checkEr.data?.content?.state ?? "";
      if (entityState !== "COMMISSIONED" && entityState !== "OPERATIVE") {
        console.error(`Errore commissioning entity: status=${cr.status}, state=${entityState}`);
        return jsonErr("Errore nell'attivazione dell'entità fiscale. Verificare i dati e riprovare.", {}, 502);
      }
    }

    // ── STEP 6: Trova o crea System ───────────────────────────────────────────
    if (partner.fiskaly_system_id && !force) {
      return jsonOk({
        success: true,
        system_id: partner.fiskaly_system_id,
        entity_id: entityId,
        message: "Configurazione già presente",
      });
    }

    const syr = await fCall("POST", `${BASE}/systems`, unitBearer, {
      content: {
        type: "FISCAL_DEVICE",
        entity: { id: entityId },
        software: { name: "Shower2Pet", version: "1.0" },
        producer: {
          type: "MPN",
          number: "S2P-CLOUD-001",
          details: {
            name: "Shower2Pet Cloud POS",
            brand: "Shower2Pet",
            model: "S2P-1.0",
          },
        },
      },
      metadata: { partner_id },
    });

    let systemId: string | null = null;
    if (syr.status === 200 || syr.status === 201) {
      systemId = syr.data?.content?.id ?? null;
    } else if (syr.status === 409) {
      systemId = syr.data?.content?.id ?? null;
      if (!systemId) {
        const slr = await fCall("GET", `${BASE}/systems?limit=100`, unitBearer);
        const found = (slr.data?.results ?? []).find(
          (s: any) => s.content?.entity?.id === entityId || s.metadata?.partner_id === partner_id,
        );
        systemId = found?.content?.id ?? null;
      }
      if (!systemId) {
        console.error("System conflict (409): ID non trovato");
        return jsonErr("Conflitto nella configurazione del sistema fiscale. Contattare il supporto.", {}, 409);
      }
    } else {
      console.error(`Errore system: status=${syr.status}, body=${syr.text?.slice(0, 300)}`);
      return jsonErr("Errore nella creazione del sistema fiscale. Contattare il supporto.", {}, 502);
    }
    if (!systemId) return jsonErr("System ID non ricevuto da Fiskaly");

    // ── STEP 7: Commissioning System ─────────────────────────────────────────
    const scr = await fCall("PATCH", `${BASE}/systems/${systemId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    if (!scr.status.toString().startsWith("2")) {
      const checkSr = await fCall("GET", `${BASE}/systems/${systemId}`, unitBearer);
      const systemState = checkSr.data?.content?.state ?? "";
      if (systemState !== "COMMISSIONED" && systemState !== "OPERATIVE") {
        console.error(`Errore commissioning system: status=${scr.status}, state=${systemState}`);
        return jsonErr("Errore nell'attivazione del sistema fiscale. Verificare la configurazione e riprovare.", {}, 502);
      }
    }

    // Salva sul DB
    await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId, fiskaly_entity_id: entityId, fiskaly_unit_id: unitId })
      .eq("id", partner_id);

    // Salva credenziali Subject in partners_fiscal_data
    if (subjectKey && subjectSecret) {
      const fiscalCredentials = {
        api_key: subjectKey,
        api_secret: subjectSecret,
        env: ENV.toLowerCase(),
        unit_id: unitId,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("partners_fiscal_data")
        .select("profile_id")
        .eq("profile_id", partner_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("partners_fiscal_data")
          .update({ fiscal_api_credentials: fiscalCredentials })
          .eq("profile_id", partner_id);
      } else {
        await supabase
          .from("partners_fiscal_data")
          .insert({
            profile_id: partner_id,
            business_name: partner.legal_name?.trim() ?? "",
            vat_number: partner.vat_number?.trim() ?? "",
            fiscal_api_credentials: fiscalCredentials,
          });
      }
    }

    return jsonOk({
      success: true,
      system_id: systemId,
      entity_id: entityId,
      unit_id: unitId,
      env: ENV,
      message: "Configurazione Fiskaly completata con successo",
    });

  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return jsonErr("Errore interno", {}, 500);
  }
});
