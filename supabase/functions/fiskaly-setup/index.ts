import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FISKALY_API_VERSION = "2025-08-12";

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
 * key/secret possono essere le credenziali master o quelle di un Subject.
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
    const {
      partner_id,
      force = false,
      system_id: providedSystemId = null,
      fisconline_password = null,
      fisconline_pin = null,
      legal_rep_fiscal_code = null,
    } = await req.json();

    if (!partner_id) return jsonErr("partner_id è obbligatorio", {}, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
    if (!legal_rep_fiscal_code?.trim())  missing.push("CF Rappresentante Legale (16 caratteri)");
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
    // content.id = ID della UNIT (da usare come scope)
    // content.asset.id = asset fisico sottostante (non usare come scope!)
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
      console.log(`Step 1: UNIT → ${r.status} ${r.text.slice(0, 200)}`);
      if (r.status === 200 || r.status === 201 || r.status === 409) {
        // content.id è l'ID della UNIT (l'identificatore da usare come scope)
        unitId = r.data?.content?.id ?? null;
        console.log(`Step 1: unitId=${unitId} (asset.id=${r.data?.content?.asset?.id})`);
      }
      if (!unitId) return jsonErr(`Errore creazione UNIT (${r.status})`, { details: r.text.slice(0, 200) });
      await supabase.from("profiles").update({ fiskaly_unit_id: unitId }).eq("id", partner_id);
      console.log("Step 1: UNIT pronta:", unitId);
    }

    // ── STEP 2: Trova o crea Subject (API Key) per la UNIT ───────────────────
    // Secondo la doc Fiskaly SIGN IT: bisogna creare un Subject di tipo API_KEY
    // usando il token master con X-Scope-Identifier = unitId
    // Poi usare le credenziali del Subject per autenticarsi e operare sulla UNIT
    let subjectKey: string | null = null;
    let subjectSecret: string | null = null;
    let subjectId: string | null = null;

    // Cerca un Subject esistente per questa UNIT
    console.log("Step 2: ricerca Subject esistente per UNIT...");
    const subjListR = await fCall("GET", `${BASE}/subjects?limit=100`, tenantBearer, undefined, unitId);
    const existingSubject = (subjListR.data?.results ?? []).find(
      (s: any) => s.metadata?.partner_id === partner_id,
    );

    if (existingSubject && !force) {
      // Un Subject esiste ma non possiamo recuperare il secret → ricrearlo
      // I Subject sono monouso per il secret: dopo la creazione il secret non è più visibile
      // Se force=false e il subject esiste, non possiamo procedere senza il secret
      // Soluzione: cerchiamo se il partner ha credenziali salvate nel DB
      // (oppure forziamo la ri-creazione del Subject se force=true)
      console.log("Step 2: Subject trovato ma secret non recuperabile — ricreo Subject");
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
      console.log(`Step 2: Subject → ${sr.status} ${sr.text.slice(0, 300)}`);

      if (sr.status === 200 || sr.status === 201) {
        // La risposta ha: content.credentials.key e content.credentials.secret
        subjectKey    = sr.data?.content?.credentials?.key ?? null;
        subjectSecret = sr.data?.content?.credentials?.secret ?? null;
        subjectId     = sr.data?.content?.id ?? null;
        console.log(`Step 2: Subject creato: id=${subjectId} key=${subjectKey ? "OK" : "MISSING"} secret=${subjectSecret ? "OK" : "MISSING"}`);
      } else if (sr.status === 409) {
        // Conflict: Subject già esiste — non possiamo recuperare il secret
        // Dobbiamo usare force per ricrearlo, oppure usiamo il token master come fallback
        console.warn("Step 2: Subject 409 conflict — non posso recuperare il secret");
        // Continua con token master come fallback (potrebbe dare 405 sulle entity)
      } else {
        return jsonErr(`Errore creazione Subject (${sr.status})`, { details: sr.data?.content?.message ?? sr.text.slice(0, 200) });
      }
    }

    // ── STEP 3: Token operativo per la UNIT ──────────────────────────────────
    // Se abbiamo le credenziali del Subject, usiamole per un token "vero" per la UNIT
    let unitBearer: string;
    if (subjectKey && subjectSecret) {
      console.log("Step 3: token con credenziali Subject...");
      unitBearer = await getToken(BASE, subjectKey, subjectSecret);
      console.log("Step 3: token Subject OK ✓");
    } else {
      console.warn("Step 3: nessuna credenziale Subject disponibile — uso token master con scope");
      // Ultimo fallback: master token + X-Scope-Identifier
      // (può dare 405 in ambienti con UNIT reali, ma meglio che niente)
      unitBearer = tenantBearer;
    }

    // ── STEP 4: Trova o crea Entity ───────────────────────────────────────────
    let entityId: string | null = force ? null : (partner.fiskaly_entity_id ?? null);

    if (!entityId) {
      console.log("Step 4: creazione Entity (con type IT)...");
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
              tax_id_number: legal_rep_fiscal_code.trim(),
              password: fisconline_password,
              pin: fisconline_pin,
            },
          },
        },
        metadata: { partner_id, vat_number: partner.vat_number?.trim() ?? "" },
      };
      console.log("Step 4: entityBody.content.fiscalization =", JSON.stringify(entityBody.content.fiscalization));
      const er = await fCall("POST", `${BASE}/entities`, unitBearer, entityBody);
      console.log(`Step 4: Entity → ${er.status} ${er.text.slice(0, 500)}`);

      if (er.status === 200 || er.status === 201) {
        entityId = er.data?.content?.id ?? null;
        console.log("Step 4: Entity creata:", entityId);
      } else if (er.status === 409) {
        entityId = er.data?.content?.id ?? null;
        if (!entityId) {
          const lr = await fCall("GET", `${BASE}/entities?limit=100`, unitBearer);
          const found = (lr.data?.results ?? []).find(
            (e: any) => e.metadata?.partner_id === partner_id,
          );
          entityId = found?.content?.id ?? null;
        }
        if (!entityId) return jsonErr("Entity conflict (409): ID non trovato. Usa 'Azzera IDs Fiskaly' nel pannello admin e riprova.", { unit_id: unitId });
        console.log("Step 4: Entity conflict — uso esistente:", entityId);
      } else if (er.status === 405) {
        return jsonErr(
          "Errore 405: il token operativo non è valido per questa UNIT. Premi 'Azzera IDs Fiskaly nel DB' nel pannello admin e riconfigura.",
          { unit_id: unitId, details: er.data?.content?.message },
        );
      } else {
        return jsonErr(`Errore entity (${er.status})`, { details: er.data?.content?.message ?? er.text.slice(0, 200) });
      }

      if (!entityId) return jsonErr("Entity ID non ricevuto da Fiskaly");
      await supabase.from("profiles").update({ fiskaly_entity_id: entityId }).eq("id", partner_id);
    } else {
      console.log("Step 4: uso entity_id esistente:", entityId);
    }

    // ── STEP 5: Commissioning Entity ─────────────────────────────────────────
    console.log("Step 5: commissioning entity", entityId);
    const cr = await fCall("PATCH", `${BASE}/entities/${entityId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    console.log(`Step 5: Commission → ${cr.status} ${cr.text.slice(0, 200)}`);
    if (!cr.status.toString().startsWith("2")) {
      // Non fidarsi del messaggio d'errore: verificare lo stato reale via GET
      const checkEr = await fCall("GET", `${BASE}/entities/${entityId}`, unitBearer);
      const entityState = checkEr.data?.content?.state ?? "";
      console.log(`Step 5: stato reale entity = ${entityState}`);
      if (entityState === "COMMISSIONED" || entityState === "OPERATIVE") {
        console.log("Step 5: già commissionata (confermato via GET) — OK");
      } else {
        // Entity non commissionata: errore reale, mostra il motivo
        return jsonErr(`Errore commissioning entity (${cr.status}): entity in stato '${entityState}'`, {
          details: cr.data?.content?.message,
          entity_state: entityState,
        });
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

    console.log("Step 6: creazione System per entity", entityId);
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
    console.log(`Step 6: System → ${syr.status} ${syr.text.slice(0, 400)}`);

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
      if (!systemId) return jsonErr("System conflict (409): ID non trovato. Usa 'Salva System ID manuale' nell'admin.", { entity_id: entityId });
      console.log("Step 6: System conflict — uso esistente:", systemId);
    } else {
      return jsonErr(`Errore system (${syr.status})`, {
        details: syr.data?.content?.message ?? syr.text.slice(0, 200),
        entity_id: entityId,
      });
    }
    if (!systemId) return jsonErr("System ID non ricevuto da Fiskaly");

    // ── STEP 7: Commissioning System ─────────────────────────────────────────
    console.log("Step 7: commissioning system", systemId);
    const scr = await fCall("PATCH", `${BASE}/systems/${systemId}`, unitBearer, { content: { state: "COMMISSIONED" } });
    console.log(`Step 7: System commission → ${scr.status} ${scr.text.slice(0, 200)}`);
    if (!scr.status.toString().startsWith("2")) {
      // Verifica stato reale via GET invece di fare pattern matching sul messaggio
      const checkSr = await fCall("GET", `${BASE}/systems/${systemId}`, unitBearer);
      const systemState = checkSr.data?.content?.state ?? "";
      console.log(`Step 7: stato reale system = ${systemState}`);
      if (systemState === "COMMISSIONED" || systemState === "OPERATIVE") {
        console.log("Step 7: già commissionato (confermato via GET) — OK");
      } else {
        // System non commissionato: errore reale, blocca e mostra il motivo
        return jsonErr(`Errore commissioning system (${scr.status}): system in stato '${systemState}'`, {
          details: scr.data?.content?.message,
          system_state: systemState,
          entity_id: entityId,
        });
      }
    }

    // Salva sul DB (profiles + Subject credentials in partners_fiscal_data)
    await supabase
      .from("profiles")
      .update({ fiskaly_system_id: systemId, fiskaly_entity_id: entityId, fiskaly_unit_id: unitId })
      .eq("id", partner_id);

    // Salva/aggiorna le credenziali del Subject in partners_fiscal_data
    // così generate-receipt può usare il token corretto per questa UNIT
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
      console.log("✅ Subject credentials salvate in partners_fiscal_data");
    } else {
      console.warn("⚠️ Subject credentials non disponibili — generate-receipt userà il master key");
    }

    console.log("✅ Completato → system_id:", systemId, "entity_id:", entityId, "unit_id:", unitId);
    return jsonOk({
      success: true,
      system_id: systemId,
      entity_id: entityId,
      unit_id: unitId,
      env: ENV,
      message: "Configurazione Fiskaly completata con successo ✓",
    });

  } catch (err: any) {
    console.error("fiskaly-setup error:", err);
    return jsonErr(err.message ?? "Errore interno", {}, 500);
  }
});
