
## Sezione Admin "Gestione Fiskaly" — Piano di Implementazione

### Analisi del Problema Attuale

Dai log della edge function emergono due problemi distinti:

**Problema 1 — Entity "fantasma" bloccante (WashDog):**
- Nei tentativi precedenti, Fiskaly ha creato parzialmente un asset con UUID `928af8e9-...` (UUID v4, non v7)
- Questo UUID non rispetta il pattern UUID v7 richiesto da Fiskaly per le entity (`^[0-9a-f]{8}-?[0-9a-f]{4}-?7[0-9a-f]{3}-?...`)
- La `POST /entities` restituisce 405 "cannot create new legal entity for non-unit asset" perché esiste già un asset
- Il `PATCH /entities/{uuid-v4}` restituisce 400 perché l'ID non rispetta la regex UUID v7
- Risultato: loop infinito di errori, impossibile configurare WashDog

**Problema 2 — Mancanza di strumenti di gestione:**
- Non esiste nell'admin nessun modo per vedere lo stato delle entity/system Fiskaly
- Non esiste un modo per resettare manualmente il `fiskaly_system_id` di un partner
- Non esiste un modo per inserire manualmente un System ID già esistente su Fiskaly

### Soluzione: 2 interventi paralleli

---

### Intervento 1 — Fix Edge Function `fiskaly-setup`

Il caso 405 "non-unit asset" non può essere risolto automaticamente (l'asset è corrotto lato Fiskaly). Invece di tentare di recuperare un UUID non valido, la funzione deve:

1. **Quando riceve 405**: invece di estrarre l'UUID dal messaggio di errore e tentare operazioni che falliranno, restituire un errore chiaro con istruzioni su come sbloccare il partner manualmente (impostando il `fiskaly_system_id` a mano oppure usando il campo di reset nell'admin)
2. **Aggiungere un parametro `entity_id` opzionale**: se passato, saltare lo Step 1 e usare direttamente quell'ID per il commissioning e la creazione del System — questo permette all'admin di fornire un entity ID valido nel caso in cui l'entity esista già su Fiskaly in stato corretto
3. **Aggiungere un parametro `system_id` opzionale**: se passato, saltare gli Step 1-3 e salvare direttamente quel System ID nel profilo — per registrazione manuale di un sistema già esistente

---

### Intervento 2 — Sezione "Gestione Fiskaly" in `AdminSettings.tsx`

Aggiungere una sezione dedicata nella pagina **Impostazioni Sistema** (`/admin-settings`) che permette all'admin di:

**A. Pannello di diagnostica per partner**
- Dropdown/ricerca per selezionare un partner
- Mostra: Ragione Sociale, P.IVA, `fiskaly_system_id` attuale, stato campi obbligatori
- Pulsante "Configura automaticamente" (chiama `fiskaly-setup` con `force: true`)

**B. Override manuale System ID**
- Campo input per inserire un System ID Fiskaly valido
- Pulsante "Salva System ID" → aggiorna direttamente il profilo tramite `updatePartnerData`
- Utile quando il System esiste già su Fiskaly ma non è salvato nel DB

**C. Override con Entity ID esistente**
- Campo input per un Entity ID Fiskaly valido (UUID v7)
- Pulsante "Configura da Entity esistente" → chiama `fiskaly-setup` con `entity_id` fornito, esegue solo Step 2 (commissioning) + Step 3 (crea System), salva il System ID
- Risolve il caso WashDog: invece di creare una nuova entity, si usa quella già esistente fornendo il suo ID corretto

**D. Reset**
- Pulsante "Azzera System ID" → imposta `fiskaly_system_id = null` nel profilo, permettendo una riconfigurazione completa da zero

---

### File da Creare/Modificare

| File | Azione |
|---|---|
| `supabase/functions/fiskaly-setup/index.ts` | Modifica: aggiungere parametri `entity_id` e `system_id` opzionali, migliorare gestione errore 405 |
| `src/pages/AdminSettings.tsx` | Modifica: aggiungere sezione "Gestione Fiskaly" con i 4 pannelli sopra descritti |
| `src/services/profileService.ts` | Già presente `updatePartnerData` — nessuna modifica necessaria |

---

### Flusso Operativo per WashDog (Caso Concreto)

```text
OPZIONE A — Se l'entity WashDog è "recuperabile" su Fiskaly:
  1. Admin cerca WashDog in AdminSettings > Gestione Fiskaly
  2. Admin inserisce l'Entity ID corretto di WashDog (UUID v7) nel campo apposito
  3. Clicca "Configura da Entity esistente"
  4. La edge function esegue solo Step 2 (commissioning) + Step 3 (crea System)
  5. System ID salvato automaticamente nel profilo

OPZIONE B — Se l'entity è irrecuperabile:
  1. Admin azzera il System ID (pulsante Reset)
  2. Admin crea manualmente una nuova entity su Fiskaly via API o altra interfaccia
  3. Admin inserisce il System ID ottenuto nel campo manuale
  4. Salva → partner operativo

OPZIONE C — Riconfigura da zero (se entity precedente è eliminabile):
  1. Admin clicca "Riconfigura (force)" nella FiskalySetupCard del partner
  2. La funzione crea una nuova entity e un nuovo System
```

---

### Nota Tecnica sulla FiskalySetupCard in ClientDetail

Il campo "Fiskaly System ID" nella `PartnerInfoCard` è già presente e funzionante — permette già l'override manuale. Quindi la sezione in `AdminSettings` aggiunge il flusso "usa entity esistente" e la diagnostica centralizzata, che mancano completamente.
