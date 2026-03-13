
## Piano Completo: Feature Mancanti + Testing Checklist Console

### Stato Implementazione

| Feature | Stato |
|---|---|
| Tabella `station_ratings` + RLS + funzione media | ✅ Completato |
| Edge function `delete-user` con self-deletion | ✅ Completato |
| `src/services/ratingService.ts` | ✅ Completato |
| Card "Valutazioni" in `StationDetail.tsx` | ✅ Completato |
| Colonna rating in `StationWashLogs.tsx` | ✅ Completato |
| Tipo `StationRating` in `database.ts` | ✅ Completato |

### Note per App User (progetto separato)

Per completare il flusso rating lato utente, nell'App User servono:
1. Componente 5 stelle post-lavaggio (step `feedback`/`done`) che fa INSERT in `station_ratings`
2. Visualizzazione media stelle nella pagina dettaglio stazione pubblica
3. Dialog "Elimina account" che chiama `delete-user` con `{ userId: currentUser.id, selfDelete: true }`

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
- [ ] Card valutazioni (media stelle + recensioni)

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
