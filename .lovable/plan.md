

## Fix: Subject name troppo lungo per Fiskaly API

### Problema
La Fiskaly API impone un limite di **30 caratteri** per il campo `content.name` dei Subject. Il codice attuale in `fiskaly-setup/index.ts` (riga 244) costruisce il nome così:

```
s2p-{legalName.slice(0,30)}-{timestamp}
```

Risultato: fino a 48 caratteri → errore 400.

### Soluzione
Troncare l'intero nome composto a 30 caratteri. Calcolo: prefisso `s2p-` (4) + suffisso con hash breve (5-6 char) → ~20 char per il nome del partner.

```typescript
// Riga 244 — da:
name: `s2p-${partner.legal_name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}-${Date.now()}`,

// a:
name: `s2p-${partner.legal_name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}-${Date.now().toString(36)}`.slice(0, 30),
```

`Date.now().toString(36)` riduce il timestamp a ~8 char, e il `.slice(0, 30)` finale garantisce il rispetto del limite.

### File modificato
- `supabase/functions/fiskaly-setup/index.ts` — riga 244 (una sola riga)

