# Mirada Tango — I prospect dell'open day

**Data** 24 settembre 2026 · Richiesta del committente · Estende `15-corsi.md`

---

## 1. Il problema

All'inizio di un corso la scuola fa un open day. Qualcuno viene a provare e non si iscrive:
sono contatti buoni, e l'unico momento in cui ricontattarli ha senso è **l'apertura del corso
successivo**. Oggi finiscono su un foglio, e il foglio si perde.

## 2. Le tre decisioni del committente

| # | Domanda | Risposta |
|---|---|---|
| P1 | Come si contattano | **Dall'elenco, con i mezzi della segreteria**: email copiate, WhatsApp, telefono, CSV. Mirada non invia messaggi |
| P2 | Chi li inserisce | **Solo lo staff**, dal back-office. Nessun modulo pubblico |
| P3 | A cosa appartiene il prospect | **Al corso** di cui ha seguito l'open day |

P1 tiene fuori dal perimetro testi, disiscrizioni e invii: se un giorno servirà l'email dalla
piattaforma, si aggiunge sopra questo elenco senza toccarlo.

## 3. La forma

`Prospect` è un'entità a sé, **dell'organizzazione**, con il corso di provenienza.

Non è un'iscrizione, che ha un titolo e un ruolo assegnato. E non è una `Person`: l'anagrafica
globale non ha filtro di tenancy e pretende un'email unica, mentre un prospect è un contatto
che **la scuola** ha raccolto — nessun'altra organizzazione deve vederlo — e spesso ha solo il
telefono.

- **Recapito**: email o telefono, almeno uno. Un contatto che non si può contattare non è un
  contatto.
- **Consenso obbligatorio**, e il server ne scrive la data (`consentAt`). Senza consenso un
  contatto non si raccoglie per ricontattarlo: la colonna è ciò che lo dimostra.
- **Cancellazione vera**, non soft: chi chiede di essere tolto va tolto. Nessuna colonna
  `deleted`.
- **Permessi**: `OWNER` ed `EVENT_MANAGER`. Né la porta né la cassa hanno ragione di leggere il
  telefono di un contatto.
- Solo sui corsi (`EventTypeFamily.COURSE`): un festival non ha open day.

## 4. Stato dichiarato e fatto trovato

La segreteria **dichiara** uno stato: *da ricontattare*, *contattato*, *non interessato*.

«**Iscritto**» non è fra questi: è un **fatto**, e lo trova il server. Quando qualcuno guarda
l'elenco, ogni prospect non ancora convertito e con un'email viene confrontato con le
iscrizioni vive (`CONFIRMED`, `TO_CONFIRM`) presso la stessa organizzazione, a eventi che
finiscono dopo il giorno in cui il contatto è stato raccolto. Se ne trova una, il prospect punta
a quell'iscrizione (`convertedRegistrationId`) ed esce dall'elenco da chiamare.

- **In lettura, e non all'iscrizione**: un'iscrizione nasce da quattro strade — segreteria,
  checkout, porta, canali esterni — e agganciarne una sola vorrebbe dire che le altre tre non
  convertono, senza che nulla fallisca.
- **Solo l'email**, senza maiuscole. Il telefono no: un numero digitato in due modi non si
  confronta, e un falso positivo toglierebbe dall'elenco qualcuno da chiamare.
- Se l'iscrizione viene cancellata, il legame cade (`SetNull`) e il prospect torna da lavorare.

## 5. Il back-office

- **Scheda «Open day»** nel workspace del corso (`/courses/:id/prospects`): si raccolgono i
  contatti sul corso, e si vede chi di loro si è poi iscritto.
- **Voce «Prospect»** (`/prospects`): l'elenco della scuola, aperto su «Da ricontattare»,
  filtrabile per stato e per corso. Dall'intestazione: *copia email* (senza gli iscritti, da
  incollare in Ccn), *esporta CSV* (punto e virgola e BOM, per Excel in italiano), *segna
  contattati* tutti quelli in elenco, con la data di oggi.
- Su ogni riga: email, WhatsApp, chiamata, «contattato», modifica, elimina.

## 6. API

| Rotta | |
|---|---|
| `POST /prospects/create` | `sourceEventId`, nome, recapiti, `consent: true` |
| `POST /prospects/` | paginato; filtri `value`, `sourceEventId`, `status`, `converted` |
| `GET /prospects/:id` | |
| `PATCH /prospects/:id` | scalari propri e stato; `contactedAt` lo scrive il server |
| `POST /prospects/mark-contacted` | `{ ids }` — tutti nello scope, o nessuno |
| `DELETE /prospects/:id` | cancellazione vera |
