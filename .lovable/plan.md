

## Fix: Errore creazione stazione nel magazzino

### Problema
L'errore è causato dalla riga `<SelectItem value="">Nessuna</SelectItem>` nel selettore "Scheda Hardware" della pagina Inventario. Radix UI Select non permette `value=""` su un `SelectItem` — genera un'eccezione che blocca il dialog.

### Soluzione
Sostituire il valore vuoto con un placeholder come `"none"` e gestirlo nel codice:

1. **`src/pages/Inventory.tsx`** (linea 188):
   - Cambiare `<SelectItem value="">` in `<SelectItem value="__none__">`
   - Nel `mutationFn`, trattare `selectedBoardId === "__none__"` come nessuna scheda selezionata (equivalente a stringa vuota)
   - Nel `resetForm`, inizializzare `selectedBoardId` a `""` (il placeholder del Select viene mostrato correttamente quando il valore non corrisponde a nessun item)

