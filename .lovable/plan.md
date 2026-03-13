

## Piano Completo: Feature Mancanti + Testing Checklist Console

### Parte A — Feature da Implementare

#### A1. Sistema Rating Stazioni (lato Console)

**Database (migration SQL):**
- Tabella `station_ratings`: `id` uuid PK, `station_id` text FK, `user_id` uuid FK, `session_id` uuid FK unique, `rating` smallint CHECK 1-5, `comment` text nullable, `created_at` timestamptz
- RLS: admin/partner/manager leggono rating delle proprie stazioni; utenti inseriscono i propri
- Funzione SQL `get_station_avg_rating(p_station_id text)` → returns `{avg_rating numeric, count bigint}`

**Console App:**
- Nuovo `src/services/ratingService.ts` — fetch media e lista rating per stazione
- In `src/pages/StationDetail.tsx` — nuova card "Valutazioni" dopo StationWashLogs: media stelle (icone Star), conteggio, lista ultime 10 recensioni con data/utente/commento
- In `src/components/StationWashLogs.tsx` — colonna "Rating" opzionale (stella + voto se presente)
- Aggiornare `src/types/database.ts` con tipo `StationRating`

#### A2. Self-Deletion Utente (Edge Function)

**Modifica `supabase/functions/delete-user/index.ts`:**
- Aggiungere parametro `selfDelete: boolean` nel body
- Se `selfDelete === true` E `userId === caller.id` E ruolo caller è `user`: permettere l'eliminazione (pulizia wallets, subscriptions, gate_commands, access_logs, notes, nullify wash_sessions/transactions user_id, delete profile, delete auth)
- Mantenere il blocco self-deletion per admin/partner/manager (protezione)
- Nessuna modifica console necessaria — la UI di cancellazione è nella User App

---

### Parte B — Testing Checklist Console App

#### 1. Autenticazione & Accesso
- [ ] Login email/password corretto
- [ ] Login credenziali errate → messaggio errore
- [ ] Password dimenticata → email → reset → nuovo login
- [ ] Redirect `/auth/update-password` da link recovery
- [ ] Ruolo `user` → redirect `/access-denied`
- [ ] Utente loggato → redirect home automatico

#### 2. Onboarding Partner (Primo Accesso)
- [ ] `must_change_password` → redirect `/onboarding`
- [ ] Cambio password obbligatorio (validazione)
- [ ] Step creazione strutture + assegnazione stazioni
- [ ] Posizione struttura da mappa
- [ ] Completamento → redirect dashboard

#### 3. UI/UX Generale
- [ ] Sidebar desktop: navigazione, collapse/expand
- [ ] Sidebar mobile: sheet, chiusura su navigazione
- [ ] Voci sidebar per ruolo (admin/partner/manager)
- [ ] Header: nome, avatar, dropdown
- [ ] Ricerca globale
- [ ] Notifiche dropdown
- [ ] Layout responsive (375px → 1280px+)
- [ ] Pagina 404

#### 4. Dashboard
- [ ] Admin: StatCard (ricavi, stazioni, partner), grafico, mappa
- [ ] Partner/Manager: dati filtrati per strutture proprie

#### 5. Gestione Partner (Admin)
- [ ] Lista con ricerca, navigazione dettaglio
- [ ] Creazione: validazione, assegnazione stazioni, credenziali temporanee
- [ ] Dettaglio: modifica dati, Fiskaly, strutture, stazioni, referenti
- [ ] Assegnazione stazioni dal magazzino
- [ ] Eliminazione partner (conferma con nome)

#### 6. Gestione Strutture
- [ ] Lista filtrata per ruolo
- [ ] Dettaglio: info, mappa, modifica posizione
- [ ] Tab Stazioni e Tab Team
- [ ] Invito manager
- [ ] Eliminazione struttura

#### 7. Gestione Stazioni
- [ ] Tab Operative + Tab Vetrina (admin)
- [ ] Ricerca, stato corretto, navigazione dettaglio
- [ ] Vetrina: creazione (ID, titolo, descrizione, mappa)
- [ ] Dettaglio: modifica stato con checklist (prezzo, scheda, struttura)
- [ ] Opzioni lavaggio CRUD
- [ ] Visibilità, gate code, scheda associata
- [ ] Controlli hardware: ON/OFF/PULSE, lavaggio temporizzato, pulizia vasca
- [ ] Ticket manutenzione da dettaglio
- [ ] Storico lavaggi, utenti, manutenzione
- [ ] **[NUOVO]** Card valutazioni (media stelle + recensioni)

#### 8. Magazzino (Admin)
- [ ] Lista stazioni stock
- [ ] Creazione stazione + associazione scheda
- [ ] Eliminazione stazione

#### 9. Schede Hardware (Admin)
- [ ] Lista, creazione, token/API key visibili una volta
- [ ] Eliminazione (solo se non assegnata)

#### 10. Catalogo Prodotti (Admin)
- [ ] CRUD prodotti, disattivazione

#### 11. Utenti End-User
- [ ] Lista con ricerca
- [ ] Dettaglio: profilo, wallet (modifica saldo), note
- [ ] Eliminazione utente (admin)

#### 12. Manutenzione
- [ ] Lista ticket con filtri (stato, severità)
- [ ] Creazione ticket, cambio stato, dettaglio

#### 13. Transazioni & Report (Partner/Manager)
- [ ] Lista transazioni, filtri, StatCard
- [ ] Grafico ricavi, export CSV

#### 14. Resoconti Incassi (Admin)
- [ ] Ricavi globali, classifica stazioni/partner

#### 15. Pacchetti Crediti (Partner)
- [ ] CRUD, attivazione/disattivazione switch

#### 16. Profilo Aziendale (Partner)
- [ ] Modifica dati (validazione P.IVA, CF, CAP, provincia)
- [ ] Setup Fiskaly, referenti, piani abbonamento

#### 17. Impostazioni Sistema (Admin)
- [ ] Gestione Fiskaly: lista partner, setup, override, reset, explorer
- [ ] Log errori

#### 18. Permessi & Sicurezza
- [ ] Admin: accesso completo
- [ ] Partner: solo proprie strutture/stazioni, no sezioni admin
- [ ] Manager: solo struttura assegnata

#### 19. Edge Cases
- [ ] URL protetto senza login → `/login`
- [ ] Dettaglio inesistente → "non trovato"
- [ ] Errori rete → toast errore
- [ ] Prevenzione doppio click su azioni
- [ ] Session expiry

---

### Riepilogo File da Modificare/Creare

| File | Azione |
|---|---|
| `supabase/migrations/xxx_station_ratings.sql` | Nuova tabella + RLS + funzione media |
| `supabase/functions/delete-user/index.ts` | Supporto self-deletion per ruolo `user` |
| `src/services/ratingService.ts` | Nuovo — fetch rating per stazione |
| `src/pages/StationDetail.tsx` | Card "Valutazioni" |
| `src/components/StationWashLogs.tsx` | Colonna rating opzionale |
| `src/types/database.ts` | Tipo `StationRating` |
| `.lovable/plan.md` | Aggiornamento con questo piano |

