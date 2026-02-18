
## Automazione configurazione Fiskaly per partner

### Obiettivo
Creare un flusso guidato nell'App Console che, partendo dai dati fiscali già inseriti del partner (ragione sociale, P.IVA, indirizzo), crei automaticamente via API la struttura Fiskaly necessaria (Entity + System) e salvi il `fiskaly_system_id` nel profilo del partner senza necessità di usare dashboard esterne.

### Flusso API Fiskaly (3 passi)

```text
1. POST /entities      → crea l'ente fiscale (COMPANY) con i dati del partner
2. PATCH /entities/:id → commissions l'entity (state: COMMISSIONED)
3. POST /systems       → crea il System (FISCAL_DEVICE) collegato all'entity
                         └─ system.id → salvato come fiskaly_system_id sul partner
```

### Cosa viene creato

**1. Edge Function: `fiskaly-setup`**
- Riceve `partner_id`
- Legge i dati del partner da `profiles` (legal_name, vat_number, fiscal_code, address_*, zip_code, city, province)
- Si autentica su Fiskaly con API_KEY + API_SECRET (già nei secrets)
- Step 1: `POST /entities` con tipo `COMPANY`, dati italiani (country: `IT`), P.IVA e codice fiscale
- Step 2: `PATCH /entities/{entity_id}` per portare lo stato a `COMMISSIONED`
- Step 3: `POST /systems` con tipo `FISCAL_DEVICE` collegato all'entity, con software name/version Shower2Pet
- Salva il `system.id` ottenuto nel campo `fiskaly_system_id` della tabella `profiles`
- Restituisce `{ success: true, system_id, entity_id }` oppure errore dettagliato

**Attenzione:** Se il partner manca di dati obbligatori (ragione sociale, P.IVA, indirizzo completo) la funzione risponde con un errore chiaro che elenca i campi mancanti.

**2. UI: Sezione "Configurazione Fiskaly" in `ClientDetail.tsx` (vista admin)**
- Mostra lo stato attuale: se `fiskaly_system_id` è presente → badge verde "Configurato", altrimenti badge arancione "Non configurato"
- Pulsante **"Configura automaticamente su Fiskaly"** → chiama la edge function
- Durante l'esecuzione: spinner + testo "Registrazione in corso su Fiskaly..."
- In caso di successo: aggiorna la UI, mostra il system_id ottenuto
- In caso di errore: mostra il messaggio di errore dettagliato (es. "P.IVA mancante nel profilo")

**3. UI: Stessa sezione in `Settings.tsx` (vista partner)**
- Identica ma riferita al proprio account
- Il partner può avviare la propria configurazione autonomamente se i dati fiscali sono completi

### Prerequisiti per il funzionamento
La configurazione Fiskaly richiede che il profilo del partner abbia tutti questi campi compilati:
- `legal_name` (ragione sociale)
- `vat_number` (P.IVA)
- `address_street`, `zip_code`, `city`, `province`

Se mancano, la UI mostra un avviso con i campi mancanti prima di permettere l'avvio.

### File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/fiskaly-setup/index.ts` | Nuovo - edge function |
| `supabase/config.toml` | Aggiunta entry `[functions.fiskaly-setup]` con `verify_jwt = false` |
| `src/pages/ClientDetail.tsx` | Aggiunta sezione "Configurazione Fiskaly" con pulsante e stato |
| `src/pages/Settings.tsx` | Aggiunta stessa sezione per partner |

### Considerazioni tecniche

- I secrets `FISKALY_API_KEY`, `FISKALY_API_SECRET`, `FISKALY_ENV` sono già configurati
- La edge function usa `SUPABASE_SERVICE_ROLE_KEY` per aggiornare il profilo (già disponibile)
- L'endpoint base è già gestito dalla logica esistente (`test.api.fiskaly.com` vs `live.api.fiskaly.com`)
- La funzione è **idempotente**: se viene chiamata più volte, controlla se un `fiskaly_system_id` esiste già e in quel caso salta la creazione (oppure può essere forzata con un flag `force: true`)
- Il `producer.number` per il `System` è un MPN (Model Part Number) richiesto da Fiskaly per identificare il software — verrà usato un valore convenuto tipo `S2P-CLOUD-001` con software name `Shower2Pet` e versione `1.0`
