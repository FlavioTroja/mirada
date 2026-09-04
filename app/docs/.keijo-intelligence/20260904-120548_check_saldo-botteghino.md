# keijo compliance check — il pannello del saldo di cassa

**Data** 4 settembre 2026 · **Ambito** lavoro non committato: il pannello «Il saldo del
botteghino» in `registration-detail`, `balance-settlement.store.ts`, e il blocco
`BALANCE_SETTLEMENT_METHOD_*` in `enums.ts`

## Esito dei gate

| gate | esito |
|---|---|
| **0 — build** (`ng build`) | ✅ verde. Solo warning preesistenti: deprecazioni `@import` di Sass e budget del bundle |
| **1 — CLI deterministico** | ⚠️ **non eseguito.** `@keijo/cli` sta su `npm.overzoom.it` e in questo ambiente non ci sono credenziali (il `.npmrc` punta lo scope al registry privato, il token arriva da un secret BuildKit). Le regole strutturali che il CLI possiede sono state girate al revisore semantico |
| **2 — revisore semantico** | ✅ eseguito in sola lettura, con `invariants.json` locale |

⚠️ Con il gate 1 spento questo referto copre **due gate su tre**. Il revisore ha verificato a
mano le regole strutturali (niente `<table>`, niente `@angular/material`, niente icone come
stringa, nessuna pill senza marcatore, nessun template di list-item vuoto) e le ha trovate
pulite, ma non è la stessa garanzia di un exit-code.

## Ciò che è risultato corretto

Vale la pena registrarlo, perché sono i punti su cui la verifica era stata indirizzata:

- `settleButtons` è ordinato `[{settle, accent}, {cancel, default}]` — `buttons[0]` è il primario
  più a destra, conforme a `KEIJO-SECTION-BUTTONS-RIGHTMOST-PRIMARY`.
- `variant: 'default'` su tutti e cinque i metodi di pagamento **è giusto**, non un abuso: un
  metodo è metadato neutro, senza stato e senza navigazione. Coerente con `REGISTRATION_CHANNEL_UI`.
- Nessun `variant="filled"` nel file: nessun abuso della pill di riferimento a entità.
- I tre segnali `editing` / `reassigning` / `settling` sono stato **per sezione**, non un `mode()`
  globale: conforme a `KEIJO-DETAIL-EDIT-PER-SECTION` nella sostanza.
- Gli importi come testo (`<p class="mirada-value">`) sono espressamente esentati da
  `KEIJO-LIST-VALUE-USES-KEIJO-COMPONENT` («a date, a money amount, a count as text is FINE»).
- `keijo-list-item-wrapper` invece di `keijo-entity-list-item` per lo storico incassi è
  difendibile: un incasso non ha una rotta di dettaglio, e il pulsante Vedi obbligatorio non
  avrebbe dove andare.

## Rilievi

### 1. Il pannello sparisce quando l'incasso è in conflitto — **il più grave**

`registration-detail.component.ts:695` · `loadBalance()`

```ts
this.balance.set(bal.dueAmount > 0 ? bal : null);
```

Il revisore l'ha marcato «bassa confidenza» non potendo sapere se il backend permetta un
incasso su un'iscrizione senza residuo. **Lo permette, di proposito.**
`BalanceSettlementService` §sync (riga 259) elenca `NO_BALANCE_DUE` fra i conflitti, e la riga
**viene creata lo stesso**:

> `Row (id …) created and left to the staff, never dropped: that money was really taken.`

È l'asimmetria dichiarata in `14`: `record` rifiuta prima che il denaro passi di mano, `sync`
accetta dopo, perché rifiutare cancellerebbe contante già incassato. Quindi una postazione
offline può incassare da chi non doveva nulla, la riga esiste, è marcata, ed è **lasciata allo
staff** — e questo pannello, che è il posto dove lo staff la risolverebbe, non si disegna.

L'interfaccia fa sparire in silenzio esattamente ciò che il backend si impegna a non far
sparire, e contraddice la docstring dello store («una riga è un fatto … si corregge con una
riga che la contraddice, non facendola sparire»).

**Correzione**: `bal.dueAmount > 0 || bal.settlements.length > 0`.

### 2. `loadBalance()` inghiotte ogni errore

`registration-detail.component.ts:699`

Il `catch` nudo è giustificato in commento con il `403` di chi non tiene la cassa — ma quel caso
è già intercettato dall'uscita anticipata su `canSettle()` alla riga 687: la chiamata non parte
nemmeno. Restano quindi i guasti veri (5xx, rete caduta, payload malformato), e su ognuno il
pannello sparisce — che su questa pagina si legge come «questa persona non deve nulla».

