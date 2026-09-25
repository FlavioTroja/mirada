# Mirada Tango — Il calendario dell'organizzatore

Stato: **approvato** il 25 settembre 2026.

## 1. Il problema

Una scuola che tiene tre corsi, un open day a settembre e una milonga al mese non ha un posto
dove vedere **la propria settimana**. Le lezioni stanno dentro ogni corso, le sessioni dentro
ogni evento, e il resto — la riunione dello staff, le prove, la sala chiusa per pulizie — da
nessuna parte. Oggi la risposta a «cosa c'è martedì?» richiede di aprire ogni corso.

La sezione **Calendario** mette tutto su una griglia, nelle viste giorno, settimana e mese, con
l'aspetto e i gesti di Google Calendar, e permette di **creare da lì**, anche in serie («ogni
martedì alle 20:30»).

## 2. Decisioni del committente (25 settembre 2026)

| # | Tema | Decisione |
|---|---|---|
| K1 | L'open day | **Una lezione del corso**, segnata come open day. Nessuna entità nuova |
| K2 | Appuntamenti liberi | **Sì**: riunioni, prove, sala chiusa. Entità nuova, visibile al solo staff |
| K3 | Lezioni aggiunte in serie a un corso con titoli | **Entrano nei titoli che coprono già tutte le lezioni** del corso; gli altri restano come sono |
| K4 | Creare un festival dal calendario | **Apre la creazione evento esistente**, con date e orari già compilati |
| K5 | Collaboratori che modificano il calendario | **In tempo reale** per gli altri membri, sul WebSocket che c'è. Redis quando le istanze saranno più d'una (§6.1) |

## 3. Che cosa c'è sul calendario

| voce | da dove viene | come si vede |
|---|---|---|
| **Lezione** | `Session` di un evento di famiglia `COURSE`, `kind = REGULAR` | blocco orario, colore «lezione» |
| **Open day** | `Session` di un corso, `kind = OPEN_DAY` | blocco orario, colore «open day», etichetta |
| **Sessione di evento** | `Session` di un evento di famiglia `EVENT` (festival, milonga — anche l'implicita) | blocco orario, colore «evento» |
| **Evento su più giorni** | `Event` di famiglia `EVENT` | barra nella fascia «tutto il giorno», da `startAt` a `endAt` |
| **Appuntamento** | `Appointment` (nuovo) | blocco orario o barra «tutto il giorno», colore «appuntamento» |

- **I corsi non hanno la barra su più giorni**: un trimestre steso sopra dodici settimane copre
  la fascia alta per tre mesi e non dice niente. Si vedono le loro lezioni.
- **Bozze** a bordo tratteggiato; **annullate** barrate e sbiadite, non nascoste: la scuola deve
  vedere che il 12 la lezione salta.
- Sono visibili le sole organizzazioni in cui il ruolo concede la lettura (lo scope per
  permesso, commit `13f4d28`).

## 4. Il modello

### 4.1 `Session` — due colonne

```prisma
enum SessionKind {
  REGULAR
  /// Lezione di prova aperta a chi non è iscritto. Solo sui corsi (`19-prospect.md`).
  OPEN_DAY
}

model Session {
  …
  kind     SessionKind @default(REGULAR)
  /// Le occorrenze nate dalla stessa ripetizione. Nullo = sessione singola.
  seriesId String?     @db.Uuid
  @@index([seriesId])
}
```

- `OPEN_DAY` è ammesso **solo** su un corso (`family = COURSE`): il server rifiuta con `400`.
- Un open day **non entra mai in automatico in un titolo** (K3 lo esclude) e **non conta** nel
  calcolo di «copre tutte le lezioni»: è di prova, non parte del trimestre.
- `Prospect` resta legato al corso, non alla sessione. Agganciarlo all'open day preciso è un
  passo successivo e non serve ora.

### 4.2 `Appointment` — entità nuova

```prisma
model Appointment {
  id             Int      @id @default(autoincrement())
  organizationId Int
  title          String
  note           String?
  startAt        DateTime
  endAt          DateTime
  allDay         Boolean  @default(false)
  venueId        Int?     // la sala, facoltativa, dalla rubrica
  room           String?
  seriesId       String?  @db.Uuid
  createdById    Int
  deleted        Boolean  @default(false)
  @@index([organizationId, startAt])
  @@index([seriesId])
}
```

`title` è testo semplice, non `I18nText`: un appuntamento interno non va mai in pubblico.

Permessi (`APPOINTMENT`): `OWNER` ed `EVENT_MANAGER` tutto, `BOX_OFFICE` e `CHECKIN_OPERATOR`
in lettura. Il seed li scrive al primo avvio: non serve SQL.

### 4.3 La migrazione

`20260925…_calendario`: una enum, due colonne con default, una tabella, tre indici.
**Solo aggiunte**, nessuna colonna tolta: il rollback dell'immagine resta possibile.

## 5. La ripetizione

Resta vera la scelta di `15-corsi.md` §2.3: **nessuna regola di ricorrenza nello schema**.
«Ogni martedì alle 20:30 fino al 16 dicembre» **genera le singole righe**, legate da `seriesId`.
Ogni lezione resta una `Session` normale: titoli, check-in, capienza e annullamento non cambiano.

```ts
recurrence?: {
  weekdays: (1|2|3|4|5|6|7)[];          // lun = 1
  until?: string;                        // data, inclusa
  count?: number;                        // in alternativa a until
}
```

- **L'ora è locale, non UTC.** Il calcolo avviene in `Europe/Rome` (luxon, già fra le
  dipendenze). Il 25 ottobre 2026 finisce l'ora legale: una serie del martedì alle 20:30 deve
  restare alle 20:30 prima e dopo. Sommando sette giorni in UTC slitterebbe di un'ora, e nessuno
  se ne accorgerebbe prima della lezione.
