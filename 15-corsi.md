# Mirada Tango — Corsi e iscrizioni

**Data** 4 settembre 2026 · Estende la fase B (evento) e il registro di cassa di `14` ·
**Non riapre** l'esclusione del tesseramento di `06` §B1: la aggira restando dalla parte giusta

---

## 1. Il problema

Le scuole di tango sono lo stesso pubblico che già organizza gli eventi, con un'altra attività
accanto: corsi che durano un trimestre, una lezione a settimana, un gruppo per livello. Oggi
quell'attività vive su un foglio di calcolo, e la scuola che usa Mirada per il festival torna al
foglio il lunedì.

Il committente ha circoscritto la richiesta, e il taglio è ciò che rende questo documento breve:

| serve | non serve |
|---|---|
| definire i corsi, con le loro lezioni | il registro presenze |
| iscrivere l'allievo a un corso | l'incasso in piattaforma |
| segnare che ha pagato, **con la data** | il tesseramento |

Le tre cose che restano fuori non sono dimenticanze: due sono decisioni già prese altrove, la
terza è una rinuncia esplicita del committente. Il §8 le dichiara una per una.

### 1.1 Perché non riapre il tesseramento

`06-audit-analisi.md` §B1 chiude il tesseramento **per esclusione dallo scopo**, e
`10-briefing-verifica-fiscale.md` §1 lo dichiara al commercialista come premessa
dell'inquadramento: «il tesseramento associativo resta fuori dalla piattaforma».

Questo documento non tocca quella decisione, e va detto perché — la vicinanza dei due temi è
sufficiente a far credere il contrario. Qui **non** si emette una tessera, **non** si vende una
quota associativa, **non** si verifica chi è socio. Si registra un'iscrizione a un corso, che è
lo stesso oggetto di un'iscrizione a uno stage, e si prende nota di un pagamento avvenuto
altrove.

> **Mirada non incassa la quota del corso. Registra che è stata pagata.**

È la stessa frase di `14` §6.2 (`RB26`) con un soggetto diverso, e non è un caso: è **lo stesso
meccanismo**. Il residuo che nasce da un acconto su Shopify e la quota di un corso pagata in
contanti in segreteria sono, per la piattaforma, la medesima cosa — qualcuno deve dei soldi a
qualcun altro, e Mirada tiene il registro senza toccarli.

### 1.2 Il segmento che questo taglio non serve, dichiarato

Tre forme di vendita sono **la** leva commerciale delle scuole e qui non ci sono. Vanno nominate
adesso, perché il rischio è promettere «Mirada gestisce i corsi» a un cliente che intende una
di queste:

- **Il carnet** — «dieci lezioni da usare quando vuoi». `06` §B8, aperto. È un titolo a scalare,
  e il modello attuale è costruito per l'esatto contrario: `09` §7 dichiara che l'utilizzo non è
  uno stato del biglietto e che uno stato `USED` non deve esistere.
- **L'abbonamento ricorrente** — addebito mensile, sospensione, disdetta. Q60 del questionario,
  mai risposta. Il checkout è one-shot.
- **La progressione tra corsi** — vedi §5.2.

---

## 2. Un corso è un evento, e le lezioni sono le sue sessioni

### 2.1 La forma — `RF-COR-1`

Nessuna entità nuova. La struttura esiste già per intero e regge senza forzature:

```
EventType  «Corso»            capMultiSession · capRoleQuotas · capLevels
   └─ Event  «Corso Principianti — autunno 2026»
        ├─ Session ×12         «Lezione 1» … «Lezione 12»
        ├─ TicketType          «Trimestre intero»       basePrice
        │    └─ TicketTypeSession ×12   (elenco esplicito)
        ├─ CapacityQuota       scope EVENT · role LEADER   · limit
        ├─ CapacityQuota       scope EVENT · role FOLLOWER · limit
        └─ Registration ×N     ← l'allievo iscritto
             └─ BalanceSettlement ×M    ← la spunta «pagato», con la data
```

Un secondo `TicketType` «Lezione singola», legato a **una** `TicketTypeSession`, dà il drop-in
senza aggiungere struttura.

Due cose che si ottengono senza averle chieste, e che valgono più della funzione richiesta:

