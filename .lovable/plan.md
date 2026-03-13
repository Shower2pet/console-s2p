## Piano di Testing Completo — Console Shower2Pet

### Fase 0 — Pulizia Database ✅ COMPLETATA

Database pulito. Stato attuale:
- 1 profilo: admin@shower2pet.com (id: 2f5bb35f-2c57-4796-a0cd-52c50a1ece6d)
- 1 auth.user (admin)
- 2 prodotti (Akita, Bracco)
- 0 stazioni, 0 boards, 0 strutture, 0 transazioni

### Fase 1 — Autenticazione & Accesso (6 test) ⏳ PROSSIMA

| # | Test | Stato |
|---|------|-------|
| 1.1 | Login corretto admin | ⏳ |
| 1.2 | Credenziali errate | ⏳ |
| 1.3 | Email inesistente | ⏳ |
| 1.4 | Utente già loggato → redirect | ⏳ |
| 1.5 | URL protetto senza login | ⏳ |
| 1.6 | Pagina 404 | ⏳ |

### Fase 2 — UI/UX Generale (7 test)

**Con admin loggato:**

| # | Test | Verifica |
|---|------|---------|
| 2.1 | Sidebar desktop | 11 voci admin, collapse/expand, navigazione |
| 2.2 | Sidebar mobile | Hamburger → sheet, click voce → chiude sheet |
| 2.3 | Header | Nome/avatar, dropdown menu, logout |
| 2.4 | Ricerca globale | Apertura, digitazione, risultati |
| 2.5 | Notifiche | Dropdown, lista vuota (no notifiche) |
| 2.6 | Responsive | Layout corretto a 375px, 768px, 1280px |
| 2.7 | Badge ruolo | "Admin" visibile in sidebar |

### Fase 3 — Dashboard Admin (4 test)

| # | Test | Verifica |
|---|------|---------|
| 3.1 | StatCard | Ricavi 0, Stazioni 0, Partner 0 (db pulito) |
| 3.2 | Grafico ricavi | Visibile, vuoto o con placeholder |
| 3.3 | Mappa | Visibile, nessun marker (no stazioni) |
| 3.4 | Link rapidi | Click navigano correttamente |

### Fase 4 — Catalogo Prodotti (3 test)

**Verifica che i 2 prodotti esistenti (Akita, Bracco) siano visibili, poi testa CRUD.**

| # | Test | Azione |
|---|------|--------|
| 4.1 | Lista | 2 prodotti visibili |
| 4.2 | Creazione | Creare "Setter" tipo vasca |
| 4.3 | Disattivazione | Disattivare "Setter" → non visibile pubblicamente |

### Fase 5 — Schede Hardware (3 test)

| # | Test | Azione |
|---|------|--------|
| 5.1 | Lista vuota | Nessuna scheda (tutte eliminate) |
| 5.2 | Creazione | Creare 3 schede (2 ethernet, 1 wifi). Verificare Token + API key visibili UNA SOLA VOLTA |
| 5.3 | Eliminazione | Eliminare 1 scheda non assegnata → successo |

### Fase 6 — Magazzino (3 test)

| # | Test | Azione |
|---|------|--------|
| 6.1 | Lista vuota | Nessuna stazione in stock |
| 6.2 | Creazione | Creare 3 stazioni: "S2P-TEST1" (Bracco), "S2P-TEST2" (Akita), "S2P-TEST3" (Bracco). Associare schede |
| 6.3 | Verifica | Stazioni visibili in magazzino, status OFFLINE, no owner |

### Fase 7 — Creazione Partner (5 test)

| # | Test | Azione |
|---|------|--------|
| 7.1 | Navigazione | Admin → Partner → Nuovo Partner |
| 7.2 | Validazione | Submit senza dati → errori visibili |
| 7.3 | Creazione | Creare partner: "Test Partner SRL", P.IVA 12345678901, email partner-test@shower2pet.com. Assegnare 2 stazioni dal magazzino |
| 7.4 | Credenziali | Password temporanea visibile e copiabile |
| 7.5 | Verifica | Partner appare nella lista, stazioni assegnate |

### Fase 8 — Onboarding Partner (5 test)

**Login come partner con must_change_password = true**

| # | Test | Azione |
|---|------|--------|
| 8.1 | Redirect | Login partner → redirect `/onboarding` |
| 8.2 | Password corta | < 6 char → errore |
| 8.3 | Password mismatch | Password diverse → errore |
| 8.4 | Cambio password | Password valida → step strutture |
| 8.5 | Creazione struttura | Nome, mappa, assegnazione stazioni → redirect dashboard |

### Fase 9 — Dettaglio Partner (6 test)

**Come admin, dal dettaglio del partner creato:**

| # | Test | Azione |
|---|------|--------|
| 9.1 | Visualizzazione | Dati profilo, P.IVA, email |
| 9.2 | Modifica dati | Cambiare ragione sociale → salvataggio |
| 9.3 | Strutture | Lista strutture del partner con link |
| 9.4 | Stazioni | Lista stazioni assegnate |
| 9.5 | Assegnazione nuova | Assegnare stazione rimanente dal magazzino |
| 9.6 | Referenti | Aggiungere un referente → visibile nella lista |

### Fase 10 — Gestione Strutture (5 test)

| # | Test | Azione |
|---|------|--------|
| 10.1 | Lista | Strutture visibili (filtrate per ruolo) |
| 10.2 | Dettaglio | Info, mappa con marker |
| 10.3 | Modifica posizione | Spostare marker su mappa → salvataggio |
| 10.4 | Tab Stazioni | Lista stazioni della struttura con stato |
| 10.5 | Tab Team | Invito manager (InviteUserDialog) |