Peggiora sul percorso dopo l'incasso (riga 756): si mostra il toast «Incasso registrato» e poi
si ricarica; se la ricarica fallisce, la sezione in cui si stava lavorando svanisce senza una
parola.

**Correzione proposta dal revisore**: restringere il `catch` e rilanciare —
`if (!(err instanceof ApiError && err.kind === 'forbidden')) throw err;`.

⚠️ **Non applicata in questa forma, ed è una correzione della correzione.** `loadBalance()` è
atteso in `ngOnInit`: un'eccezione che si propaga lì impedisce `registerActions()`, e la scheda
resta senza **nessuno** dei suoi comandi — anche quelli che col saldo non c'entrano. Nel secondo
punto di chiamata sarebbe pure peggio: `onSettleAction()` la catturerebbe nel proprio `try` e
mostrerebbe «Incasso non registrato» su un incasso che invece è stato registrato benissimo.

**Applicato**: un segnale `balanceError` e una sezione che dice il guasto — «non significa che
non deve nulla, significa che non lo sappiamo». Il `403` resta l'unico caso che si nasconde.

### 3. `deviceId` è una pill di metadato invece che una pill d'identificativo

`registration-detail.component.ts:359` — `KEIJO-LIST-VALUE-USES-KEIJO-COMPONENT`

`deviceId` è un codice, ed è precisamente il valore che si copia per chiedere conto di un
doppio incasso. Va reso con `[isID]` e `contentCopy`. Aggravante: porta `balanceIcon`
(`payments`), la stessa icona della pill del metodo dieci righe sopra — la stessa riga può
mostrare due pill identiche che significano «come ha pagato» e «a quale postazione».

### 4. Tre metodi di pagamento su cinque hanno la stessa icona

`enums.ts:403-406` — `KEIJO-PILL-ICON-SEMANTIC`

`POS`, `SATISPAY` e `OTHER` usano tutti `payments`: l'icona non porta informazione e si torna a
leggere il testo. `REGISTRATION_CHANNEL_UI`, dieci righe sopra, fa la cosa giusta con quattro
icone distinte su quattro valori.

**Correzione**: `POS → creditCard`, `SATISPAY → qrCode`, `payments` resta a `OTHER`. Verificate
presenti in `@keijo/ui/icons`.

### 5. La pill «dalla coda offline» indossa l'orologio del timestamp

`registration-detail.component.ts:362` — `KEIJO-PILL-ICON-SEMANTIC`

`clockIcon` (`schedule`) è già usato dieci righe prima per `collectedAt`. Due pill affiancate
con lo stesso orologio per «quando il denaro è passato di mano» e «questa riga viene dalla coda
offline», che è sincronizzazione e non tempo.

**Correzione**: `cloudOff`, dichiarata come campo distinto. Verificata presente.

## Rilievi non accolti

| # | rilievo | perché non si corregge qui |
|---|---|---|
| 6 | `KEIJO-DETAIL-EDIT-PER-SECTION` — l'avvio dell'incasso sta fra le azioni di testata invece che nel footer della sezione | **Preesistente e di pagina, non di questa modifica.** `Modifica` e `Riassegna` hanno la stessa forma: spostare il solo `Incassa` lascerebbe tre azioni sorelle, due in testata e una nel footer — più incoerente di adesso. Va affrontato sulla pagina intera, in un lavoro suo |
| 7 | `KEIJO-DETAIL-HEADER-TITLE-NEVER-ID` — il titolo resta «Iscrizione» e non diventa il nome | Preesistente, e **conforme alla lettera**: il titolo non mostra mai l'id, e «Iscrizione» è uno dei ripieghi che la regola stessa ammette. Segnalato come informativo dal revisore |

## Stato finale

**Rilievi 1→5 corretti**, su approvazione («tutte»). Gate 0 rieseguito: **verde**.

| # | correzione |
|---|---|
| 1 | `bal.dueAmount > 0 \|\| bal.settlements.length > 0` — il conflitto `NO_BALANCE_DUE` torna visibile |
| 2 | segnale `balanceError` e sezione d'errore, **non** un rilancio (vedi la nota sopra) |
| 3 | `<keijo-pill [isID]="true" [icon]="copyIcon">` — la forma è l'esempio `good` di `KEIJO-PILL-ICON-REQUIRED` alla lettera |
| 4 | `POS → creditCard`, `SATISPAY → qrCode`; `payments` resta solo su `OTHER` |
| 5 | `offlineIcon = cloudOff`, campo distinto dal `clockIcon` del timestamp |

Rilievi 6 e 7 **aperti e dichiarati**, entrambi preesistenti a questa modifica.

⚠️ Il gate 1 non è mai girato: quando `@keijo/cli` sarà raggiungibile, questa verifica va
rifatta per intero. Le regole strutturali risultano pulite alla lettura del revisore, non a un
exit-code.
