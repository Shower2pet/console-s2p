

## Analisi: Separazione Schede (Board) da Stazioni

### Situazione attuale
Oggi l'ID della stazione (es. `BR_001`) serve sia come identificativo logico della stazione sia come topic MQTT per comunicare con l'hardware. Il topic è `shower2pet/{station_id}/relay1/command`. Non esiste il concetto di "scheda" come entità separata.

### Il piano proposto

L'idea di separare schede e stazioni ha senso ed è un'evoluzione architetturale solida. Ecco come la strutturerei:

### 1. Nuova tabella `boards`

```text
boards
├── id           TEXT  PK  (ETH_1, ETH_2, WIFI_1, WIFI_2, ...)
├── type         TEXT      ("ethernet" | "wifi")
├── model        TEXT      (nome modello, campo libero)
├── station_id   TEXT  FK  (nullable, riferimento a stations.id)
├── created_at   TIMESTAMPTZ
```

L'ID progressivo viene generato automaticamente: si conta il max esistente per quel tipo e si incrementa.

### 2. Impatto sul topic MQTT

Questo è il punto critico: oggi il topic è `shower2pet/{station_id}/...`, ma con la separazione il topic dovrebbe diventare `shower2pet/{board_id}/...` perche e' la scheda che riceve il comando fisico.

La Edge Function `station-control` riceve `station_id`, dovrà fare un lookup nella tabella `boards` per trovare il `board_id` associato e usare quello come topic MQTT.

### 3. Modifiche necessarie

**Database:**
- Creare tabella `boards` con RLS (solo admin)
- Aggiungere auto-generazione ID (ETH_x / WIFI_x)

**UI - Nuova sezione "Schede" nel menu:**
- Lista schede con tipo, modello, stazione associata
- Dialog "Crea Scheda": selezione tipo (ethernet/wifi) + campo modello → dopo creazione mostra l'ID generato
- Possibilita di eliminare schede non associate

**UI - Modifica sezione Inventario (crea stazione):**
- Aggiungere un campo opzionale per associare una scheda disponibile alla stazione
- L'ID della stazione torna ad essere un identificativo logico (non piu legato all'hardware)

**Edge Functions:**
- `station-control`: lookup `boards.id` dalla `station_id` ricevuta per costruire il topic MQTT
- `check-expired-sessions`: stesso lookup
- `check-heartbeat`: il heartbeat arriva dalla scheda, quindi potrebbe arrivare con `board_id` e va mappato alla stazione

### 4. Considerazione importante: Heartbeat

Oggi il heartbeat arriva con lo `station_id`. Con la separazione, l'hardware conosce solo il proprio `board_id`. Bisogna decidere:
- **Opzione A**: L'heartbeat arriva con `board_id`, la Edge Function fa il lookup per aggiornare lo stato della stazione associata
- **Opzione B**: Si configura nella scheda sia il `board_id` che lo `station_id` (ma questo vanificherebbe parte della separazione)

Consiglio l'**Opzione A** per una separazione pulita.

### 5. Ordine di implementazione

1. Migrazione DB: creare tabella `boards`
2. Pagina gestione schede (CRUD)
3. Modificare creazione stazione per associare scheda
4. Aggiornare Edge Functions per il lookup board→station
5. Aggiornare heartbeat

Vuoi procedere con questa architettura?