- **L'equilibrio della classe.** Due `CapacityQuota` per ruolo su ambito evento sono «massimo
  dodici leader e dodici follower», con impegno atomico. Per una scuola di tango lo sbilancio è
  *il* problema gestionale, ed è la parte più collaudata del sistema (`05` per intero).
  `Registration.declaredRole` è già obbligatorio: il dato non va aggiunto, c'è.
- **Un'iscrizione per persona per corso**, garantita dall'unico su `(eventId, personUserId)`.
  Chi si reiscrive il trimestre successivo genera un'iscrizione nuova su un evento nuovo, che è
  la forma corretta e non una limitazione.

### 2.2 Il tipo «Corso» è catalogo di piattaforma — `RF-COR-2`

`EventType` è un catalogo a scrittura **riservata a `GOD`** (§4.1,
`controllers/EventTypeController.ts:16`). Il tipo «Corso» si semina **una volta sola**, e non è
la scuola a crearlo.

Non è un attrito da correggere: è la stessa disciplina che tiene i tipi evento coerenti su tutta
la piattaforma. Una scuola che potesse inventarsi un tipo evento produrrebbe, in sei mesi,
quattro varianti di «corso» che nessun cruscotto sa più sommare.

### 2.3 Perché non una serie ricorrente

Nello schema non esiste alcuna ricorrenza — nessuna `Series`, nessuna `rrule`. Un corso
trimestrale come `Event` con dodici `Session` **è la modellazione corretta**, non un ripiego: il
corso ha un inizio, una fine, un listino e un gruppo chiuso di iscritti. È un evento lungo.

Il limite si vede altrove, e va saputo: **la milonga del giovedì tutto l'anno** diventerebbe un
evento con cinquanta sessioni, e lì il ciclo di vita (`PUBLISHED → RUNNING → ENDED`), la
chiusura vendite e la scheda pubblica assumono un evento delimitato che quello non è. Fuori da
questo taglio (§8).

---

## 3. L'iscrizione a listino

### 3.1 Un endpoint nuovo, non il checkout — `RF-COR-3`

`POST /registrations/enrol`. Ricalca `PassIssuanceService.issue()`, che fa già quasi
esattamente questa cosa: in **una** transazione crea l'iscrizione e poi impegna la capienza.

La strada del checkout — `Order`, `Reservation`, `confirm-free` con `offPlatformPayment` — è
stata valutata e scartata. Esiste, è ben presidiata, e produrrebbe pure una riga `Payment` con
la data. Ma trascina dietro **una prenotazione viva da quindici minuti**: macchinario nato per
difendere l'ultimo posto da due acquirenti simultanei, che su un modulo compilato in segreteria
è solo attrito.

`assertWritableEvent` (`services/RegistrationService.ts:314`) verifica **solo** che il chiamante
possa scrivere su quell'evento: non guarda lo stato, non guarda la chiusura vendite. È già la
porta d'ingresso manuale che serve, e il §5 spiega perché è esattamente la proprietà che conta.

### 3.2 Il prezzo lo risolve il server — `RF-COR-4`

`RegistrationCreateDTO` **esclude apposta** `balanceDueAmount`, con una motivazione scritta nel
DTO:

> *«Un'iscrizione creata da fuori con un residuo già dentro sarebbe un debito che nessuna
> vendita ha prodotto.»*

La regola non è «nessuno può nascere con un residuo»: è **il client non può dichiarare un
debito**. Il debito deve venire da una vendita. E un'iscrizione a un corso a listino *è* una
vendita — solo registrata a mano.

Quindi il DTO di questo endpoint porta **`ticketTypeId`, mai un importo**, e il servizio
risolve il prezzo con `TicketTypeService.resolvePrice()` — lo stesso che alimenta la
disponibilità pubblica, così il listino mostrato e quello addebitato non possono divergere. Gli
scaglioni (`PriceTier`, iscrizione anticipata) funzionano di conseguenza, senza codice in più.

L'invariante regge nella sua forma originale. Non va allentata, va soddisfatta.

### 3.3 L'impegno di capienza non è opzionale — `RF-COR-5`

**È la trappola di questo documento**, ed è del tipo che il repository conosce già: qualcosa che
compila, non fallisce, e non c'è.