- **Tetto: 104 occorrenze** (due anni di un giorno a settimana). Oltre, `400` con il motivo.
- **Tutto o niente**: le occorrenze nascono in una transazione. Metà serie non esiste.

### 5.1 Modificare ed eliminare una serie

Come Google: «**Solo questo** · **Questo e i successivi** · **Tutti**».

| scelta | effetto |
|---|---|
| solo questo | la riga esce dalla serie (`seriesId = null`) e cambia da sola |
| questo e i successivi | cambia l'ora e la durata delle occorrenze da questa in poi, **ciascuna nel suo giorno** |
| tutti | come sopra, su tutta la serie |

Si propagano l'**ora**, la **durata**, il **nome**, la **sala**. Il giorno no: spostare «tutte
le lezioni al mercoledì» è cancellare e ricreare, e va detto così all'utente, non indovinato.

Eliminare le lezioni segue le regole della singola sessione, ma **le occorrenze già passate e
quelle con check-in non si eliminano**: vengono saltate e la risposta dice quante.

### 5.2 I titoli (K3)

Quando nascono lezioni `REGULAR` in un corso, il server le aggiunge a **ogni titolo che
comprende già tutte le lezioni `REGULAR` vive** del corso (almeno una). «Lezione singola» non le
comprende tutte e resta com'è; «Trimestre intero» sì, e si allunga.

La risposta elenca i titoli toccati, e il calendario lo dice: «Aggiunte 8 lezioni. Il titolo
*Trimestre intero* ora le comprende». Un titolo che cambia senza che nessuno lo sappia sarebbe
un difetto, anche se la regola è giusta.

## 6. API

| rotta | permesso | cosa |
|---|---|---|
| `POST /sessions/calendar` | `READ#SESSION#ALL` | sessioni nell'intervallo `{from, to}`, con evento, famiglia, stato, sede |
| `POST /events/calendar` | `READ#EVENT#ALL` | eventi `EVENT` su più giorni che toccano l'intervallo |
| `POST /appointments/calendar` | `READ#APPOINTMENT#ALL` | appuntamenti nell'intervallo |
| `POST /sessions/schedule` | `CREATE#SESSION#ALL` | una sessione o una serie (`kind`, `recurrence`) → `{ sessions, extendedTicketTypes }` |
| `PATCH /sessions/:id/series` · `DELETE /sessions/:id/series?scope=` | `UPDATE`/`DELETE#SESSION#SINGLE` | `scope: 'FOLLOWING' \| 'ALL'` |
| `POST /appointments/schedule` · `GET`/`PATCH`/`DELETE /appointments/:id` · `…/:id/series` | `APPOINTMENT` | come sopra |

- Intervallo massimo **45 giorni**: un mese più le code della griglia. Oltre, `400`.
- Tre chiamate e non una: ogni permesso decide il proprio scope (commit `13f4d28`). Con un
  endpoint unico il permesso dichiarato sarebbe uno solo, per tre cose diverse.