### Fase 11 — Gestione Stazioni (12 test)

| # | Test | Azione |
|---|------|--------|
| 11.1 | Tab Operative | Lista stazioni, ricerca, stato corretto |
| 11.2 | Tab Vetrina | Visibile solo admin |
| 11.3 | Creazione Vetrina | Dialog: ID, titolo, descrizione, mappa → successo |
| 11.4 | Dettaglio | Info complete, checklist requisiti |
| 11.5 | Opzioni lavaggio | CRUD: aggiungi, modifica, elimina opzione |
| 11.6 | Visibilità | Toggle PUBLIC/RESTRICTED |
| 11.7 | Gate code | Modifica codice accesso |
| 11.8 | Scheda | Visualizza scheda associata |
| 11.9 | Controlli HW | ON/OFF/PULSE (invocazione edge function) |
| 11.10 | Ticket | Apertura ticket manutenzione da dettaglio |
| 11.11 | Storico | Tab lavaggi, utenti, manutenzione |
| 11.12 | Valutazioni | Card rating (vuota, 0 stelle, 0 recensioni) |

### Fase 12 — Manutenzione (4 test)

| # | Test | Azione |
|---|------|--------|
| 12.1 | Lista | Ticket visibili (dal test 11.10) |
| 12.2 | Filtri | Filtro per stato/severità |
| 12.3 | Cambio stato | Open → in_progress → risolto |
| 12.4 | Dettaglio | Info complete, link stazione |

### Fase 13 — Utenti End-User (4 test)

| # | Test | Azione |
|---|------|--------|
| 13.1 | Lista | Vuota (no wash sessions) |
| 13.2 | Ricerca | Nessun risultato → UI corretta |
| 13.3 | Dettaglio | Se possibile con dati futuri |
| 13.4 | Eliminazione | Test con utente di test |

### Fase 14 — Ruolo `user` & Access Denied (2 test)

**Creare un utente con ruolo `user` per testare il blocco.**

| # | Test | Azione |
|---|------|--------|
| 14.1 | Login user | Login con ruolo user → signOut + "non autorizzato" |
| 14.2 | Access denied | Pagina `/access-denied` visibile |

### Fase 15 — Password Dimenticata (3 test)

| # | Test | Azione |
|---|------|--------|
| 15.1 | Form | Click "Password dimenticata?" → form email |
| 15.2 | Invio | Inserire email → messaggio successo |
| 15.3 | Recovery | Click link email → `/auth/update-password` → nuova password → login |

### Fase 16 — Transazioni & Report (3 test)

**Come partner (se ci sono transazioni) o verifica pagina vuota:**

| # | Test | Azione |
|---|------|--------|
| 16.1 | Lista | Pagina carica, vuota o con dati |
| 16.2 | StatCard | Tutti a 0 (db pulito) |
| 16.3 | Export CSV | Pulsante funzionante (file vuoto o con header) |

### Fase 17 — Resoconti Incassi Admin (2 test)

| # | Test | Azione |
|---|------|--------|
| 17.1 | Ricavi globali | Pagina carica, dati a 0 |
| 17.2 | Classifiche | Stazioni/partner vuote |

### Fase 18 — Pacchetti Crediti Partner (3 test)

**Come partner:**

| # | Test | Azione |
|---|------|--------|
| 18.1 | Lista vuota | Nessun pacchetto |
| 18.2 | Creazione | Creare pacchetto "10 Crediti" €9.99 → visibile |
| 18.3 | Switch | Disattivare/riattivare pacchetto |

### Fase 19 — Profilo Aziendale Partner (4 test)

| # | Test | Azione |
|---|------|--------|
| 19.1 | Visualizzazione | Dati aziendali del partner |
| 19.2 | Validazione | P.IVA non 11 cifre → errore |
| 19.3 | Salvataggio | Modifica dati → successo |
| 19.4 | Fiskaly | Card setup Fiskaly visibile |

### Fase 20 — Impostazioni Sistema Admin (3 test)

| # | Test | Azione |
|---|------|--------|
| 20.1 | Fiskaly | Lista partner, stato, setup |
| 20.2 | Explorer | Invocazione edge function Fiskaly |
| 20.3 | Log errori | Visualizzazione, risoluzione |

### Fase 21 — Permessi & Sicurezza (4 test)

| # | Test | Azione |
|---|------|--------|
| 21.1 | Partner blocco | Navigare a `/inventory`, `/boards`, `/admin-settings` → redirect o accesso negato |
| 21.2 | Partner isolamento | Non vede dati di altri partner |
| 21.3 | Manager limitazione | Solo struttura assegnata |
| 21.4 | Manager blocco | Non può creare strutture/pacchetti |

### Fase 22 — Edge Cases (4 test)

| # | Test | Azione |
|---|------|--------|
| 22.1 | Dettaglio inesistente | `/stations/XXX-FAKE` → "non trovato" |
| 22.2 | Doppio click | Click rapido su salvataggio → 1 sola operazione |
| 22.3 | Errori rete | Toast errore su fallimento |
| 22.4 | Eliminazione partner | Conferma con nome → eliminazione completa |

---

## Strategia di Esecuzione

1. **Fase 0** prima di tutto — pulizia database
2. **Fasi 1-22** in ordine — ogni fase crea i dati necessari per le successive
3. **Monitoraggio continuo**: `app_error_logs` + console browser dopo ogni fase
4. **Regressione**: dopo ogni fix, ri-verifica rapida delle fasi precedenti
5. **Credenziali**: admin@shower2pet.com / admin@shower2pet.com per accesso admin; creeremo partner e manager durante i test