`RegistrationService.save()` **non impegna la capienza**. La commit vive in
`OrderFulfilmentService.fulfil`, cioè sulla strada del checkout. Un'iscrizione creata a mano
senza chiamare il motore non compare in **nessun** contatore: le quote per ruolo restano a zero,
il cruscotto mostra una classe vuota, e lo sbilancio — che è la ragione per cui le quote
esistono — diventa una cifra falsa proprio dove serve.

L'endpoint chiama `commitWithoutBlocking`, non `commit`. È la scelta di `RB20`, per la stessa
ragione: un'iscrizione fatta dalla segreteria non deve essere **rifiutata** perché la classe è
piena. Si registra il consumo, si restituisce l'avviso, si procede — e decide l'insegnante, che
è l'unico a sapere se in sala ci sta un'altra coppia.

### 3.4 Nessun biglietto — `RF-COR-6`

L'iscrizione a un corso **non emette `Ticket`**. Non serve il QR, perché il registro presenze è
fuori dal taglio, e un titolo firmato che nessuno scansiona è lavoro speso per niente.

Regge senza adattamenti perché il grafo era già disegnato così: `CommitItem` porta
`ticketTypeId` e non pretende una riga `Ticket`, e la decisione A5 di `06` tiene separati il
titolo economico e la persona nell'evento — *«una iscrizione per persona per evento, con più
biglietti collegati. Consumi di capienza, requisiti, ruolo e presenze sull'iscrizione; valore
economico e trasferibilità sul biglietto»*. Qui è il caso limite di quella separazione: **zero**
biglietti e una iscrizione, con i consumi di capienza al loro posto.

Le due pagine di `pages/registrations/` non nominano mai il biglietto: un'iscrizione senza
titolo si visualizza già correttamente. Il giorno in cui servirà il check-in, si emette il
titolo e nulla a valle cambia.

### 3.5 Nessun diritto di prevendita — `RF-COR-7`, `RB29`

`OrderPricingService.priceLine()` risolve il prezzo **e** aggiunge `presaleRightsPerUnit`. Su
questa strada **non va riusato**: si chiama `resolvePrice()` direttamente, che è il livello
giusto.

Non è un'ottimizzazione, è una conseguenza di `RB26`. I diritti di prevendita sono il compenso
per aver messo a disposizione il canale e trattenuto la quota sulla transazione. Qui non c'è
transazione: il denaro non è mai passato da Mirada. Una fee su contante che la piattaforma non
ha toccato non avrebbe da dove essere trattenuta, e comparirebbe come un credito verso
l'organizzatore che nessuno ha pattuito.

### 3.6 Chi è la persona iscritta — rinvio a `16`

Il servizio descritto qui crea l'iscrizione con `holderName`, `holderSurname` e `holderEmail`
come testo, e **non collega alcuna anagrafica**: è il comportamento di oggi di ogni via manuale.

`16-anagrafica-unica.md` lo cambia — `enrol()` risolve l'email verso l'anagrafica globale, e la
crea in forma provvisoria se non esiste. Il presente §3 resta valido nella sequenza e nel
calcolo del dovuto; **cambia solo che l'iscrizione nasce con un `personId`** invece che con tre
stringhe. Se i due documenti si realizzano insieme, si scrive direttamente la forma di `16`.

---

## 4. La spunta «pagato»

### 4.1 È il registro di `14`, senza modifiche — `RF-COR-8`

Con `balanceDueAmount` valorizzato al §3.2, `BalanceSettlementService.save()` **funziona così
com'è**: la guardia `balanceDueAmount <= 0` — «questa iscrizione non ha un saldo da versare» —
semplicemente non scatta più.

La riga porta già tutto ciò che la richiesta chiede, e altro: `collectedAt` (la data), `method`,
`operatorUserId` (chi ha segnato), `note`. Il `deviceId` è nullo, che è esattamente il caso
previsto da `RF-SAL-10` — *«il saldo anticipato dal back-office è una riga come le altre ma non
nasce a una porta»*.

Anche l'interfaccia si riusa senza modifiche: `BALANCE_SETTLEMENT_METHOD_UI` e il pannello di
`registration-detail.component.ts` sono già la spunta che serve.

### 4.2 Le rate escono gratis