- **`CalendarController` non esiste**: le rotte stanno nei controller delle rispettive entità.
  `AppointmentController` è nuovo, ed è registrato in `src/server.ts`.
- **`POST /sessions/create` resta com'è**, e le lezioni create da lì non entrano da sole nei
  titoli: la scheda sessioni del corso ha già il suo avviso delle sessioni orfane, e cambiarne
  il comportamento non era chiesto. Il calendario usa sempre `/schedule`, anche per «non si
  ripete», così una lezione creata dal calendario si comporta allo stesso modo da sola o in
  serie.
- «Solo questo» è il `PATCH` della riga con `seriesId: null`, che la fa uscire dalla serie.

### 6.1 In tempo reale

Quando un collaboratore crea, sposta, annulla o elimina una lezione, una sessione, un evento o un
appuntamento, i membri dell'organizzazione ricevono `calendar/changed` sul WebSocket, con il
periodo toccato. Chi ha aperto quel periodo rilegge; chi guarda un'altra settimana no.

Il segnale non porta dati (titoli, note): un fotogramma non passa dal controllo di permesso della
rotta. Parte **dopo** la scrittura, fuori dalla transazione.

**Redis non serve ora.** Oggi il backend è un processo solo, e il segnale raggiunge tutti. Con due
istanze, chi è collegato alla prima non vedrebbe ciò che accade sulla seconda: lì entra il pub/sub
di Redis, **dentro l'adattatore** `WsPublisherService`, dietro la porta `EventPublisher`. I servizi
che pubblicano, calendario compreso, non cambiano. Il momento è quello della chat dei ballerini.

## 7. Il back-office — `/calendar`

Voce di menu **Calendario** (`calendarMonth`), subito dopo la Dashboard. Capacità `calendar`
(lettura, tutto lo staff) e `calendarWrite` (`OWNER`, `EVENT_MANAGER`).

### 7.1 La pagina

```
┌ Calendario ─────────────────────────────────────────────── [+ Nuovo] ┐
│ [Oggi]  ‹  ›   settembre – ottobre 2026        [Giorno|Settimana|Mese] │
│ ● Lezioni  ● Open day  ● Eventi  ● Appuntamenti          (chip-legenda) │
├──────┬─────────┬─────────┬─────────┬─────────┬─────────┬──────┬──────┤
│      │ LUN 28  │ MAR 29  │ MER 30  │ GIO 1   │ VEN 2   │ SAB 3│ DOM 4│
│ tutto│         │         │         │ ▬▬▬▬ Tango Festival Bari ▬▬▬▬▬▬ │
│ 19:00│         │┌───────┐│         │         │         │      │      │
│ 20:00│         ││Princip.││         │┌───────┐│         │      │      │
│ 21:00│ ────────┼┤ 20:30 ├┼──── ora ─┤│Riunion││         │      │      │
└──────┴─────────┴─────────┴─────────┴─────────┴─────────┴──────┴──────┘
```

- **Header**: titolo «Calendario» (`HeaderTitleService`), azione primaria **Nuovo**
  (`PageActionsService`), che apre il popup sulla prossima mezz'ora libera.
- **Barra**: `Oggi`, frecce, periodo in chiaro, selettore di vista. Le chip dei tipi sono
  **additive e fanno da legenda**: ognuna porta il pallino del suo colore.
- **Settimana e giorno**: griglia oraria 0–24 che si apre sulle 8, fascia «tutto il giorno» in
  alto, linea dell'ora corrente, sovrapposizioni affiancate come in Google.
- **Mese**: sei righe, fino a tre voci per giorno e «+N altri», che apre il giorno.
- **Sotto i 768px** la vista predefinita è Giorno. La settimana resta scelta a mano.
- **Tastiera** come Google: `t` oggi, `g`/`s`/`m` le viste, frecce per il periodo.

### 7.2 Creare

Come Google Calendar. Un **clic** su uno spazio vuoto apre subito il popup accanto alla mezz'ora
cliccata; **trascinare** in verticale sceglie l'intervallo. Nella griglia compare un blocco
provvisorio, «(Senza titolo) 15:00 – 16:00», che prende titolo, orario e colore mentre si scrive.
«Nuovo» nella testata fa lo stesso sulla prossima mezz'ora di oggi.

Il popup, dall'alto:

1. **Il titolo**, grande e con il cursore già dentro. Per una lezione o un open day il titolo è il
   **corso**, e al suo posto c'è la scelta del corso.
