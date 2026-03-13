

## Ridefinizione del Ruolo Tester

### Comprensione aggiornata

Il tester **non crea** stazioni ne schede. Il flusso corretto è:

1. **Admin** crea le schede (Boards) e le stazioni (Inventory/Magazzino)
2. **Tester** riceve una stazione in fase PRODUCTION, ci monta fisicamente la scheda (già creata dall'admin), e testa i relè
3. Una volta verificato che tutto funziona, il tester promuove la stazione a STOCK (collaudata, pronta per l'assegnazione)

### Cosa cambia rispetto all'implementazione attuale

| Attuale | Corretto |
|---|---|
| Tester crea stazioni (`TesterStations.tsx`) | Tester **prende in carico** stazioni PRODUCTION esistenti |
| Tester crea schede (`Boards.tsx`) | Tester vede solo schede già create dall'admin, le associa alle stazioni |
| Nessun flusso di promozione | Tester promuove a STOCK dopo test superato |

### Piano di implementazione

#### 1. Database: aggiungere colonna `phase`

- Creare enum `station_phase`: `PRODUCTION`, `TESTING`, `STOCK`, `DEPLOYED`, `SHOWCASE`
- Aggiungere colonna `phase` a `stations` con default `PRODUCTION`
- Data migration per le stazioni esistenti
- Aggiornare RLS: il tester può fare SELECT su stazioni `phase = PRODUCTION` (per prenderle in carico) e ALL su stazioni `phase = TESTING AND owner_id = auth.uid()`
- Il tester **non** può INSERT/DELETE stazioni, solo UPDATE (prendere in carico, associare scheda, promuovere)

#### 2. Rimuovere `TesterStations.tsx`

La pagina attuale permette al tester di creare/eliminare stazioni. Va sostituita con una vista che mostra:
- **Tab "Da Testare"**: stazioni in fase PRODUCTION (azione: "Prendi in carico" → setta `owner_id = tester, phase = TESTING`)
- **Tab "In Test"**: stazioni in fase TESTING di proprietà del tester (azioni: comandi HW, associa scheda, "Collaudato → STOCK")

#### 3. Modificare `Boards.tsx` per il tester

Il tester **non** può creare/eliminare schede. Può solo:
- Vedere schede non assegnate (create dall'admin)
- Associarle a una sua stazione in TESTING
- Disassociarle

#### 4. Aggiornare `TesterHome.tsx`

Rimane il pannello di test hardware, ma filtra stazioni con `phase = TESTING AND owner_id = user.id` invece di solo `owner_id`.

#### 5. Aggiornare sidebar tester

```text
- Test Hardware (/)       → pannello relè
- Stazioni (/stations)    → tab Da Testare / In Test  
- Schede (/boards)        → vista schede (solo lettura + associazione)
```

#### 6. Transizioni di fase (service layer)

```text
Admin crea stazione → phase: PRODUCTION (Magazzino)
                           │
Tester "Prendi in carico" → phase: TESTING, owner_id: tester
                           │
Tester "Collaudato"       → phase: STOCK, owner_id: NULL
                           │
Admin "Assegna a partner" → phase: DEPLOYED, owner_id: partner
```

#### 7. Aggiornare `enforce_station_active_requires_price` trigger

- Stazioni in `TESTING`: bypass controlli heartbeat/Fiskaly (come già fatto nella edge function)
- Stazioni in `PRODUCTION`/`STOCK`: forzare sempre `OFFLINE`

#### 8. Aggiornare pagina Inventory (admin)

Filtrare per `phase = PRODUCTION` invece di `owner_id IS NULL AND structure_id IS NULL`.

#### 9. Edge function `station-control`

Verificare `phase = TESTING` per applicare il bypass tester (invece di controllare il ruolo del chiamante sulla tabella profiles).

### File coinvolti

| File | Modifica |
|---|---|
| Nuova migration SQL | Enum, colonna, data migration, RLS |
| `src/types/database.ts` | Aggiungere `StationPhase` |
| `src/pages/TesterStations.tsx` | Riscrivere: vista stazioni PRODUCTION + TESTING, no creazione |
| `src/pages/TesterHome.tsx` | Filtrare per `phase = TESTING` |
| `src/pages/Boards.tsx` | Tester: nascondere creazione/eliminazione, solo associazione |
| `src/pages/Inventory.tsx` | Filtrare per `phase = PRODUCTION` |
| `src/services/stationService.ts` | Funzioni: `takeForTesting()`, `promoteToStock()` |
| `src/hooks/useStations.ts` | Aggiungere filtro phase |
| `src/components/AppSidebar.tsx` | Aggiornare link tester |
| `supabase/functions/station-control` | Check phase per bypass |
| Trigger `enforce_station_active_requires_price` | Logica phase-aware |