Non erano state chieste, e arrivano comunque: il residuo aperto è
`balanceDueAmount − balanceSettledAmount`, il contatore si muove solo per `increment`, e le
righe possono essere molte. Due bonifici a novembre e a gennaio sono due righe, e il residuo si
chiude da sé.

È la disciplina di `14` §5.2, ereditata intatta: **la somma delle righe è il contatore, sempre.**

### 4.3 Che cosa questa spunta non è

Vale la pena riscriverlo qui, perché il contesto è cambiato e la regola no. Nessuna riga
`Payment` nasce da un'iscrizione a un corso. Queste righe non compaiono nei rendiconti degli
incassi Mirada, non producono ricevuta, non aprono un flusso di pagamento. Gli adempimenti
fiscali sulla quota del corso — ricevuta, corrispettivi, eventuale natura associativa —
**restano interamente della scuola**, come già oggi per il contante alla porta.

Mirada le dà il registro. Non le fa da cassiere, e non le fa da commercialista.

---

## 5. Due attriti dichiarati

### 5.1 Le vendite online chiudono all'inizio del corso — `RF-COR-9`

`EVENT_START` resta **sempre** attivo come ultimo criterio di chiusura vendite (`RF-EVT-40`).
Un corso che parte in ottobre chiude le iscrizioni online alla prima lezione, e le scuole
accettano il ritardatario alla terza settimana come pratica normale.

Non è un blocco, e **non è nemmeno un aggiramento**: `RF-EVT-41` lo dichiara già come regola —
*«`vendita_chiusa` chiude la **sola vendita online**: vendita alla porta ed emissione manuale di
pass restano possibili, coerentemente con `RB20`»*. L'iscrizione dal back-office è la terza voce
di quello stesso elenco, e il codice lo rispecchia: il presidio vive in `OrderService`, **non**
in `RegistrationService`.

Resta un attrito vero, ed è di prodotto e non di architettura: **non è self-service**. Il
ritardatario non si iscrive da solo, lo iscrive la segreteria. Va detto alla scuola invece che
scoperto da lei.

Non si tocca `RF-EVT-40` per questo caso: è la regola che impedisce di vendere l'ingresso a una
serata già cominciata, e vale molto più dell'attrito che produce qui.

### 5.2 Nessuna progressione tra corsi

Chi finisce Principianti e passa a Intermedi è un'iscrizione nuova su un evento nuovo, senza
alcun legame con la precedente. Non esistono prerequisiti, non esiste avanzamento, non esiste lo
storico dell'allievo attraverso i trimestri.

È l'unica assenza strutturale di questo taglio — tutto il resto è composizione di pezzi
esistenti. Se un giorno la scuola chiederà «chi ha già fatto principianti?», la risposta di oggi
è un filtro sulle iscrizioni passate, e la risposta vera è un'entità che qui non c'è.

---

## 6. Che cosa cambia, in breve

| dove | cambiamento |
|---|---|
| `EventType` | un tipo «Corso» nel seme di catalogo |
| **nuovo** | `POST /registrations/enrol` — iscrizione a listino dal back-office |
| `RegistrationService` | `enrol()`: risolve il prezzo, crea l'iscrizione con il dovuto, impegna la capienza |
| `BalanceSettlement` | **nessuna modifica** — la guardia esistente smette di scattare da sé |
| `pages/registrations/` | un'azione «Iscrivi allievo» con la scelta del titolo |
| Migrazioni | **nessuna** in questo taglio (`16` ne introduce una sua) |
| Anagrafica | il collegamento alla persona arriva da `16-anagrafica-unica.md` (§3.6) |

---

## 7. Regole di business nuove

| # | Regola |
|---|---|
| **RB29** | **Un'iscrizione registrata non porta diritti di prevendita.** Dove la piattaforma non incassa, non trattiene |
| **RB30** | **Un'iscrizione creata dal back-office impegna sempre la capienza, senza mai esserne bloccata.** Come l'emissione manuale di pass (`RB20`): si registra, si avvisa, si procede |

---

## 8. Fuori da questo taglio