2. **Le schede**: Lezione · Open day · Appuntamento · Evento. Senza corsi aperti si parte
   dall'appuntamento.
3. **Una riga «quando»**: «Venerdì 9 ottobre 15:00 – 16:00 · Non si ripete». Un clic, o «Altre
   opzioni», la apre in campi: giorno, inizio e fine (una fine che precede l'inizio è il giorno
   dopo), «tutto il giorno» per gli appuntamenti, e la **ripetizione**.
4. Nome della lezione, sala, note.
5. **Salva**; Invio nel titolo salva.

**Ripeti**: «Non si ripete» · «Ogni settimana di giovedì» (il giorno scelto) · «Personalizza…»
(giorni della settimana; quello scelto è sempre compreso, altrimenti il server rifiuterebbe la
serie). Termina «fino al» una data oppure «per N volte». Sotto, in chiaro: «*12 lezioni, dall'8
ottobre al 24 dicembre*». L'open day non si ripete. La scheda **Evento** non ha campi: porta a
`/events/new?startAt=…&endAt=…`, che li legge e li precompila (K4).

**I campi hanno il riquadro del tema, non la sola riga di Google**: `shared/mirada-theme.scss`
impone con `!important` un confine a 3:1 su ogni campo (WCAG 1.4.11). Un campo senza confine non
si distingue dallo sfondo, e quella regola vince apposta.

### 7.3 Vedere, modificare, eliminare

**Clic** su una voce: scheda compatta come in Google, con titolo, orario, ripetizione in chiaro
e sala. Il corso o l'evento compare come pill `filled` cliccabile che porta alla sua scheda
sessioni (`/courses/:id/sessions`, `/events/:id/sessions`). Pulsanti in ordine
**elimina → modifica**, solo per chi può scrivere. Su una serie, entrambi chiedono prima «solo
questa / questa e le successive / tutte» (`ModalService`); «solo questa» fa uscire la voce dalla
serie. La sessione implicita di una milonga singola si sposta ma non si elimina: è il contenitore
del check-in. Un evento su più giorni non si modifica da qui: si apre la sua scheda.

Le sessioni di un **evento** si modificano dal calendario solo per l'orario e la sala. Tutto il
resto sta nella scheda dell'evento, dove c'è il contesto per deciderlo.

### 7.4 Deviazioni dichiarate dalla procedura keijo

- **Griglie fatte a mano**, non `keijo-event-calendar`: quel componente è un mese a pallini
  senza voci né orari, e il requisito è Google Calendar. Le griglie usano i token del tema
  (`--mirada-violet`, `--mirada-plum`, …) e il chiaro/scuro di `data-theme`.
- **Il popup di creazione è un form fuori dalla pagina.** È l'eccezione documentata del
  calendario: l'azione è legata allo spazio cliccato, non globale.
- Il documento `init` di keijo e il comando `keijo-fe add-feature` non ci sono in questo
  progetto: la struttura segue le pagine esistenti (standalone, OnPush, signal store).

## 8. Fuori da questo taglio

| cosa | perché |
|---|---|
| Trascinare per **spostare** o **ridimensionare** | Su una lezione venduta sposta l'orario a chi ha pagato. Va pensato con le notifiche agli iscritti |
| Ripetizione mensile o giornaliera | Nessuno l'ha chiesta; il modello la regge quando servirà |
| Prospect legato all'open day preciso | §4.1 |
| Esportazione iCal / Google Calendar dello staff | Utile, separata |
| Calendario del ballerino nell'app | È un'altra superficie, con altre regole di visibilità |

## 9. Il lavoro, in tre consegne

Ogni consegna viene committata, costruita e distribuita da sola.

1. **Backend**: migrazione, `SessionKind` e serie, `Appointment`, generazione delle occorrenze
   in `Europe/Rome`, estensione dei titoli, tre rotte `calendar`, permessi.
   **Prove**: serie a cavallo del 25 ottobre (l'ora non slitta); titolo «tutte» esteso e
   «singola» no; open day rifiutato su un festival; serie oltre 104; scope per ruolo;
   modifica «questo e i successivi».
2. **Back-office, lettura**: voce di menu, viste giorno, settimana e mese, chip-legenda, scheda
   della voce, navigazione verso corso ed evento.
3. **Back-office, scrittura**: popup di creazione con ripetizione, modifica ed eliminazione per
   serie, `events/new` che legge le date dall'URL.
   **Verifica**: nel browser, su `127.0.0.1`, creando una serie reale.