| funzione | perché resta fuori |
|---|---|
| **Registro presenze** | Rinuncia esplicita del committente. Va notato che `CheckIn` **è già** un registro presenze per lezione — riga sulla coppia titolo–sessione, offline, annullabile — e che riaprirlo costa l'emissione del titolo (§3.4) e tre semantiche nuove: assenza giustificata, recupero, lezione di prova |
| **Carnet a scalare** | `06` §B8. È un tipo di titolo nuovo accanto a `Ticket`, e contraddice l'invariante di `09` §7. Non è un campo in più |
| **Abbonamento ricorrente** | Q60, mai risposta. Il checkout è one-shot e non esiste addebito programmato |
| **Tesseramento e quota associativa** | `06` §B1, chiuso per esclusione. Rientrarci significa riaprire anche `06` §B2 — regime fiscale sull'organizzazione, imposta sulla riga, un terzo tipo di riga d'ordine — e rimettere in discussione le tre condizioni che reggono il posizionamento fiscale (`13` §3). Il sostituto è già dichiarato da `RF-REQ-2`: la scuola che deve accertare il tesseramento usa il requisito **dichiarazione**, e la piattaforma non tratta alcun dato associativo |
| **Certificato medico** | `RF-REQ-2` e `RF-REQ-3`: nessun upload, nessun dato sanitario, mai. È una linea deliberata, non una lacuna |
| **Milonga ricorrente come serie** | §2.3. Serve una ricorrenza vera, e il ciclo di vita dell'evento va ripensato con essa |
| **Progressione e storico dell'allievo** | §5.2 |
| **Riconoscimento del ballerino fra organizzazioni** | Non è fuori: è **rinviato a `16-anagrafica-unica.md`**, che lo risolve per tutte le vie manuali insieme e non per i soli corsi |
| **Ruolo «Maestro» con accesso proprio** | `02` §31 lo prevedeva già per questa fase. Oggi un insegnante che voglia operare sul proprio corso avrebbe bisogno di un ruolo sull'intera organizzazione: rientra quando servirà il registro presenze, non prima |

---

## 9. Decisioni prese

| # | Decisione | Esito |
|---|---|---|
| C1 | Un corso è un'entità nuova | **No.** È un `Event` con un `EventType` dedicato |
| C2 | Le lezioni | **`Session`**, elencate esplicitamente nel titolo via `TicketTypeSession` |
| C3 | Chi crea il tipo «Corso» | **`GOD`**, una volta. È catalogo di piattaforma |
| C4 | Come nasce l'iscrizione | **Endpoint dedicato**, non il checkout: niente ordine, niente prenotazione da quindici minuti |
| C5 | Chi decide il prezzo | **Il server**, da `resolvePrice()`. Il client porta il titolo, mai la cifra |
| C6 | `balanceDueAmount` dal client | **No**, e l'invariante non si allenta: il debito nasce dal listino |
| C7 | Impegno di capienza | **Sempre**, e **non bloccante** (`RB30`) |
| C8 | Emissione del biglietto | **No.** Zero biglietti, una iscrizione |
| C9 | Diritti di prevendita | **No** (`RB29`) |
| C10 | Dove vive la spunta «pagato» | **`BalanceSettlement`**, senza modifiche al servizio |
| C11 | Rate | **Sì**, come conseguenza. Non è una funzione da costruire |
| C12 | Riga `Payment` | **No.** Vale `RB26` senza eccezioni |
| C13 | Iscrizione dopo l'inizio del corso | **Sì da back-office**, no in self-service (§5.1) |
| C14 | Presenze, carnet, abbonamenti, tesseramento | **Fuori**, e dichiarati al §8 |

---

## 10. Il lavoro

| # | cosa | dove |
|---|---|---|
| 1 | Seme dell'`EventType` «Corso» — `capMultiSession`, `capRoleQuotas`, `capLevels` | `prisma/seed-data/` |
| 2 | `RegistrationEnrolDTO` — evento, titolo, anagrafica, ruolo dichiarato. **Nessun importo** | `DTOs/registration/` |
| 3 | `RegistrationService.enrol()` — le tre chiamate del §3, in una transazione | `services/RegistrationService.ts` |
| 4 | `POST /registrations/enrol` | `controllers/RegistrationController.ts` |
| 5 | Azione «Iscrivi allievo» con scelta del titolo e avviso di capienza | `pages/registrations/` |

Il riferimento da leggere prima di scrivere il punto 3 è `PassIssuanceService.issue()`: stessa
transazione, stessa sequenza, stesso impegno non bloccante. Cambia che al posto del biglietto
c'è un importo dovuto.
