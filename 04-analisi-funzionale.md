# Mirada Tango — Analisi Funzionale

**Versione** 1.1b · **Data** 31 luglio 2026 · **Stato** bozza per validazione

Documenti collegati: `00-questionario-analisi.md` (raccolta requisiti) · `01-decisioni-prese.md` (decisioni) · `02-matrice-ruoli.md` (ruoli e permessi) · `03-politica-rimborsi.md` (policy commerciale) · `05-modello-capienza.md` (motore di capienza) · `09-titoli-e-pass.md` (titoli e pass) · `11-chiusura-audit.md` (chiusura dei punti B3–C5)

*Revisione 1.1: recepite le decisioni sul flag `limitante` delle quote di sessione e sulla gestione della disponibilità parziale in checkout. Il motore di capienza è specificato nell'allegato `05-modello-capienza.md`.*

*Revisione 1.1b: recepiti i sedici punti chiusi in `11-chiusura-audit.md` — contestazioni di addebito, moderazione delle immagini, consenso dei terzi iscritti, abilitazione all'incasso, annullamento di singola sessione, minori, prova e presidio della wall, sblocco di sala, archivio, carrello multi-organizzatore, traduzioni, chiusura della vendita. Trentuno requisiti nuovi, tre regole di business nuove, quattro requisiti modificati. La rinumerazione continua degli identificativi è pianificata con la revisione 1.2 (C1).*

---

## 1. Sommario esecutivo

Mirada Tango è un **marketplace di eventi di tango argentino**: gli organizzatori pubblicano
milonghe, festival, marathon, encuentros e stage; i ballerini li scoprono, si iscrivono e
pagano online; lo staff gestisce l'accesso in sala; durante l'evento una **chat moderata
alimenta un maxischermo** proiettato in location.

L'analisi poggia su un principio emerso con chiarezza in fase di intervista e assunto come
vincolo architetturale: **l'organizzatore configura, la piattaforma non impone.** Tipi di
evento, quote di capienza, requisiti di partecipazione e servizi accessori non sono elenchi
fissi scritti nel codice, ma cataloghi estensibili che l'organizzatore compone quando crea
l'evento. È la scelta che consente di coprire con un solo modello una milonga del giovedì da
80 persone e un encuentro internazionale su tre giorni con ratio leader/follower vincolante,
e di aggiungere nuove tipologie in corso d'opera senza rilasci di sviluppo.

Tre caratteristiche distinguono il prodotto da un ticketing generalista:

1. **Il ruolo di ballo è un dato di primo livello.** Non è un campo descrittivo: governa la
   capienza. Un evento può essere pieno per i follower e aperto per i leader.
2. **L'iscrizione a coppia** è una transazione a due soggetti su un unico ordine.
3. **La chat con Live Wall** trasforma il biglietto in un accesso a un servizio digitale
   di sala, e apre la strada all'abbonamento premium del ballerino.

Il primo rilascio copre l'intero percorso dalla pubblicazione dell'evento al check-in in
sala, chat e wall inclusi. Corsi ricorrenti e lezioni private sono rinviati alla fase 2, con
modello dati già predisposto.

---

## 2. Contesto, obiettivi, perimetro

### 2.1 Obiettivi

| # | Obiettivo | Misura di successo proposta |
|---|---|---|
| OB1 | Portare online le iscrizioni oggi gestite con form e bonifici | ≥ 80% delle iscrizioni concluse online senza intervento manuale |
| OB2 | Azzerare la riconciliazione manuale degli incassi | Ogni incasso riconducibile a un ordine, zero fogli di calcolo paralleli |
| OB3 | Rendere gestibile la capienza per ruolo di ballo | Ratio leader/follower entro la tolleranza dichiarata su tutti gli eventi che la usano |
| OB4 | Ridurre i tempi di ingresso in sala | < 10 secondi per persona al check-in, code fluide anche con più addetti |
| OB5 | Costruire un canale diretto verso i ballerini | Base utenti riutilizzabile per la comunicazione e, in prospettiva, per l'abbonamento premium |
| OB6 | Aumentare la partecipazione percepita durante l'evento | Contenuti in chat e proiezioni per evento, come indicatore di coinvolgimento |

### 2.2 Dentro il perimetro del primo rilascio

Registrazione utenti · onboarding organizzatori con approvazione · creazione evento
component-based · titoli d'ingresso, prezzi e quote customizzabili · requisiti di
partecipazione configurabili · servizi accessori da catalogo · carrello e checkout
multi-PSP (Stripe, PayPal, Satispay) con fee a carico del partecipante · biglietti nominali
con QR · trasferimento del nominativo · iscrizione a coppia · quote per ruolo di ballo ·
bacheca cerco-partner · check-in con supporto offline · vendita alla porta · rimborsi e
annullamenti · chat di evento con Live Wall · comunicazioni transazionali · back-office e
report per organizzatore · console di amministrazione della piattaforma.

### 2.3 Fuori dal perimetro del primo rilascio

Corsi ricorrenti e abbonamenti a lezioni · lezioni private con calendario del maestro ·
liste d'attesa · acconto e saldo · co-organizzazione con split degli incassi · pagina evento
personalizzabile e widget da incorporare · profili pubblici, feed, messaggistica privata,
recensioni · bonifico bancario come metodo di pagamento · multi-schermo per la wall · wall
consultabile dai partecipanti · app native · piano premium attivo (progettato, non attivato)
· selezione manuale delle candidature e lotteria · gestione SIAE e borderò · fatturazione
elettronica automatica · **tesseramento associativo, vendita della quota associativa e
certificato medico**, che restano interamente fuori dalla piattaforma · vendita come quota di
partecipazione riservata ai soci: **tutti i titoli sono biglietti commerciali** · upload di
documenti nei requisiti.

### 2.4 Assunzioni

| # | Assunzione | Se cade |
|---|---|---|
| AS1 | Il prezzo esposto al partecipante è il netto dell'organizzatore; la fee di piattaforma è aggiunta in checkout | Cambia il calcolo di ogni riga d'ordine e la comunicazione di prezzo |
| AS2 | L'acquisto richiede un account, creato contestualmente al checkout in un solo passaggio | Serve un percorso ospite, incompatibile con QR nominale e requisiti |
| AS3 | La coppia si acquista in un unico ordine che salda entrambi i posti | Serve un meccanismo di prenotazione temporanea, escluso per decisione |
| AS4 | La capienza si impegna all'avvio dell'ordine con una prenotazione temporanea a tempo, e si rilascia alla scadenza o al fallimento | Senza prenotazione si torna al rischio di doppia vendita per tutta la durata dell'ordine |
| AS5 | La location dispone di rete durante l'evento per chat e wall | La chat non è utilizzabile e la wall si ferma sul buffer locale |
| AS6 | Un solo regime fiscale (Italia) e una sola valuta (EUR) | Serve modellare paese, valuta e imposte per riga |

### 2.5 Posizionamento: cosa la piattaforma fa e cosa non fa

Mirada Tango è **uno strumento di vendita, non un intermediario fiscale.** Gli adempimenti
restano dell'organizzatore e si svolgono fuori dalla piattaforma, come già avviene oggi. È una
scelta di posizionamento, va dichiarata come tale nelle condizioni di servizio e riflessa nel
prodotto, non lasciata implicita.

| La piattaforma fa | La piattaforma non fa |
|---|---|
| Espone il catalogo degli eventi e raccoglie l'ordine | Non emette titoli di accesso fiscali |
| Incassa il prezzo sull'account dell'organizzatore | Non calcola né versa le imposte dell'organizzatore |
| Trattiene i propri **diritti di prevendita**, che sono ricavo suo, e li documenta e assoggetta a imposta autonomamente | Non gestisce SIAE, borderò né diritti d'autore |
| Emette una **conferma d'ordine con QR di accesso** e ne governa il controllo all'ingresso | Non tiene la contabilità dell'organizzatore né emette documenti in suo nome |
| Conserva ed esporta i dati di vendita in forma completa, perché l'organizzatore possa adempiere | Non si sostituisce agli adempimenti, né verifica che siano stati assolti |

Ne discendono tre requisiti che tengono in piedi il posizionamento: la **dichiarazione e
attestazione dell'organizzatore** (RF-ORG-8), la **natura non fiscale del documento emesso**
(RF-TCK-11), e **l'esportazione dei dati con il dettaglio necessario** (RF-BKO-9). Senza il
terzo il posizionamento è scarico di responsabilità; con il terzo è una divisione di compiti.

---

## 3. Glossario di dominio

Il vocabolario del tango è parte dei requisiti: usarlo correttamente nell'interfaccia è un
fattore di credibilità verso la community.

| Termine | Significato | Rilievo funzionale |
|---|---|---|
| **Milonga** | Serata di ballo. Indica anche uno dei tre ritmi del tango | Evento singolo o ricorrente, biglietto a serata |
| **Práctica** | Incontro informale di pratica, spesso con assistenza | Come la milonga, prezzo ridotto |
| **Marathon** | Più giorni di solo ballo, senza lezioni, ritmo intenso | Ratio leader/follower vincolante, pass unico |
| **Encuentro** | Evento di ballo tradizionale, milonguero, molto curato nella selezione dei partecipanti | Quote per ruolo strette, spesso capienza ridotta |
| **Festival** | Più giorni con workshop, milonghe, spettacoli | Struttura a sessioni, pass multipli |
| **Stage / workshop** | Seminario intensivo, per livello | Iscrizione singola o a coppia, quote per ruolo |
| **Leader / Follower** | Ruoli di ballo (chi propone, chi interpreta). Sostituiscono "uomo/donna": nel tango contemporaneo il ruolo è indipendente dal genere | **Dimensione di capienza.** Mai derivare il ruolo dal genere |
| **Both / switch** | Chi balla entrambi i ruoli | Deve poter scegliere il ruolo per singolo evento |
| **Tanda** | Serie di 3-4 brani dello stesso stile, si balla con lo stesso partner | Utile per il programma e per gli annunci sulla wall |
| **Cortina** | Stacco musicale tra due tande, si cambia partner | Momento naturale per la rotazione dei contenuti sulla wall |
| **Cabeceo / Mirada** | L'invito a ballare con lo sguardo e il cenno del capo. Dà il nome al progetto | Riferimento identitario, non funzionale |
| **Ronda** | Il senso di marcia sulla pista | — |
| **Taxi dancer** | Ballerino ingaggiato per garantire il ballo agli ospiti | Possibile ruolo/servizio accessorio in fase 2 |
| **Balance / ratio** | Rapporto tra leader e follower ammessi | Regola di capienza configurabile |

---

## 4. Attori

| Attore | Descrizione sintetica |
|---|---|
| **Visitatore** | Consulta calendario e pagine evento senza account |
| **Ballerino** | Utente registrato: acquista, gestisce biglietti, cerca partner, partecipa alla chat |
| **Organizzatore (Owner)** | Titolare dell'organizzazione: dati fiscali, incassi, staff, eventi |
| **Event Manager** | Costruisce e gestisce gli eventi assegnati |
| **Box Office** | Vende alla porta e incassa in loco |
| **Operatore Check-in** | Scansiona i QR all'ingresso |
| **Moderatore Wall** | Governa chat e proiezione durante l'evento |
| **Comunicazione** | Invia comunicazioni e gestisce codici promozionali |
| **Contabile** | Sola lettura su incassi e documenti |
| **Super Admin** | Amministratore della piattaforma: approva organizzatori, configura i cataloghi |
| **Supporto e Moderazione** | Assistenza e moderazione dei contenuti segnalati |
| **Amministrazione piattaforma** | Fee, riconciliazioni, report economici |

La matrice completa dei permessi, con le quattro decisioni ancora da limare, è in
`02-matrice-ruoli.md`.

---

## 5. Modello concettuale dei dati

### 5.1 Vista d'insieme

```
                        ┌──────────────────┐
                        │   TipoEvento     │  catalogo (Super Admin)
                        │  ·capacità       │  es. milonga, festival,
                        │  ·template       │      marathon, stage…
                        └────────┬─────────┘
                                 │ istanzia
┌───────────────┐       ┌────────▼─────────┐       ┌──────────────────┐
│ Organizzazione├──────►│     Evento       │──────►│    Location      │
│ ·dati fiscali │ 1   n │ ·stato ·locandina│  n  1 │ ·capienza ·mappa │
│ ·account PSP  │       │ ·policy rimborso │       └──────────────────┘
└───────┬───────┘       └───┬───┬───┬───┬──┘
        │ n                 │   │   │   │
┌───────▼───────┐       ┌───▼─┐ │ ┌─▼───────────────┐ ┌──────────────┐
│MembroOrg+Ruolo│       │Sess.│ │ │TitoloIngresso   │ │  CastEvento  │
└───────────────┘       │·sala│ │ │·prezzo ·include │ │ maestri, DJ  │
                        │·ora │ │ │·vincolo coppia  │ └──────────────┘
                        └──┬──┘ │ └────────┬────────┘
                           │    │          │
                  ┌────────▼────▼──────────▼────────┐
                  │        QuotaCapienza            │  modello unico:
                  │ dimensione × ruolo → limite     │  evento | sessione |
                  └─────────────────────────────────┘  titolo | servizio
                                 │
        ┌────────────────────────┼────────────────────────┐
┌───────▼──────────┐   ┌─────────▼────────┐   ┌───────────▼──────────┐
│RequisitoEvento   │   │ServizioAccessorio│   │  PolicyRimborso      │
│·tipo ·blocco     │   │·prezzo ·attributi│   │  ·scaglioni          │
│·verifica         │   │·cut-off          │   │  ·termine trasferim. │
└──────────────────┘   └──────────────────┘   └──────────────────────┘

┌──────────┐    ┌──────────┐    ┌────────────┐    ┌──────────────┐
│  Utente  ├───►│  Ordine  ├───►│ RigaOrdine ├───►│  Biglietto   │
│ ·ruolo   │ 1 n│ ·totale  │ 1 n│ ·titolo    │ 1 1│ ·QR ·titolare│
│  ballo   │    │ ·fee     │    │ ·servizio  │    │ ·stato       │
│ ·piano   │    │ ·stato   │    └────────────┘    └───┬──────┬───┘
└────┬─────┘    └────┬─────┘                          │      │
     │               │ 1                      ┌───────▼──┐ ┌─▼──────────┐
     │          ┌────▼─────┐                  │Trasferim.│ │ CheckIn    │
     │          │Pagamento │ multi-PSP        │·da ·a    │ │ ·operatore │
     │          │·psp ·rif │                  └──────────┘ │ ·offline   │
     │          └────┬─────┘                               └────────────┘
     │               │
     │          ┌────▼──────────┐    ┌──────────────┐
     │          │RichiestaRimb. │    │ Iscrizione   │◄── una per persona
     │          │·scaglione     │    │ ·ruolo ballo │    nell'evento
     │          └───────────────┘    │ ·esiti req.  │
     │                               │ ·coppia      │
     │                               └──────┬───────┘
     │                                      │ 0..1
     │          ┌───────────────┐     ┌──────▼───────┐
     ├─────────►│AnnuncioPartner│     │   Coppia     │
     │          └───────────────┘     │ 2 iscrizioni │
     │                                └──────────────┘
     │
     │   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
     └──►│MessaggioChat ├──►│  CodaWall      ├──►│   Schermo    │
         │·testo ·foto  │   │ ·ordine ·pin   │   │ ·codice      │
         │·stato moder. │   │ ·in_proiezione │   │ ·heartbeat   │
         └──────────────┘   └────────────────┘   └──────────────┘

         ┌──────────┐   ┌──────────────┐
         │  Piano   ├──►│ Abbonamento  │  layer di entitlement,
         │ ·diritti │   │ ·stato ·rinn.│  progettato, spento in MVP
         └──────────┘   └──────────────┘
```

### 5.2 Le entità che meritano una spiegazione

**TipoEvento** — È il perno dell'estensibilità. Un tipo evento non è un'etichetta: dichiara
quali *capacità* l'evento espone (sessioni multiple sì/no, quote per ruolo sì/no, livelli
sì/no, cast sì/no, iscrizione a coppia sì/no) e porta un template di valori di default. Il
Super Admin può creare un nuovo tipo — "tango holiday", "campionato", "concerto" — senza
sviluppo, e gli organizzatori lo trovano disponibile alla creazione dell'evento. La
conseguenza per l'interfaccia è che il wizard di creazione evento è **generato dalle
capacità del tipo**, non disegnato caso per caso.

**QuotaCapienza** — Un solo modello per tutte le quote, perché la richiesta è che siano
interamente customizzabili. Una quota è una terna *(dimensione, ruolo opzionale, limite)*
dove la dimensione può essere l'evento, una sessione, un titolo d'ingresso o un servizio
accessorio. Esempi reali:

| Intenzione dell'organizzatore | Quote da configurare |
|---|---|
| Milonga da 120 persone, nessun vincolo di ruolo | evento → 120 |
| Encuentro da 100 posti, 50 leader e 50 follower | evento+leader → 50, evento+follower → 50 |
| Marathon con tolleranza: 60+60 ma si accetta uno sbilancio di 5 | evento+leader → 60, evento+follower → 60, tolleranza → 5 |
| Festival: 200 al pass completo, ma il workshop avanzato ha 30 coppie | titolo "full pass" → 200, sessione "avanzato"+leader → 30, +follower → 30 |
| Cena per 80 persone | servizio "cena" → 80 |

La regola di ammissione è la congiunzione: **un acquisto è possibile solo se tutte le quote
limitanti coinvolte hanno capienza residua**, e solo se supera il cancello di tolleranza sullo
sbilancio dei ruoli.

Due qualificatori completano il modello:

- **`limitante`** — una quota può contare i posti senza bloccare la vendita. Serve alle
  sessioni incluse in un pass dove non esiste un posto assegnato: una milonga del festival non
  deve rendere invendibile il Full Pass, un workshop con 25 coppie effettive sì. Le quote di
  capienza della sala e di ruolo dell'evento sono sempre limitanti e il flag non è modificabile.
- **`tolleranza_sbilancio`** — non estende il limite, restringe dinamicamente l'accesso al ruolo
  sovrarappresentato: un'iscrizione nel ruolo X passa se `iscritti(X) − iscritti(Y) ≤ tolleranza`.
  Ne deriva una proprietà utile: una coppia aggiunge un'unità per parte, non altera lo
  sbilancio e supera quindi sempre il cancello. È il motivo per cui gli encuentros aprono
  prima le iscrizioni a coppie.

Struttura dei dati, algoritmi di risoluzione e impegno atomico, regole di rilascio, invarianti
e casistica di test sono specificati nell'allegato **`05-modello-capienza.md`**.

**RequisitoEvento** — Istanza, sull'evento, di un tipo di requisito preso dal catalogo. Il
catalogo dei tipi è governato dal Super Admin e comprende almeno: *tessera associativa
valida*, *documento con scadenza* (certificato medico e simili), *dichiarazione da
accettare*, *upload di file*, *campo informativo custom*. Per ogni requisito l'organizzatore
sceglie: obbligatorio o facoltativo · quando blocca (impedisce l'acquisto oppure impedisce
l'ingresso) · come si verifica (automatica o approvazione manuale) · entro quando va
soddisfatto. È questa la struttura che risponde alla richiesta "il manager inserisce gli
adempimenti che servono per quel determinato evento".

**ServizioAccessorio** — Istanza, sull'evento, di un tipo di servizio preso dal catalogo:
lezione privata durante l'evento, pasto, posto letto, transfer, merchandising, servizio
fotografico. Ogni tipo dichiara quali attributi raccogliere all'acquisto (taglia, preferenza
alimentare, slot orario, note) e ogni istanza ha prezzo, quota di capienza e cut-off di
rimborso propri.

Due voci del catalogo vanno distinte da funzioni omonime della roadmap, perché la
sovrapposizione dei nomi ha già generato un'apparente contraddizione:

| Servizio del primo rilascio | Funzione diversa, rinviata |
|---|---|
| **Posto letto** — inventario noto in convenzione con una struttura: N posti, un prezzo, una quota, un cut-off. È identico a una cena | **Gestione dell'ospitalità** (fase 3) — matching tra ballerini, chi offre un divano e chi cerca dove dormire. Ha il profilo di rischio della ricerca partner, non quello di un servizio |
| **Lezione privata** — slot orari predisposti dall'organizzatore e venduti come qualunque accessorio; il maestro non ha accesso alla piattaforma | **Prenotazione sul calendario del maestro** (fase 2) — disponibilità reali, conferma, politica di cancellazione, e il ruolo Maestro con login |

**Iscrizione** — Distinta dal Biglietto per una ragione precisa: il biglietto è un titolo
economico trasferibile, l'iscrizione è la **presenza di una persona in un evento** con il suo
ruolo di ballo, i suoi esiti dei requisiti e il suo check-in. Quando un biglietto viene
trasferito, l'iscrizione cambia titolare e i requisiti vanno rivalutati sul nuovo
partecipante: senza questa separazione il trasferimento aprirebbe un buco nei controlli.

**Cardinalità dichiarata: una Iscrizione per persona per evento, con più Biglietti collegati.**
Chi acquista un pass e in aggiunta un ingresso singolo ha due biglietti e una sola iscrizione.
Ne consegue che i consumi di capienza, i requisiti, il ruolo di ballo e le presenze sono
ancorati all'iscrizione, mentre il valore economico e la trasferibilità stanno sul biglietto.

**Piano e Abbonamento** — Presenti nel modello dal primo giorno, inattivi. Un Piano è un
insieme di diritti (`chat_evento`, e in prospettiva altri); un Abbonamento lega un utente a
un piano con stato e data di rinnovo. Ogni funzionalità premium interroga un unico servizio
di verifica dei diritti che, con l'interruttore spento, risponde sempre affermativamente.

---

## 6. Requisiti funzionali

Codifica: **RF-<area>-<n>**. Priorità: **M** = primo rilascio, **2** = fase 2, **3** = fase 3.

### 6.1 Account e identità (ACC)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-1 | Registrazione con email e password, oppure accesso con Google/Apple, con verifica dell'indirizzo email | M |
| RF-ACC-2 | Accesso senza password tramite link via email (utile in sala, dove nessuno ricorda le password) | M |
| RF-ACC-3 | Il profilo raccoglie: nome, cognome, nickname, email, telefono, città, **ruolo di ballo preferito** (leader / follower / entrambi), lingua, foto opzionale | M |
| RF-ACC-4 | Il ruolo di ballo del profilo è un default sovrascrivibile per singola iscrizione | M |
| RF-ACC-5 | Il nickname è il solo dato mostrato in chat e sulla wall: nome e cognome non sono mai proiettati | M |
| RF-ACC-6 | Autenticazione a due fattori, obbligatoria per Super Admin e Owner, opzionale per gli altri | M |
| RF-ACC-7 | Esportazione e cancellazione dell'account su richiesta dell'utente, con conservazione dei soli dati contabili obbligatori in forma pseudonimizzata | M |
| RF-ACC-8 | Un utente può appartenere a più organizzazioni con ruoli diversi e passare da un contesto all'altro | M |
| RF-ACC-9 | Il **nickname è soggetto a filtro automatico** alla creazione e a ogni modifica, ed è modificabile un numero limitato di volte nell'arco di un periodo: è l'unico dato dell'autore che finisce proiettato su un maxischermo | M |
| RF-ACC-10 | **Età minima per l'account: 14 anni compiuti**, con dichiarazione dell'età alla registrazione e conseguenze dichiarate in caso di dichiarazione mendace | M |
| RF-ACC-11 | Sotto i 14 anni **non esiste account**: il minore partecipa come iscritto senza account, inserito nell'ordine da un adulto che **dichiara di esercitare la responsabilità genitoriale** o di esserne delegato. Il biglietto è nominale ed è gestito dall'adulto, che ne esercita anche i diritti | M |
| RF-ACC-12 | L'accesso in scrittura alla chat di evento è **riservato ai maggiorenni**; lo stesso vincolo si applica alla ricerca partner di fase 2 | M |

### 6.2 Onboarding dell'organizzatore (ORG)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-1 | Chiunque può inviare una richiesta di attivazione come organizzatore: denominazione, forma giuridica, partita IVA o codice fiscale, sede, referente, tipologia di eventi, sito o pagina social di riferimento | M |
| RF-ORG-2 | La richiesta entra in una coda di approvazione del Super Admin, con esiti: approvata, rifiutata con motivazione, sospesa in attesa di chiarimenti | M |
| RF-ORG-3 | Fino all'approvazione l'organizzazione può preparare eventi in bozza ma non pubblicarli | M |
| RF-ORG-4 | Notifica dell'esito via email; in caso di rifiuto è possibile integrare e ripresentare | M |
| RF-ORG-5 | Prima della prima pubblicazione l'Owner deve collegare almeno un account di incasso e accettare le condizioni di servizio con versione e data | M |
| RF-ORG-6 | Il Super Admin può sospendere un'organizzazione: gli eventi futuri vengono depubblicati, quelli con biglietti già venduti restano accessibili per la gestione e i rimborsi | M |
| RF-ORG-7 | L'Owner invita membri via email assegnando uno o più ruoli, per organizzazione o per singolo evento | M |
| RF-ORG-8 | In fase di registrazione l'organizzatore **dichiara il proprio inquadramento fiscale** e, per ciascun evento pubblicato, **attesta di adempiere agli obblighi di emissione che gli competono**. La dichiarazione è versionata, datata e tracciata, e le condizioni di servizio la richiamano | M |
| RF-ORG-9 | La piattaforma mette a disposizione all'organizzatore l'esportazione completa delle vendite in forma utilizzabile per i propri adempimenti, senza sostituirsi a essi | M |
| RF-ORG-10 | La piattaforma verifica presso il prestatore lo **stato di abilitazione all'incasso**, non il solo collegamento dell'account. La prima pubblicazione richiede l'abilitazione piena | M |
| RF-ORG-11 | **Controllo periodico** dello stato di abilitazione. Alla sua decadenza: sospensione della pubblicazione di nuovi eventi e della vendita su quelli già pubblicati, con avviso all'Owner che indica quale adempimento manca presso il prestatore. **I biglietti emessi restano validi e i rimborsi restano eseguibili** | M |
| RF-ORG-12 | **Cruscotto dello stato di incasso** in evidenza nell'area dell'organizzazione, con gli eventuali fondi in attesa di trasferimento presso il prestatore e le azioni richieste | M |
| RF-ORG-13 | Le **condizioni di servizio per l'organizzatore** dichiarano che la penale applicata dal prestatore su ogni contestazione di addebito è **a suo carico**, e la addebitano sul primo regolamento utile. La dichiarazione è versionata come tutte le altre | M |

### 6.3 Creazione e configurazione dell'evento (EVT)

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-1 | La creazione è un percorso guidato le cui sezioni dipendono dalle capacità del tipo di evento scelto | M |
| RF-EVT-2 | Dati di base: titolo, tipo, descrizione, data e ora di inizio e fine, location, lingua dei contenuti, tag di ricerca | M |
| RF-EVT-3 | **Upload della locandina** con ritaglio guidato per i tre formati necessari: verticale per la scheda, orizzontale per la copertina, quadrato per la condivisione. Nessun'altra personalizzazione grafica | M |
| RF-EVT-4 | Location scelta da anagrafica riutilizzabile o creata al volo: nome, indirizzo, coordinate, capienza, note su pavimento, climatizzazione, parcheggio, accessibilità | M |
| RF-EVT-5 | Eventi articolati in **sessioni** (workshop, milonghe, spettacoli) con orario, sala, livello, cast, capienza e quote proprie | M |
| RF-EVT-6 | Cast dell'evento: maestri, DJ, orchestre, come anagrafica riutilizzabile senza account | M |
| RF-EVT-7 | Definizione dei **titoli d'ingresso**: nome, descrizione, prezzo, sessioni incluse, finestra di vendita, visibilità (pubblico o riservato con codice), vincolo di ruolo, vincolo di acquisto a coppia, quantità minima e massima per ordine | M |
| RF-EVT-23 | Le **sessioni incluse in un titolo sono un elenco esplicito**, non una regola. In fase di composizione l'organizzatore dispone di selettori rapidi (tutti i workshop, tutto il sabato, tutte le milonghe) che producono comunque un elenco modificabile | M |
| RF-EVT-24 | Aggiungere una sessione a evento pubblicato **non la aggiunge ai titoli già venduti**: il sistema segnala la sessione orfana e chiede cosa farne, distinguendo i titoli invenduti da quelli già acquistati. Su questi ultimi l'aggiunta è ammessa solo come miglioria, mai come sottrazione | M |
| RF-EVT-25 | **Scaglioni di prezzo facoltativi**, definiti dall'organizzatore in fase di creazione: a data, a quantità venduta, o combinati. Il comportamento predefinito è il **prezzo unico che non cambia mai**, e chi non attiva la funzione non la incontra | M |
| RF-EVT-26 | Lo scaglione attivo e il criterio con cui scade sono sempre visibili al partecipante, con dati reali: "120 € fino al 31 gennaio" oppure "120 €, restano 8 posti a questo prezzo" | M |
| RF-EVT-27 | Il prezzo si blocca **alla creazione dell'ordine**: chi entra in checkout con lo scaglione disponibile non se lo vede cambiare durante i quindici minuti di prenotazione, anche se nel frattempo lo scaglione si esaurisce | M |
| RF-EVT-28 | Unità di vendita del titolo: **per persona** oppure **per coppia** (un prezzo, due posti, due iscrizioni con ruoli complementari). Il titolo a coppia non è acquistabile da solo, e la scheda evento lo dichiara | M |
| RF-EVT-29 | Titoli che **non consumano quote di ruolo**, per accompagnatori non ballerini e per il pubblico dello spettacolo | M |
| RF-EVT-30 | Modelli di titoli precompilati per tipologia di evento, così che l'organizzatore non parta da un foglio bianco | M |
| RF-EVT-8 | Titolo a composizione libera: "scegli N sessioni tra quelle disponibili" con prezzo del pacchetto | 2 |
| RF-EVT-31 | Upgrade di titolo con versamento della differenza, decadenza del biglietto precedente ed emissione del nuovo | 2 |
| RF-EVT-9 | Definizione delle **quote di capienza** su qualunque dimensione, con eventuale tolleranza di sbilancio tra ruoli | M |
| RF-EVT-20 | Ogni quota di sessione è dichiarabile **limitante** o **non limitante**: la prima blocca la vendita dei titoli che includono la sessione, la seconda conta i posti senza impedire l'acquisto. Le quote di capienza della sala e di ruolo dell'evento sono sempre limitanti | M |
| RF-EVT-21 | Se l'organizzatore include in un titolo una sessione limitante già satura, il sistema lo segnala e propone tre alternative: aumentare la quota, dichiarare la sessione non limitante, oppure pubblicare una variante di titolo che non la include | M |
| RF-EVT-22 | Le quote riservate agli **accrediti** sono distinte dall'inventario in vendita: consumano capienza di sala e quote di ruolo, non quelle di titolo | M |
| RF-EVT-32 | **Contingente riservato ai canali esterni**: l'organizzatore può sottrarre alla vendita online una parte della capienza, destinata alla propria biglietteria o ad altri canali. Non è acquistabile in piattaforma e non compare nella disponibilità pubblica | M |
| RF-EVT-33 | L'organizzatore può **aggiornare in qualunque momento il totale dei posti e la disponibilità residua**, anche portandola sotto il venduto. L'unico effetto è la chiusura della vendita online: **nessun biglietto già emesso viene mai invalidato** | M |
| RF-EVT-34 | In fase di creazione l'organizzatore sceglie se **gestire o no i biglietti venduti fuori piattaforma**. Se sceglie di no, i contatori riflettono le sole vendite online e l'interfaccia lo dichiara apertamente, così che nessuno legga quei numeri come il quadro completo | M |
| RF-EVT-10 | Selezione dei **requisiti di partecipazione** dal catalogo, con parametri per requisito | M |
| RF-EVT-11 | Selezione dei **servizi accessori** dal catalogo, con prezzo, quota e cut-off per servizio | M |
| RF-EVT-12 | Scelta della **policy di rimborso** tra i preset di piattaforma, con possibilità di renderla più favorevole al partecipante | M |
| RF-EVT-13 | Configurazione del modulo chat e wall: attivazione, layout, durate di proiezione, moderatori, testo della schermata di attesa | M |
| RF-EVT-14 | Anteprima della scheda evento come la vedrà il pubblico, prima della pubblicazione | M |
| RF-EVT-15 | Ciclo di vita: `bozza` → `pubblicato` → `vendita_chiusa` → `in_corso` → `concluso` → `archiviato`, più `annullato` da qualunque stato pubblicato. **Nessuna moderazione del singolo evento**: il controllo della piattaforma avviene una volta sola, all'approvazione dell'organizzazione | M |
| RF-EVT-16 | Duplicazione di un evento come base per una nuova edizione, con azzeramento di vendite e iscrizioni | M |
| RF-EVT-17 | Eventi ricorrenti come serie generata da una regola (es. ogni giovedì), con singole occorrenze modificabili o annullabili | M |
| RF-EVT-18 | Registro delle modifiche su evento pubblicato, con autore e momento, consultabile da Owner e Super Admin | M |
| RF-EVT-19 | Modifiche sostanziali a evento pubblicato (data, location, cast principale) richiedono conferma esplicita e generano comunicazione automatica agli acquirenti, con diritto di rimborso integrale | M |
| RF-EVT-35 | **Annullamento di una singola sessione** su evento che si svolge regolarmente, con motivazione, comunicazione ai soli titolari di titoli che la includono, e rilascio delle quote della sessione | M |
| RF-EVT-36 | Ogni sessione porta un **peso di ripartizione** che determina la quota di prezzo a essa attribuibile dentro un titolo multi-sessione. Default uniforme sul numero di sessioni incluse; pesi diversi assegnabili dall'organizzatore in fase di creazione. Lo stesso peso è la struttura che consente, se la verifica fiscale lo richiedesse, di scomporre un pass misto tra componente didattica e componente danzante | M |
| RF-EVT-37 | I **servizi accessori legati alla sessione annullata** — la lezione privata in quello slot, il pasto di quella giornata — seguono la sessione e sono rimborsati integralmente | M |
| RF-EVT-38 | L'organizzatore **dichiara sull'evento se ammette minori** e a quali condizioni: accompagnamento obbligatorio, fasce orarie, sessioni consentite. Il default è che l'evento non ammette minori non accompagnati, e la scheda evento lo espone | M |
| RF-EVT-39 | Se il modulo chat è attivo su un evento **per cui non è previsto il check-in**, la configurazione lo segnala e propone l'attivazione dello sblocco di sala (RF-CHK-16). Un modulo che non si sbloccherà mai non si pubblica in silenzio | M |
| RF-EVT-40 | Il passaggio a `vendita_chiusa` avviene per il **primo dei criteri configurati che si verifica**: data e ora dichiarate · esaurimento di tutte le quote limitanti · decisione manuale dell'organizzatore · inizio dell'evento, criterio sempre attivo come ultimo. La **riapertura manuale** è possibile finché l'evento non è iniziato e la capienza lo consente | M |
| RF-EVT-41 | `vendita_chiusa` chiude la **sola vendita online**: vendita alla porta ed emissione manuale di pass restano possibili, coerentemente con RB20 | M |

### 6.4 Pubblicazione e ricerca (PUB)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PUB-1 | Calendario pubblico con vista elenco e vista mensile | M |
| RF-PUB-2 | Filtri: città e raggio, periodo, tipo di evento, livello, fascia di prezzo, maestro o DJ, disponibilità per il proprio ruolo di ballo | M |
| RF-PUB-3 | Ricerca testuale su titolo, descrizione, cast, location | M |
| RF-PUB-4 | Vista mappa degli eventi | M |
| RF-PUB-5 | Scheda evento con locandina, programma per sessioni, cast, location con mappa, titoli disponibili con **disponibilità per ruolo**, requisiti richiesti, servizi accessori, policy di rimborso, organizzatore | M |
| RF-PUB-6 | URL leggibile e stabile, immagine di condivisione, dati strutturati `schema.org/Event` per l'indicizzazione | M |
| RF-PUB-7 | Aggiunta al calendario personale (iCal, Google) | M |
| RF-PUB-8 | Indicatore di scarsità calcolato sulla **disponibilità residua alla vendita online**, mai su un valore inventato. Poiché l'organizzatore può vendere anche altrove, l'indicatore è onesto rispetto a ciò che la piattaforma sa, e non promette ciò che non può sapere | M |
| RF-PUB-9 | Interfaccia in italiano e inglese; i contenuti dell'organizzatore possono avere una seconda versione linguistica opzionale | M |
| RF-PUB-10 | La seconda lingua opzionale copre **tutti i testi redatti dall'organizzatore che compaiono in un percorso di acquisto o di adempimento**: nomi e descrizioni dei titoli e delle sessioni, nomi e testi dei requisiti e delle dichiarazioni da accettare, descrizioni dei servizi accessori, testo della policy di rimborso, contenuti di servizio della wall. In assenza della traduzione si mostra il testo originale **con l'indicazione della lingua**, mai una stringa vuota | M |
| RF-PUB-11 | Il back-office segnala all'organizzatore **quali testi obbligatori non sono ancora tradotti** quando l'evento dichiara una seconda lingua, prima della pubblicazione | M |

### 6.5 Carrello, checkout, pagamento (PAY)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-1 | Carrello con più titoli, più servizi accessori e più partecipanti, anche su eventi di **organizzatori diversi**, con la suddivisione prevista da RF-PAY-34 | M |
| RF-PAY-2 | **Prenotazione temporanea con conto alla rovescia di 15 minuti**, come nei ticketing generalisti: all'avvio dell'ordine i posti selezionati sono bloccati per la finestra che l'utente usa per inserire i dati e pagare. La sola navigazione del catalogo non blocca nulla. La durata è un parametro di piattaforma, non una scelta dell'organizzatore | M |
| RF-PAY-25 | La prenotazione è **sempre attiva**, su qualunque evento e indipendentemente dalla disponibilità residua: comportamento uniforme, prevedibile e identico a quello che l'utente conosce dagli altri siti di biglietteria | M |
| RF-PAY-26 | **Sovrapposizione tra titoli**: se una sessione è già inclusa in un titolo posseduto, il sistema lo segnala con precisione ma non blocca l'acquisto. La quota di quella sessione non viene però consumata due volte per la stessa persona | M |
| RF-PAY-20 | Il conto alla rovescia è **sempre visibile** durante l'ordine, con avviso quando mancano pochi minuti | M |
| RF-PAY-21 | Alla scadenza la prenotazione decade, i posti tornano disponibili e l'utente è riportato al carrello con un messaggio esplicito: nessun addebito, nessun ordine parziale | M |
| RF-PAY-22 | La prenotazione è **riarmata all'avvio del pagamento** ad almeno 10 minuti residui, per coprire il tempo di reindirizzamento verso il prestatore: con PayPal e Satispay l'utente esce dall'applicazione e non deve trovare il posto perduto al rientro | M |
| RF-PAY-23 | Una sola prenotazione attiva per utente e per evento: non è possibile accumulare blocchi su più ordini in parallelo | M |
| RF-PAY-24 | Rilascio immediato in caso di abbandono esplicito dell'ordine, e processo di recupero automatico delle prenotazioni scadute che non siano state rilasciate | M |
| RF-PAY-3 | Per ogni partecipante nell'ordine si raccolgono nome, cognome, email, **ruolo di ballo** e gli attributi richiesti dai servizi acquistati | M |
| RF-PAY-4 | Verifica dei requisiti bloccanti in acquisto prima di procedere al pagamento | M |
| RF-PAY-5 | Codici promozionali: importo o percentuale, validità temporale, limite di utilizzi totali e per utente, applicabilità a titoli specifici | M |
| RF-PAY-6 | Riepilogo con prezzi dell'organizzatore, sconti, **diritti di prevendita della piattaforma esposti come voce separata**, totale | M |
| RF-PAY-7 | Pagamento con **Stripe** (carta, Apple Pay, Google Pay), **PayPal**, **Satispay** | M |
| RF-PAY-8 | **Impegno atomico della capienza all'avvio dell'ordine**, con rilascio automatico alla scadenza della prenotazione, al fallimento del pagamento o all'abbandono | M |
| RF-PAY-9 | Sulle quote commerciali è ammessa una **tolleranza di sforamento** configurabile: l'ordine è accettato anche appena oltre il limite e non genera rimborsi automatici. La capienza della sala resta un blocco assoluto | M |
| RF-PAY-19 | Rimborso automatico integrale nel caso residuo di incasso riuscito oltre la capienza assoluta della sala | 2 |
| RF-PAY-10 | Gestione idempotente delle notifiche dei PSP: nessun ordine duplicato in caso di doppia notifica o di ritorno tardivo dell'utente | M |
| RF-PAY-11 | Gli ordini in stato `in_attesa_di_pagamento` scadono dopo il tempo tecnico e **rilasciano immediatamente la capienza impegnata** | M |
| RF-PAY-12 | Emissione della ricevuta all'acquirente e della documentazione della fee all'organizzatore | M |
| RF-PAY-13 | Storico ordini con dettaglio, ricevute e biglietti scaricabili | M |
| RF-PAY-15 | **Disponibilità parziale**: se in fase di pagamento risultano esaurite soltanto quote di servizi accessori, l'ordine non viene rifiutato. Il sistema segnala le righe indisponibili, propone di rimuoverle, ricalcola il totale e richiede una conferma esplicita prima di procedere | M |
| RF-PAY-16 | Se risulta esaurita una quota di evento, di titolo o di sessione limitante, l'ordine è rifiutato con l'indicazione precisa di cosa manca: nel caso della sessione vengono nominati la sessione e il ruolo, e vengono proposti i titoli alternativi disponibili | M |
| RF-PAY-17 | I due motivi di rifiuto sono distinti nei messaggi: **esaurito** (limite assoluto, situazione definitiva) e **ruolo in attesa** (blocco temporaneo per sbilancio, con invito all'iscrizione a coppia o alla bacheca cerco-partner) | M |
| RF-PAY-14 | Bonifico bancario come metodo con conferma manuale dell'incasso | 2 |
| RF-PAY-33 | Chi acquista per altri fornisce i **soli dati necessari all'emissione del titolo**: nome, cognome, email e ruolo di ballo. Nessun altro attributo del terzo è raccolto dall'acquirente, compresi quelli richiesti dai servizi accessori, che sono chiesti direttamente all'interessato | M |
| RF-PAY-34 | Il carrello con eventi di **organizzatori diversi si suddivide in un ordine per organizzatore**, con pagamenti separati e sequenziali. La suddivisione è dichiarata prima del pagamento, con l'importo di ciascun ordine | M |
| RF-PAY-35 | I **diritti di prevendita si calcolano per biglietto**, non per ordine: la suddivisione del carrello non modifica il totale complessivo pagato dal partecipante | M |
| RF-PAY-36 | Ogni sotto-ordine ha la **propria prenotazione temporanea**, avviata contestualmente; il conto alla rovescia mostrato è il più stringente. L'abbandono dopo il primo pagamento rilascia le prenotazioni residue e **non annulla ciò che è già stato pagato** | M |
| RF-PAY-37 | Riepilogo finale e area personale presentano i sotto-ordini come **un solo acquisto**, con il dettaglio per organizzatore e ricevute distinte | M |

**Contestazioni di addebito.** Il modello di incasso diretto crea un'asimmetria: la contestazione
colpisce il conto dell'organizzatore, ma le prove sono tutte in piattaforma. Un organizzatore
lasciato solo davanti a una richiesta di prova la perde per omessa risposta, non perché avesse
torto. La piattaforma prende quindi in carico l'intero ciclo per suo conto.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-27 | Registrazione delle **contestazioni di addebito** notificate dal prestatore, con stato, importo conteso, motivo dichiarato e termine di risposta, visibili all'organizzatore e all'amministrazione di piattaforma | M |
| RF-PAY-28 | **Costituzione automatica del fascicolo di prova** alla ricezione: ordine e righe, biglietto emesso, momento e indirizzo di rete dell'accettazione delle condizioni, versione della policy di rimborso vigente all'acquisto, storico dei trasferimenti, orario e postazione di check-in, comunicazioni recapitate. Trasmissione al prestatore entro il termine, con sollecito all'organizzatore se serve un suo contributo | M |
| RF-PAY-29 | **Esito**: se la contestazione è accolta, il biglietto è invalidato, l'iscrizione decade e le quote sono rilasciate con lo stesso meccanismo del rimborso; se è respinta, nulla cambia. In entrambi i casi le parti sono notificate | M |
| RF-PAY-30 | I **diritti di prevendita seguono la sorte della transazione contestata**: una contestazione accolta ne produce lo storno a carico della piattaforma, coerentemente con il funzionamento dell'incasso diretto | M |
| RF-PAY-31 | Monitoraggio del **tasso di contestazione per organizzazione** | M |
| RF-PAY-38 | Il monitoraggio opera su **due soglie**: una di **attenzione**, più bassa, che genera un avviso all'Owner con l'indicazione delle cause ricorrenti mentre c'è ancora tempo per correggere; una di **sospensione**, allineata a quella del prestatore, che porta la questione al Super Admin | M |
| RF-PAY-32 | La conferma d'ordine e l'area personale espongono in evidenza **come chiedere un rimborso e come raggiungere l'organizzatore**: è la misura che riduce le contestazioni alla radice, perché la maggior parte nasce da chi non ha trovato il percorso corretto | M |

**I diritti di prevendita.** Il modello è quello dei ticketing generalisti italiani: il prezzo
del titolo è dell'organizzatore, i **diritti di prevendita sono ricavo della piattaforma**,
pagati dal partecipante ed esposti come voce separata in checkout. Non transitano
dall'organizzatore in nessuna forma: la piattaforma li incassa direttamente e ne emette il
proprio documento fiscale verso il partecipante, come prestazione di servizio di
intermediazione soggetta a IVA ordinaria. L'organizzatore resta responsabile dell'evento e
del titolo d'accesso.

**Vincolo tecnico residuo, da chiudere prima dello sviluppo del checkout.** Perché i diritti di
prevendita raggiungano la piattaforma in un pagamento unico, il prestatore di pagamento deve
supportare la ripartizione a favore del gestore della piattaforma:

| Metodo | Supporto alla ripartizione | Conseguenza |
|---|---|---|
| Carta, Apple Pay, Google Pay via Stripe Connect | Nativo | Nessun problema: la quota di piattaforma è trattenuta sulla transazione |
| PayPal | Esiste un prodotto per piattaforme con commissione, subordinato a un accordo di partner | Da attivare formalmente, con tempi di approvazione da mettere in piano |
| Satispay | **Da verificare**: non risulta un prodotto di ripartizione equivalente | Se non esiste, due strade: rinviare il metodo, oppure limitatamente a Satispay far incassare la piattaforma e girare il netto all'organizzatore — con le implicazioni che comporta la detenzione di fondi di terzi |

Nessuna delle tre righe rimette in discussione la decisione: cambia solo quali metodi si
possono aprire al lancio e con quale sequenza.

### 6.6 Requisiti di partecipazione (REQ)

| ID | Requisito | Pr. |
|---|---|---|
| RF-REQ-1 | Al partecipante è mostrato, in scheda evento e in checkout, l'elenco dei requisiti con la relativa scadenza | M |
| RF-REQ-2 | **Il tesseramento avviene fuori dalla piattaforma.** Non esistono anagrafica delle tessere, vendita della quota associativa né verifica automatica di validità. L'organizzatore che deve accertarlo usa il requisito *dichiarazione*: il partecipante dichiara di essere in regola, e la piattaforma non tratta alcun dato associativo | M |
| RF-REQ-3 | **Nessun trattamento di dati sanitari.** Il certificato medico non è raccolto né caricato: dove serve, si usa la dichiarazione di possesso, che lascia la responsabilità a chi dichiara | M |
| RF-REQ-11 | Requisito *upload di documento con scadenza*, per finalità diverse da quelle sanitarie | 2 |
| RF-REQ-4 | Requisito *dichiarazione*: testo definito dall'organizzatore con accettazione tracciata (momento, versione, indirizzo di rete) | M |
| RF-REQ-5 | Requisito *campo custom*: domanda a risposta libera, a scelta singola o multipla | M |
| RF-REQ-6 | Ogni requisito ha uno stato per iscrizione: `da_fornire`, `in_verifica`, `valido`, `rifiutato`, `scaduto` | M |
| RF-REQ-7 | I requisiti dichiarati bloccanti in ingresso impediscono il check-in e l'operatore vede il motivo | M |
| RF-REQ-8 | Solleciti automatici sui requisiti mancanti a intervalli configurabili prima dell'evento | M |
| RF-REQ-9 | Lo staff operativo vede **l'esito** del requisito; l'accesso a un eventuale documento è riservato ai ruoli autorizzati e tracciato in audit log | 2 |
| RF-REQ-10 | I documenti sono conservati per il tempo strettamente necessario e cancellati automaticamente dopo un periodo configurato dalla chiusura dell'evento | 2 |

### 6.7 Biglietto, QR, trasferimento (TCK)

| ID | Requisito | Pr. |
|---|---|---|
| RF-TCK-1 | Biglietto nominale con codice QR firmato, non deducibile e verificabile offline | M |
| RF-TCK-2 | Consegna via email in PDF e disponibilità nell'area personale; nessuna dipendenza dalla stampa | M |
| RF-TCK-3 | Il PDF riporta evento, data, location, titolo, nominativo, **ruolo di ballo**, sessioni incluse, servizi acquistati, QR | M |
| RF-TCK-4 | Stati del biglietto: `valido`, `trasferito`, `annullato`, `rimborsato`. L'utilizzo **non è uno stato del biglietto** ma un check-in registrato sulla coppia biglietto-sessione; per gli eventi senza sessioni si usa una sessione implicita, così il modello resta unico. *Correzione provvisoria, da confermare nella sessione dedicata ai titoli e ai pass* | M |
| RF-TCK-5 | **Trasferimento del nominativo** a un altro ballerino tramite email o nickname, entro il termine configurato sull'evento | M |
| RF-TCK-6 | Il trasferimento invalida il QR precedente, ne emette uno nuovo, sposta l'iscrizione e **rivaluta i requisiti** sul nuovo titolare | M |
| RF-TCK-7 | Se il nuovo titolare ha un ruolo di ballo diverso, il trasferimento è consentito solo se le quote del nuovo ruolo lo permettono | M |
| RF-TCK-8 | Storico completo dei passaggi di titolarità, visibile all'organizzatore | M |
| RF-TCK-9 | La regolazione economica del trasferimento è tra i due ballerini, fuori dalla piattaforma; il sistema lo dichiara con chiarezza | M |
| RF-TCK-14 | **Emissione manuale di pass da parte dell'organizzatore**, in qualunque momento e quantità, **senza vincolo di capienza**: singolarmente con nominativo, oppure in blocco. Ogni pass porta un QR firmato e verificabile esattamente come quelli venduti online | M |
| RF-TCK-15 | All'emissione si indicano titolo, causale (accredito, vendita esterna, omaggio, cortesia) e — se l'evento usa quote per ruolo — il **ruolo di ballo**: senza quel dato l'equilibrio leader/follower mostrato all'organizzatore diventa falso proprio dove serve | M |
| RF-TCK-16 | I pass emessi manualmente sono scaricabili in PDF, stampabili e inviabili per email, e **revocabili singolarmente** con invalidazione del QR | M |
| RF-TCK-17 | Ogni emissione manuale è tracciata con autore, momento, quantità e causale | M |
| RF-TCK-18 | I pass emessi in blocco senza nominativo sono **al portatore**: non danno accesso alla chat, che richiede un account e un check-in nominale, e non consentono il trasferimento. Il sistema lo dichiara al momento dell'emissione | M |
| RF-TCK-11 | Il documento emesso dalla piattaforma è una **conferma d'ordine con QR di accesso**, non un titolo fiscale. Denominazione, testi e contenuto lo dichiarano esplicitamente: non compaiono numerazioni progressive, sigilli o diciture che possano farlo apparire tale | M |
| RF-TCK-12 | L'eventuale **titolo fiscale resta emesso dall'organizzatore** con i propri strumenti. La piattaforma può registrarne gli estremi sull'iscrizione, senza generarlo | M |
| RF-TCK-13 | L'emissione è **astratta dietro un'interfaccia** con due implementazioni previste: titolo interno con QR firmato, e delega a un emittente autorizzato. La seconda non è realizzata nel primo rilascio, ma l'interfaccia è definita perché l'aggiunta sia un'integrazione e non una riscrittura | M |
| RF-TCK-10 | Carte Apple Wallet e Google Wallet | 2 |

### 6.8 Ruolo di ballo e iscrizione a coppia (CPL)

| ID | Requisito | Pr. |
|---|---|---|
| RF-CPL-1 | Il ruolo di ballo è obbligatorio su ogni iscrizione a eventi con quote per ruolo | M |
| RF-CPL-2 | La disponibilità è mostrata per ruolo, con esaurimento indipendente | M |
| RF-CPL-3 | Chi balla entrambi i ruoli sceglie il ruolo con cui si iscrive; l'organizzatore può abilitare l'iscrizione "ruolo flessibile", assegnata alla quota meno affollata | M |
| RF-CPL-4 | **Cancello di tolleranza**: un'iscrizione nel ruolo X è ammessa se `iscritti(X) − iscritti(Y) ≤ tolleranza`. Il ruolo in eccesso viene bloccato temporaneamente, con messaggio distinto dall'esaurimento e possibilità di sbloccarsi all'arrivo del ruolo mancante | M |
| RF-CPL-12 | La tolleranza è valutata sull'ordine intero e non riga per riga: è ciò che consente a una coppia di essere ammessa anche quando la singola iscrizione nello stesso ruolo verrebbe bloccata | M |
| RF-CPL-5 | L'organizzatore può **riallocare posti tra i ruoli** in qualunque momento, con effetto immediato sulla disponibilità | M |
| RF-CPL-6 | **Iscrizione a coppia**: unico ordine, unico pagamento, due iscrizioni legate con ruoli complementari. Chi acquista inserisce i dati del partner | M |
| RF-CPL-7 | L'acquisto a coppia consuma un posto per ciascuna quota di ruolo e va a buon fine solo se entrambe sono disponibili | M |
| RF-CPL-8 | Il partner riceve una notifica con il proprio biglietto e, se non ha un account, l'invito a crearlo per gestirlo | M |
| RF-CPL-9 | La coppia può essere sciolta: le due iscrizioni restano valide come individuali se l'evento lo consente, altrimenti si applica la regola dichiarata sull'evento | M |
| RF-CPL-10 | Rimborso per singolo componente della coppia, se l'evento non vincola la vendita a coppie intere | M |
| RF-CPL-11 | Vista di controllo per l'organizzatore: iscritti per ruolo, sbilancio corrente, coppie complete, andamento nel tempo | M |
| RF-CPL-13 | La persona iscritta da altri riceve una **richiesta di conferma** della propria partecipazione. Fino alla conferma l'iscrizione è in stato `da_confermare`: il biglietto è valido e **l'ingresso è consentito**, ma restano inattivi il profilo, le comunicazioni non essenziali e l'accesso alla chat | M |
| RF-CPL-14 | La persona iscritta da altri può **rifiutare**. Il rifiuto rende il biglietto privo di titolare e lo restituisce alla disponibilità dell'acquirente, che può trasferirlo o chiederne il rimborso secondo la policy dell'evento; i dati del terzo sono cancellati, con la sola traccia contabile obbligatoria | M |
| RF-CPL-15 | L'acquirente **attesta di essere autorizzato** a comunicare i dati delle persone che iscrive, e l'informativa dichiara la base giuridica del trattamento dei dati inseriti da terzi | M |
| RF-CPL-16 | **Sollecito automatico della conferma** a intervalli configurabili, e comunque prima dell'evento: un biglietto senza titolare scoperto la sera stessa non è più trasferibile | M |

### 6.9 Bacheca cerco-partner (PRT)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PRT-1 | Un utente registrato pubblica un annuncio riferito a un evento con iscrizione a coppia: ruolo proprio, ruolo cercato, livello, anni di pratica, note, città di provenienza | M |
| RF-PRT-2 | La bacheca è consultabile dalla scheda dell'evento e filtrabile per ruolo cercato e livello | M |
| RF-PRT-3 | Il contatto avviene attraverso un messaggio interno all'annuncio: le email non sono mai esposte | M |
| RF-PRT-4 | L'autore chiude l'annuncio quando ha trovato il partner; gli annunci si chiudono da soli all'inizio dell'evento | M |
| RF-PRT-5 | Segnalazione di annunci e utenti inopportuni, con presa in carico da parte della moderazione di piattaforma | M |
| RF-PRT-6 | Se due utenti collegati da un annuncio completano insieme un'iscrizione a coppia, l'annuncio si chiude automaticamente | 2 |

> La bacheca è l'unica funzione a carattere relazionale del primo rilascio ed è un'eccezione
> consapevole al perimetro "solo ticketing", perché senza di essa gli stage a coppie
> escludono di fatto i ballerini singoli. Va però presidiata: è la superficie con il maggior
> rischio di uso improprio dell'intero prodotto, e richiede segnalazione, blocco utente e un
> codice di condotta pubblicato.

### 6.10 Check-in e box office (CHK)

| ID | Requisito | Pr. |
|---|---|---|
| RF-CHK-1 | Applicazione web mobile per la scansione del QR con la fotocamera, senza installazione | M |
| RF-CHK-2 | Prima dell'evento l'operatore **scarica la lista** dell'evento sul dispositivo | M |
| RF-CHK-3 | **Funzionamento senza connessione**: verifica della firma del QR e dell'appartenenza alla lista locale, registrazione dell'ingresso in coda locale, sincronizzazione automatica al ritorno della rete | M |
| RF-CHK-4 | Esiti di scansione distinti e inequivocabili: valido · già utilizzato **per questa sessione** (con ora e postazione del primo ingresso) · non valido per questo evento · rimborsato o annullato · requisito bloccante non soddisfatto (con indicazione del requisito) | M |
| RF-CHK-5 | La schermata di esito mostra nominativo, **ruolo di ballo**, titolo, sessioni incluse e servizi acquistati (es. cena, taglia t-shirt) | M |
| RF-CHK-6 | Più operatori in parallelo; i doppi ingressi rilevati in fase di sincronizzazione sono segnalati come conflitti da risolvere, non risolti in silenzio | M |
| RF-CHK-7 | Ricerca manuale per nome o email, con check-in senza scansione | M |
| RF-CHK-8 | Check-in per singola sessione negli eventi articolati | M |
| RF-CHK-9 | Annullamento di un check-in errato entro un tempo breve | M |
| RF-CHK-10 | **Vendita alla porta**: selezione del titolo, dati minimi del partecipante, ruolo di ballo, incasso in contanti o con POS esterno, emissione immediata del biglietto e check-in contestuale | M |
| RF-CHK-11 | La vendita alla porta rispetta le quote residue e registra l'incasso con il metodo dichiarato | M |
| RF-CHK-12 | Chiusura di cassa: totale incassato per metodo, per operatore, per titolo, con quadratura | M |
| RF-CHK-13 | Contatore presenze in tempo reale con soglia di capienza segnalata | M |
| RF-CHK-14 | Il check-in è l'evento che **abilita l'accesso alla chat** dell'evento. Dove il check-in non è previsto, la stessa funzione è svolta dallo sblocco di sala di RF-CHK-16 | M |
| RF-CHK-15 | **Ingresso di chi ha acquistato fuori dalla piattaforma**: registrazione rapida in lista con nome, ruolo di ballo e titolo, senza QR e senza incasso, così che i conteggi di presenza e l'equilibrio dei ruoli restino corretti anche sui partecipanti arrivati da altri canali | M |
| RF-CHK-16 | **Sblocco di sala**: il QR mostrato sulla schermata di cortesia della wall (RF-WALL-34) vale come check-in leggero **ai soli fini dell'accesso alla chat**. Registra un check-in di tipo `AUTO_SALA` previa verifica del possesso di un titolo valido per l'evento. Non sostituisce il controllo accessi e non entra nelle liste di presenza operative, che restano quelle registrate dagli operatori | M |
| RF-CHK-17 | Il codice contenuto nel QR di sala **ruota a intervalli brevi** e vale solo per l'intervallo corrente: una fotografia dello schermo condivisa fuori dalla sala non consente l'accesso. Il moderatore può rigenerarlo in qualunque momento | M |

### 6.11 Chat di evento e Live Wall (WALL)

Il modulo si articola su tre interfacce distinte: la **chat** per il partecipante, la
**console** per il moderatore, la **wall** proiettata in sala.

#### 6.11.1 Chat del partecipante

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-1 | La chat è un canale unico per evento, attivo da un'ora prima dell'inizio a un'ora dopo la fine (finestra configurabile) | M |
| RF-WALL-2 | **Condizioni di accesso in scrittura, congiunte**: biglietto valido · **presenza accertata**, per check-in all'ingresso o per sblocco di sala (RF-CHK-16) · piano premium attivo. Il vincolo del piano è implementato ma disattivato nel primo rilascio. Si aggiunge il vincolo di maggiore età di RF-ACC-12 | M |
| RF-WALL-3 | Chi ha un biglietto ma non ha ancora fatto il check-in vede la chat in sola lettura, con l'indicazione di come sbloccarla | M |
| RF-WALL-4 | Invio di messaggi di testo con limite di lunghezza e di emoji | M |
| RF-WALL-5 | Invio di **foto** dalla fotocamera o dalla galleria, con compressione lato client, correzione dell'orientamento e limite dimensionale | M |
| RF-WALL-6 | L'autore è identificato dal solo **nickname**, con ruolo di ballo opzionale | M |
| RF-WALL-7 | I messaggi appaiono immediatamente nella chat: **nessuna pre-moderazione** | M |
| RF-WALL-8 | Il partecipante vede quali dei suoi contenuti sono stati proiettati sulla wall | M |
| RF-WALL-9 | Limitazione di frequenza per utente (messaggi al minuto, foto totali per evento) e filtro automatico su linguaggio inappropriato | M |
| RF-WALL-10 | Segnalazione di un messaggio da parte di qualunque partecipante | M |
| RF-WALL-11 | Cancellazione di un proprio messaggio; se è in proiezione, viene rimosso anche dalla wall | M |
| RF-WALL-12 | Alla chiusura dell'evento la chat diventa di sola lettura e i contenuti sono cancellati dopo un periodo configurato | M |
| RF-WALL-43 | **Classificazione automatica di ogni immagine prima della pubblicazione in chat.** L'immagine sospetta è trattenuta e non compare a nessuno, in attesa della decisione di un moderatore; il flusso normale non subisce ritardi percepibili e la chat resta libera. All'autore è indicato che il contenuto è in verifica e non perduto | M |
| RF-WALL-44 | L'esito della classificazione è registrato e la coda dei contenuti trattenuti compare in console **con priorità su tutto il resto**. Se nessun moderatore decide, il contenuto **resta trattenuto**: il silenzio non pubblica | M |
| RF-WALL-50 | Il **consenso richiesto al primo invio** dichiara che i contenuti proiettati sono resi pubblici in sala e **possono essere conservati e riutilizzati dall'organizzatore**, che ne diventa titolare autonomo. Senza il consenso l'invio non è possibile | M |

#### 6.11.2 Console del moderatore

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-13 | Flusso dei messaggi in arrivo in tempo reale, con anteprima grande delle foto | M |
| RF-WALL-14 | Azioni su ogni contenuto: **approva per la wall** · **proietta subito** · rifiuta · rimuovi dalla chat · segnala l'autore | M |
| RF-WALL-15 | Coda di proiezione riordinabile per trascinamento, con possibilità di **fissare** un contenuto e di rimetterlo in coda | M |
| RF-WALL-16 | Pannello "in onda": cosa è attualmente proiettato, da quanti secondi, cosa segue | M |
| RF-WALL-17 | Comandi di regia: pausa della rotazione · avanti · indietro · **schermo di cortesia immediato** (il pulsante di emergenza per togliere qualunque contenuto dal maxischermo in un gesto) | M |
| RF-WALL-18 | Inserimento di **contenuti di servizio** creati dal moderatore: annuncio testuale, immagine, prossima tanda, ringraziamento agli sponsor | M |
| RF-WALL-19 | Scorciatoie da tastiera per approvare, rifiutare e proiettare: la moderazione avviene in tempo reale, il mouse è troppo lento | M |
| RF-WALL-20 | Annullamento dell'ultima azione | M |
| RF-WALL-21 | Più moderatori contemporanei, con visibilità di chi ha già preso in carico un contenuto per evitare doppie decisioni | M |
| RF-WALL-22 | Silenziamento o espulsione di un utente dalla chat dell'evento, con motivazione | M |
| RF-WALL-23 | Stato dello schermo collegato: online o offline, ultimo contatto, contenuto effettivamente in proiezione | M |
| RF-WALL-24 | Archivio dell'evento: i contenuti **effettivamente proiettati**, scaricabili in blocco dall'organizzatore a fine serata | M |
| RF-WALL-45 | Il moderatore può **oscurare o sostituire il nickname** mostrato sulla wall per un singolo contenuto, e segnalare l'utente perché il nickname sia cambiato d'ufficio dalla moderazione di piattaforma | M |
| RF-WALL-48 | **Contenuti di servizio programmabili in anticipo**, con orario o ricorrenza: annunci, ringraziamenti agli sponsor, avvisi logistici, chiusura della serata | M |
| RF-WALL-49 | **Segnalazione di assenza di presidio**: se la coda dei contenuti in attesa cresce e nessuna azione di moderazione avviene entro un tempo configurato, il sistema avvisa i moderatori designati sui loro dispositivi | M |
| RF-WALL-51 | L'esportazione di fine serata comprende i **soli contenuti effettivamente proiettati**. Un contenuto approvato e mai andato in onda non è mai stato reso pubblico e non entra nell'archivio | M |
| RF-WALL-52 | Ogni esportazione è **registrata** con autore, momento e numero di contenuti, ed è consultabile dal partecipante nella sezione dei propri contenuti | M |

#### 6.11.3 La wall proiettata — specifica di visualizzazione

L'organizzatore genera un **codice schermo** di sei caratteri; su un computer collegato al
proiettore o al LED wall si apre l'indirizzo della wall, si inserisce il codice e la pagina
va a schermo intero. Nessun software da installare, nessuna autenticazione da digitare in
sala.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-25 | Attivazione con codice schermo a sei caratteri, revocabile e rigenerabile dall'organizzatore | M |
| RF-WALL-26 | Layout **focus singolo a rotazione**: un contenuto per volta, al centro, con transizione in dissolvenza | M |
| RF-WALL-27 | Durata di permanenza configurabile: default 10 secondi per le foto, 8 per i testi | M |
| RF-WALL-28 | Adattamento a 1920×1080 e 3840×2160 in 16:9, con area di sicurezza del 5% sui bordi per compensare l'overscan dei proiettori | M |
| RF-WALL-29 | **Tipografia scalata alla distanza**: corpo minimo equivalente a 48 px su 1080p, ridimensionato automaticamente in base alla lunghezza del messaggio; oltre la lunghezza gestibile il testo non viene proiettato e la console lo segnala | M |
| RF-WALL-30 | **Foto verticali gestite come cittadine di serie**: sono la maggioranza degli scatti da telefono. L'immagine è contenuta senza ritagli, su un fondo derivato dall'immagine stessa e sfocato, così da riempire il 16:9 senza bande nere | M |
| RF-WALL-31 | **Palette per sala buia**: fondo molto scuro e testo avorio anziché bianco pieno, per non abbagliare chi balla; luminosità media stabile tra un contenuto e l'altro | M |
| RF-WALL-32 | **Nessun lampeggio, nessuna transizione a stacco**: dissolvenze morbide di 600-800 ms. Requisito di sicurezza, non estetico: un maxischermo che lampeggia in una sala buia è un rischio per le persone fotosensibili | M |
| RF-WALL-33 | Attribuzione discreta in basso: nickname e, se disponibile, ruolo di ballo. Mai nome e cognome | M |
| RF-WALL-34 | **Schermata di cortesia** quando la coda è vuota: locandina o logo dell'evento, titolo, e istruzione per partecipare alla chat con QR inquadrabile | M |
| RF-WALL-35 | La wall non mostra mai contenuti non approvati, in nessuna circostanza, nemmeno in caso di errore: in assenza di contenuti validi si torna alla schermata di cortesia | M |
| RF-WALL-36 | Rimozione di un contenuto in proiezione con effetto entro un secondo | M |
| RF-WALL-37 | **Buffer locale**: i contenuti approvati e le immagini sono precaricati. In caso di caduta della rete la rotazione continua sul materiale disponibile, con un indicatore discreto di disconnessione visibile solo alla console. Alla riconnessione lo stato si allinea | M |
| RF-WALL-38 | Nessun elemento di interfaccia sullo schermo: niente cursore, niente barre, niente notifiche del browser. Reingresso automatico a schermo intero dopo un'interruzione | M |
| RF-WALL-39 | Il consumo di memoria resta stabile su una sessione di otto ore consecutive: le wall restano accese tutta la notte | M |
| RF-WALL-46 | **Modalità prova**, attivabile prima dell'apertura porte: proietta contenuti campione — testo lungo, testo breve, foto verticale, foto orizzontale, schermata di cortesia — e una **carta di calibrazione** con area di sicurezza, riferimenti tipografici e scala dei grigi, per verificare proiettore, risoluzione, colori e leggibilità a distanza durante l'allestimento | M |
| RF-WALL-47 | **Rotazione di sicurezza in assenza di presidio**: esaurita la coda, la wall ripropone i contenuti **già approvati** dell'evento e i contenuti di servizio programmati, con un tetto configurabile alle ripetizioni. Nessun contenuto non approvato entra mai in rotazione; se non esiste materiale approvato si torna alla schermata di cortesia | M |
| RF-WALL-53 | La cancellazione automatica dei contenuti è **dichiarata per ciò che è**: la piattaforma cancella quanto detiene e non può revocare le copie già esportate dall'organizzatore. L'accordo con l'organizzatore ne disciplina la conservazione | M |
| RF-WALL-40 | Multi-schermo con code e layout indipendenti | 2 |
| RF-WALL-41 | Wall consultabile dai partecipanti in piattaforma, durante e dopo l'evento | 2 |
| RF-WALL-42 | Layout alternativi (mosaico, focus con coda, cornice con programma) selezionabili per evento | 2 |

**Nota di progetto sulla schermata wall.** È l'unica interfaccia del prodotto vista
contemporaneamente da centinaia di persone, a distanza, in condizioni di luce sfavorevoli, e
messa in scena dentro un evento a pagamento: un difetto qui non è un bug, è un incidente
pubblico. Le tre regole non negoziabili che ne derivano sono la leggibilità a venti metri, la
gestione dignitosa delle foto verticali, e il pulsante che in un gesto solo riporta lo
schermo alla cortesia.

### 6.12 Rimborsi, cancellazioni, annullamenti (RMB)

Policy commerciale completa in `03-politica-rimborsi.md`.

| ID | Requisito | Pr. |
|---|---|---|
| RF-RMB-1 | Richiesta di rinuncia dall'area personale, con l'importo recuperabile calcolato e mostrato prima della conferma | M |
| RF-RMB-2 | Il percorso propone **prima il trasferimento** del biglietto e lo mantiene disponibile anche quando il rimborso non è più previsto | M |
| RF-RMB-3 | Motore di scaglioni configurabile per evento entro i limiti di piattaforma | M |
| RF-RMB-4 | Cut-off di rimborso per singolo servizio accessorio, indipendenti dal titolo | M |
| RF-RMB-5 | Approvazione dell'organizzatore, con **approvazione automatica** decorsi sette giorni dalla richiesta | M |
| RF-RMB-6 | Rimborsi parziali e rimborso per singolo componente della coppia | M |
| RF-RMB-7 | Esecuzione sul metodo di pagamento originario; oltre la finestra tecnica del PSP, percorso manuale con raccolta dell'IBAN e tracciamento | M |
| RF-RMB-8 | Annullamento dell'evento: rimborso integrale comprensivo di fee, avviato in blocco, con comunicazione contestuale e monitoraggio degli esiti | M |
| RF-RMB-9 | Il rimborso libera la capienza sulle quote coinvolte e invalida il QR | M |
| RF-RMB-10 | Rimborsi falliti in una coda di gestione con motivo e possibilità di ritentare | M |
| RF-RMB-12 | L'**annullamento di una sessione** dà diritto al rimborso della quota di prezzo a essa attribuibile su ogni titolo che la include, secondo il peso di ripartizione di RF-EVT-36, comprensiva della corrispondente parte di diritti di prevendita e **senza applicazione degli scaglioni**: la causa non è imputabile al partecipante | M |
| RF-RMB-13 | Se le sessioni annullate superano una **soglia di peso** configurabile sul titolo — default 30% — o se la sessione annullata è l'unica inclusa, il partecipante ha diritto al **rimborso integrale del titolo**, esercitabile entro 14 giorni dalla comunicazione secondo RB14 | M |
| RF-RMB-11 | Credito interno riutilizzabile come alternativa volontaria al rimborso | 2 |

### 6.13 Comunicazioni e notifiche (COM)

| ID | Requisito | Pr. |
|---|---|---|
| RF-COM-1 | Email transazionali: benvenuto, conferma d'ordine con biglietti, esito trasferimento, sollecito requisiti, promemoria a 48 e 24 ore, esito rimborso, annullamento o modifica dell'evento | M |
| RF-COM-2 | Comunicazione manuale dell'organizzatore ai partecipanti di un evento, con segmentazione per titolo, ruolo di ballo, stato dei requisiti, presenza al check-in | M |
| RF-COM-3 | Registro degli invii e stato di recapito | M |
| RF-COM-4 | Preferenze di contatto separate tra comunicazioni di servizio e promozionali, con disiscrizione a un clic dalle seconde | M |
| RF-COM-5 | Notifiche in piattaforma per messaggi della bacheca, esiti di richieste, aggiornamenti sugli eventi acquistati | M |
| RF-COM-6 | Template email in italiano e inglese, secondo la lingua dell'utente | M |
| RF-COM-7 | Notifiche push e messaggistica su canali esterni | 3 |

### 6.14 Back-office dell'organizzatore (BKO)

| ID | Requisito | Pr. |
|---|---|---|
| RF-BKO-1 | Cruscotto per evento: venduto per titolo, incasso netto, fee maturate, **iscritti per ruolo con sbilancio corrente**, coppie complete, servizi accessori venduti, requisiti mancanti, andamento delle vendite nel tempo | M |
| RF-BKO-2 | Elenco iscritti con filtri e ricerca, dettaglio della singola iscrizione con ordine, requisiti, servizi, check-in, storico | M |
| RF-BKO-3 | Esportazione in CSV di iscritti, ordini, incassi, presenze, con selezione delle colonne | M |
| RF-BKO-4 | Liste operative stampabili: elenco per ruolo, elenco pasti con diete, elenco taglie, elenco slot delle lezioni private | M |
| RF-BKO-5 | Gestione degli accrediti e degli omaggi per staff, cast e ospiti, con quota dedicata e tracciamento | M |
| RF-BKO-6 | Riepilogo economico dell'evento: incassato per metodo di pagamento, rimborsato, netto, fee, incasso alla porta | M |
| RF-BKO-7 | Registro delle attività dello staff sull'evento | M |
| RF-BKO-9 | Esportazione delle vendite con il **dettaglio per titolo e per sessione inclusa**, sufficiente all'organizzatore per le proprie ripartizioni e per i propri adempimenti, compresa l'eventuale separazione tra componente didattica e componente danzante | M |
| RF-BKO-10 | **Registrazione delle vendite effettuate su canali esterni**, per quantità e per titolo, così che i contatori di capienza e la disponibilità mostrata al pubblico restino veritieri. Inserimento manuale rapido, con storico e autore | M |
| RF-BKO-11 | Vista di **allineamento dei canali**: venduto online, venduto fuori, pass emessi manualmente, contingente residuo, totale rispetto alla capienza. È la schermata che l'organizzatore guarda prima di aprire le porte | M |
| RF-BKO-12 | I conteggi che comprendono emissioni manuali e vendite esterne sono **informativi e non bloccanti**: la piattaforma li mostra, non li impone, e dichiara sempre su quali dati sono calcolati | M |
| RF-BKO-8 | Costi dell'evento e calcolo del margine | 3 |

### 6.15 Amministrazione della piattaforma (ADM)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ADM-1 | Coda di approvazione degli organizzatori con scheda della richiesta e storico delle decisioni | M |
| RF-ADM-2 | Gestione dei **cataloghi**: tipi di evento con le loro capacità, tipi di requisito, tipi di servizio accessorio, preset di policy di rimborso, livelli, tag | M |
| RF-ADM-3 | Configurazione della fee di piattaforma: percentuale, importo fisso, minimo e massimo, eccezioni per organizzazione | M |
| RF-ADM-4 | Elenco organizzazioni, eventi, utenti con ricerca, sospensione e riattivazione | M |
| RF-ADM-5 | Coda dei contenuti segnalati (chat, wall, bacheca) con azioni di moderazione | M |
| RF-ADM-6 | Cruscotto di piattaforma: transato, fee maturate, organizzatori attivi, eventi pubblicati, utenti registrati | M |
| RF-ADM-7 | Impersonificazione di un utente per assistenza, con consenso registrato e traccia in audit log | M |
| RF-ADM-8 | Gestione dei **piani premium** e dei diritti associati, con interruttore generale di attivazione | M |
| RF-ADM-9 | Audit log immutabile delle azioni sensibili: approvazioni, sospensioni, accessi ai documenti, modifiche di prezzo, rimborsi | M |
| RF-ADM-10 | Le **soglie di contestazione** di RF-PAY-38 e la sensibilità della classificazione automatica delle immagini sono **parametri di configurazione della piattaforma**, modificabili dal Super Admin senza rilascio: le soglie dei prestatori cambiano nel tempo | M |

### 6.16 Piano premium ed entitlement (PRM)

| ID | Requisito | Pr. |
|---|---|---|
Progetto completo del piano, catalogo dei diritti, tutele, adempimenti e soglie di attivazione
in **`07-piano-premium.md`**.

**L'applicazione di base è e resta gratuita**: registrarsi, consultare il calendario e il
programma, acquistare, ricevere i titoli e fare il check-in non costano nulla. Il Premium è una
seconda linea di ricavo, pagata dal ballerino, indipendente dalla fee sui biglietti e — con la
sola eccezione dell'accesso anticipato — indipendente dagli organizzatori.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PRM-1 | Modello dei piani con **diritti** associati, aggiungibili per configurazione | M |
| RF-PRM-2 | Ogni funzione premium verifica il diritto attraverso **un unico servizio di controllo**, mai con controlli sparsi | M |
| RF-PRM-3 | Interruttore globale che, a piano disattivato, concede il diritto a tutti: è così che il primo rilascio non impone il premium pur essendo progettato come se lo imponesse | M |
| RF-PRM-4 | Le interfacce sono predisposte per lo stato "funzione riservata al piano Premium", non visibile finché l'interruttore è spento | M |
| RF-PRM-5 | **Nessuna funzione di tutela è mai Premium**: blocco, segnalazione, controllo della propria visibilità, limiti alle richieste ricevute e cancellazione dei dati sono gratuiti per tutti, sempre | M |
| RF-PRM-6 | **Livello di ballo del profilo** con tre fonti distinte e mostrate separatamente: dichiarato dall'utente, desunto dallo storico delle sessioni frequentate in piattaforma, attestato da un maestro | M |
| RF-PRM-7 | Il confronto tra livelli è sempre motivato in modo verificabile ("ha frequentato quattro workshop avanzati negli ultimi dodici mesi"), mai ridotto a una sola etichetta | M |
| RF-PRM-8 | **Ricerca partner avanzata**: filtri per ruolo, livello, città, lingua ed evento a cui si partecipa. Esclusi deliberatamente genere, età, posizione precisa, distanza e presenza online | 2 |
| RF-PRM-9 | La messaggistica richiede **accettazione reciproca**: il diritto Premium sblocca l'iniziativa, non la conversazione. Chi non è abbonato riceve le richieste e risponde liberamente | 2 |
| RF-PRM-10 | Limite giornaliero alle richieste inviate, anche per gli abbonati; facoltà per chiunque di sospendere o restringere la ricezione | 2 |
| RF-PRM-11 | Nessun segnale di lettura o di rifiuto: ignorare una richiesta non produce alcuna informazione visibile a chi l'ha inviata | 2 |
| RF-PRM-12 | Codice di condotta con accettazione obbligatoria all'attivazione della funzione, e sospensione della sola funzione senza perdita dei biglietti in caso di violazione | 2 |
| RF-PRM-13 | **Accesso anticipato**: una finestra di vendita di RF-EVT-7 può essere riservata a un piano per un periodo definito, su titoli, slot e servizi accessori | 2 |
| RF-PRM-14 | L'accesso anticipato richiede l'**adesione dell'organizzatore evento per evento**: la piattaforma non dispone unilateralmente di inventario che non è suo | 2 |
| RF-PRM-15 | Date di apertura anticipata e pubblica dichiarate sulla pagina dell'evento fin dalla pubblicazione; tetto percentuale configurabile sull'inventario allocabile nella finestra riservata | 2 |
| RF-PRM-16 | Nessuna priorità di coda a pagamento: il vantaggio è la finestra temporale, non un privilegio dentro la stessa finestra | 2 |
| RF-PRM-17 | Sottoscrizione, addebito ricorrente con autenticazione forte, gestione dei tentativi falliti, periodo di tolleranza, rinnovo comunicato in anticipo e disdetta con lo stesso numero di passaggi della sottoscrizione | 2 |
| RF-PRM-18 | Alla cessazione i diritti decadono alla fine del periodo pagato, senza cancellare dati, biglietti o storico | 2 |
| RF-PRM-19 | L'incasso degli abbonamenti passa da un account di pagamento **proprio della piattaforma**, separato dall'infrastruttura marketplace dei biglietti, con documenti fiscali e numerazione propri | 2 |
| RF-PRM-20 | Gestione del diritto di recesso di quattordici giorni, che sui servizi digitali in abbonamento **si applica** a differenza dei biglietti per eventi con data certa | 2 |
| RF-PRM-21 | **Piano unico annuale a 4,99 €**, senza opzione mensile: l'attività dei ballerini è stagionale e si interrompe in estate. Preavviso di rinnovo obbligatorio, tentativi ripetuti in caso di carta scaduta, periodo di tolleranza prima della decadenza dei diritti | 2 |
| RF-PRM-23 | La scheda dell'evento e la conferma d'ordine dichiarano **prima dell'acquisto del biglietto** che la chat di sala richiede il Premium | M |
| RF-PRM-22 | Altri diritti previsti: annuncio in evidenza nella bacheca, avvisi anticipati sull'apertura delle iscrizioni degli eventi seguiti, archivio delle proprie foto proiettate, storico personale di partecipazione | 2 |

> **Sequenza di lancio.** Il Premium è interamente progettato dal primo rilascio con il suo
> interruttore, e **si attiva in fase 2 a data fissa**. Il prezzo di 4,99 € all'anno e la data
> fissa si sostengono a vicenda: la conversione alta costruisce in fretta la densità di profili
> di cui la ricerca partner ha bisogno. Restano tre condizioni preparatorie — lancio per
> densità e non per copertura, bacino precostituito dalla bacheca cerco-partner, livello
> desunto già alimentato — dettagliate in `07-piano-premium.md` §8.
>
> **Natura del piano.** A 4,99 € all'anno il netto per la piattaforma è di circa 3,77 € per
> abbonato: il Premium non è una linea di ricavo, è uno strumento di **qualificazione**. Un
> pagamento tracciato dietro ogni richiesta di contatto è, su una funzione di messaggistica tra
> sconosciuti, una misura di sicurezza prima che un ricavo — ed è l'argomento migliore per
> giustificare il paywall. Analisi economica in `07` §2.2.

---

## 7. Regole di business trasversali

| # | Regola |
|---|---|
| RB1 | Il prezzo esposto è dell'organizzatore. I **diritti di prevendita** sono ricavo della piattaforma, pagati dal partecipante, sempre visibili come voce separata prima del pagamento, e non transitano mai dall'organizzatore |
| RB2 | La capienza si impegna **all'avvio dell'ordine**, con una prenotazione temporanea a tempo che l'utente usa per completare l'acquisto, e si rilascia alla scadenza, al fallimento o all'abbandono. La sola consultazione del catalogo non blocca nulla |
| RB3 | Un acquisto è ammesso solo se **tutte** le quote **limitanti** coinvolte hanno capienza residua e se supera il cancello di tolleranza sui ruoli |
| RB4 | Uno **sforamento di pochi posti sulle quote commerciali è tollerato** e non genera rimborsi automatici: è una situazione gestibile in sala. Resta invalicabile la **capienza della sala**, che è un limite di sicurezza e non una scelta commerciale |
| RB5 | Sold out è definitivo. Nessuna lista d'attesa, nessuna promozione automatica |
| RB6 | Il ruolo di ballo non è mai derivato dal genere della persona |
| RB7 | Ogni ingresso è nominale e tracciato: un QR vale una sola volta per sessione |
| RB8 | Il trasferimento del biglietto ricalcola sempre le quote di ruolo e rivaluta i requisiti sul nuovo titolare |
| RB9 | Nessun contenuto raggiunge la wall senza approvazione esplicita di un moderatore |
| RB10 | Sulla wall e in chat compare il nickname, mai nome e cognome |
| RB11 | La chat richiede biglietto valido, **presenza accertata** — per check-in all'ingresso o per sblocco di sala — e diritto premium: tre condizioni congiunte |
| RB12 | Lo staff operativo vede l'esito di un requisito, non il documento che lo prova |
| RB13 | Un evento non è pubblicabile se l'organizzazione non è approvata e non ha un account di incasso collegato **e abilitato all'incasso** |
| RB14 | Una modifica sostanziale a un evento pubblicato dà diritto al rimborso integrale |
| RB15 | Ogni movimento di denaro è riconducibile a un ordine e a un evento: nessun incasso fuori sistema, nemmeno alla porta |
| RB16 | Ogni azione sensibile lascia una traccia non modificabile con autore e momento |
| RB17 | Un'iscrizione da novanta euro non fallisce per un servizio accessorio da venticinque: se manca solo un accessorio, si propone la rimozione e si chiede conferma, non si annulla l'ordine |
| RB18 | Nessuna modifica di capienza invalida un biglietto già emesso. Il limite è abbassabile anche sotto il venduto: l'effetto è la chiusura della vendita online, mai l'espulsione di qualcuno |
| RB20 | Le quote governano **la sola vendita online**. L'emissione manuale di pass da parte dell'organizzatore e le vendite sui suoi canali non sono mai bloccate: la piattaforma conta e mostra, non impedisce |
| RB21 | Ogni numero mostrato dichiara **su quali dati è calcolato**. Un conteggio che non comprende i canali esterni lo dice, invece di presentarsi come il quadro completo |
| RB19 | Le quote governano l'ammissione, il contatore presenze governa la sicurezza: sono due assi distinti e il check-in non consuma capienza |
| RB22 | Una **contestazione di addebito accolta** produce gli stessi effetti di un rimborso: biglietto invalidato, iscrizione decaduta, quote rilasciate. Nessun ingresso avviene con un titolo il cui incasso è stato revocato |
| RB23 | Nessuna immagine raggiunge la **chat** senza aver superato la classificazione automatica; nessun contenuto raggiunge la **wall** senza approvazione umana. Le due soglie sono distinte e cumulative, e un contenuto trattenuto e mai esaminato resta trattenuto |
| RB24 | **Nessuno risulta iscritto a un evento senza esserne informato e senza poter rifiutare.** Il rifiuto non lede chi ha pagato: restituisce il biglietto alla sua disponibilità |

---

## 8. Requisiti non funzionali

| Area | Requisito |
|---|---|
| **Lingue** | Interfaccia italiana e inglese complete; contenuti dell'organizzatore con seconda lingua opzionale. Valuta EUR, fuso Europe/Rome |
| **Dispositivi** | Progettazione mobile-first: l'acquisto avviene in gran parte da telefono. Console di moderazione e box office ottimizzate per tablet e desktop. Wall solo desktop a schermo intero |
| **Prestazioni** | Scheda evento utilizzabile entro 2,5 secondi su rete mobile; esito di scansione al check-in entro 1 secondo, anche offline; contenuto sulla wall entro 2 secondi dalla decisione del moderatore |
| **Concorrenza** | L'apertura delle vendite di un evento atteso concentra centinaia di accessi in pochi minuti: il decremento della capienza deve essere corretto sotto contesa, con protezione da automatismi e limitazione di frequenza |
| **Realtime** | Chat e wall su canale persistente con riconnessione automatica e recupero dei messaggi perduti |
| **Affidabilità** | Nessuna perdita di ordini o check-in. La coda offline del check-in sopravvive alla chiusura del browser e all'esaurimento della batteria |
| **Sicurezza** | Doppio fattore per i ruoli amministrativi, QR firmati, dati di pagamento mai transitanti dalla piattaforma, protezione da automatismi in fase di apertura vendite, limitazione di frequenza su chat e upload, scansione dei file caricati |
| **Accessibilità** | Percorso pubblico e area personale conformi a WCAG 2.1 AA. La wall è esclusa dalla navigabilità ma soggetta al vincolo sui lampeggi |
| **Osservabilità** | Tracciamento degli errori, metriche su vendite e pagamenti, allarme su rimborsi falliti, su schermi wall disconnessi e su code di sincronizzazione bloccate |
| **Conservazione** | Documenti dei requisiti e contenuti della chat cancellati automaticamente dopo il periodo configurato; dati contabili conservati secondo l'obbligo di legge |

---

## 9. Privacy e protezione dei dati

| Tema | Impostazione proposta |
|---|---|
| **Titolarità** | La piattaforma è titolare per gli account e i servizi comuni; l'organizzatore è titolare autonomo per i dati dei propri partecipanti. Serve un accordo di contitolarità o di responsabilità del trattamento, allegato alle condizioni per gli organizzatori |
| **Dati particolari** | Con l'esclusione di tesseramento e certificato medico, l'unico dato riconducibile alla salute che resta sono **diete e allergie** raccolte per i pasti: accesso ristretto, cancellazione automatica dopo l'evento, mai esposti nelle esportazioni generiche né nella vista di check-in. Nessun documento sanitario è conservato dalla piattaforma |
| **Minimizzazione** | Lo staff vede l'esito, non il documento. L'operatore di check-in vede nome, ruolo e titolo, non contatti né documenti |
| **Contenuti generati** | Le foto inviate in chat sono contenuti dell'utente proiettati in pubblico: serve un consenso esplicito e informato al momento del primo invio, con menzione della proiezione in sala, della conservazione e del **riutilizzo da parte dell'organizzatore**, che sui contenuti esportati diventa titolare autonomo (RF-WALL-50) |
| **Cancellazione dei contenuti** | La cancellazione automatica riguarda ciò che la piattaforma detiene e non può revocare le copie già esportate: va dichiarata per quello che è, e l'esportazione è ristretta ai soli contenuti effettivamente proiettati, cioè già resi pubblici in sala (RF-WALL-51, RF-WALL-53) |
| **Immagini di terzi** | Le foto scattate in sala ritraggono altre persone: il regolamento dell'evento deve disciplinare la ripresa, e la moderazione deve poter rifiutare contenuti che ritraggono terzi in modo inopportuno |
| **Dati inseriti da terzi** | Chi acquista per altri comunica dati di persone che non hanno fatto nulla. Si raccoglie **il minimo necessario all'emissione del titolo**, l'acquirente attesta di essere autorizzato, l'interessato riceve una richiesta di conferma e può rifiutare. Fino alla conferma nessun trattamento ulteriore ha luogo (RF-PAY-33, RF-CPL-13/14/15) |
| **Minori** | Account dai 14 anni compiuti, età per il consenso autonomo ai servizi online in Italia. Sotto quella soglia nessun account: il minore è iscritto da un adulto che dichiara di esercitare la responsabilità genitoriale. La chat è riservata ai maggiorenni (RF-ACC-10/11/12) |
| **Nickname** | La scelta di proiettare solo il nickname è una misura di minimizzazione, non un vezzo grafico. Essendo l'unico dato dell'autore che finisce su un maxischermo, è soggetto a filtro e può essere oscurato dal moderatore |
| **Consensi** | Granulari e versionati: condizioni, informativa, comunicazioni promozionali, partecipazione alla chat, conservazione e riutilizzo dei contenuti proiettati |
| **Diritti dell'interessato** | Accesso, esportazione, rettifica e cancellazione dall'area personale, con conservazione dei soli dati contabili obbligatori |
| **Trasferimenti** | Da verificare per ciascun fornitore utilizzato (pagamenti, invio email, archiviazione, **classificazione automatica delle immagini**) |

---

## 10. Roadmap

**Fase 1a — Primo taglio.** Il sottoinsieme che porta in vendita l'evento di un organizzatore
cliente: motore di capienza per intero · evento con sessioni, titoli e quote · scheda pubblica ·
checkout **solo Stripe** con prenotazione di 15 minuti e diritti di prevendita · biglietto QR e
trasferimento · ruolo di ballo e iscrizione a coppia · check-in offline · back-office con
esportazioni · email transazionali. Rimborsi, contestazioni e onboarding degli organizzatori
sono presidio umano. Perimetro, tagli e sostituti in **`13-primo-taglio.md`**.

> Con il solo Stripe la ripartizione dei diritti di prevendita è nativa: **Q19 esce dal percorso
> critico** e l'accordo di partner PayPal corre in parallelo allo sviluppo.

**Fase 1b — Completamento del primo rilascio.** Onboarding degli organizzatori con
approvazione · calendario e ricerca · PayPal e Satispay · motore di rimborso a scaglioni e
contestazioni di addebito · codici promozionali · bacheca cerco-partner · box office · chat e
Live Wall · console di piattaforma · entitlement predisposto e disattivato.

**Fase 2 — L'app del tanghero e l'estensione del dominio.** Le cinque funzioni della milestone
in **`12-app-tanghero.md`**: Social Matcher per workshop con lo stile di ballo · Tanda e DJ Live
Tracker · passaporto con Apple e Google Wallet e notifica geolocalizzata · mappa della community
in opt-in · bacheca dei nomadi. Con esse: corsi ricorrenti con registro presenze · lezioni
private con calendario del maestro e ruolo Maestro · attivazione del piano premium · bonifico
bancario · wall multi-schermo e layout alternativi · wall consultabile dai partecipanti ·
credito interno · widget da incorporare.

**Fase 3 — Scala e sofisticazione.** Selezione manuale delle candidature e lotteria per gli
encuentros · liste d'attesa · gestione alloggi con matching di ospitalità · costi e margine
dell'evento · notifiche push e canali di messaggistica · apertura internazionale con
multivaluta e multi-paese · integrazioni contabili e fiscali · profili pubblici e componente
sociale, se il posizionamento lo richiederà.

---

## 11. Rischi e questioni aperte

### Rischi

| # | Rischio | Impatto | Mitigazione proposta |
|---|---|---|---|
| R1 | ~~Contesa sull'ultimo posto~~ | Ridotto a basso | **Chiuso**: la capienza si impegna all'avvio del pagamento e lo sforamento di pochi posti sulle quote commerciali è accettato. Resta il solo presidio del limite assoluto di sala |
| R1b | **Posti bloccati da ordini abbandonati**: la prenotazione temporanea sottrae posti anche a chi non concluderà. In apertura vendite di un evento atteso, decine di ordini abbandonati in contemporanea fanno apparire esaurito ciò che non lo è | Medio-alto in apertura vendite | Durata breve e configurabile, una sola prenotazione attiva per utente e per evento, rilascio immediato all'abbandono esplicito, processo di recupero delle prenotazioni scadute, monitoraggio del tasso di abbandono e del tempo medio di completamento sul primo evento reale |
| R2 | **Ripartizione dei diritti di prevendita non supportata da tutti i prestatori di pagamento** | Alto sui ricavi se non risolto | Stripe nativo al lancio; accordo di partner per PayPal da avviare subito per i tempi di approvazione; verifica su Satispay, con rinvio del metodo se la ripartizione non esiste |
| R3 | **Rete assente in sala**: chat inutilizzabile e wall a schermo nero davanti al pubblico | Alto sulla percezione | Buffer locale della wall (RF-WALL-37), verifica preventiva della rete in fase di allestimento, check-in comunque offline |
| R4 | **Contenuto inopportuno proiettato** su un maxischermo | Alto, anche legale | Nessuna proiezione senza approvazione, schermo di cortesia immediato, filtro automatico, doppio moderatore sugli eventi grandi |
| R5 | **Bacheca cerco-partner usata in modo improprio** | Alto sulla fiducia della community | Nessuna email esposta, messaggistica interna, segnalazione, blocco, codice di condotta pubblicato |
| R6 | **Adozione degli organizzatori**: la fee sul partecipante è accettata, ma il cambio di abitudini è il vero ostacolo | Alto sul business | Importazione della lista contatti, affiancamento sul primo evento, esportazioni che sostituiscano i fogli di calcolo esistenti |
| R7 | **Assenza di liste d'attesa** su eventi che vanno esauriti in minuti: domanda inevasa e pressione sull'organizzatore | Medio | Monitorare la frequenza dei sold out; è il primo candidato al rientro in scopo |
| R8 | ~~Dati sanitari trattati in un contesto amatoriale~~ | — | **Chiuso**: nessun certificato medico e nessun documento sanitario entra in piattaforma. Restano le sole diete per i pasti |
| R15 | ~~Obbligo del titolo di accesso fiscale~~ | **Chiuso** | Adempimenti dell'organizzatore, fuori dalla piattaforma. La piattaforma **affianca la biglietteria dell'organizzatore e non è l'unico canale di vendita**: la qualificazione di canale di prevendita è quindi solida. Reggono il posizionamento RF-TCK-11, RF-ORG-8 e RF-BKO-9 |
| R17 | **Disallineamento tra canali di vendita**: vendendo l'organizzatore anche fuori dalla piattaforma, i contatori di capienza non conoscono quelle vendite. La disponibilità mostrata al pubblico è sovrastimata e l'evento può risultare pieno in sala pur risultando aperto online | **Alto sull'operatività e sulla fiducia** | Contingente riservato ai canali esterni non vendibile online, registrazione delle vendite esterne, allineamento prima dell'apertura porte, ingresso gestibile anche per chi ha acquistato altrove |
| R16 | **Segmento di mercato escluso**: le milonghe settimanali operano in forma associativa e non possono usare la piattaforma senza cambiare il proprio inquadramento | Medio-alto sul volume | Scelta consapevole: il primo rilascio si rivolge a festival, marathon, encuentro e stage, che sono anche gli eventi con biglietto più alto e maggior bisogno delle funzioni distintive. Da dichiarare come posizionamento, non subire come sorpresa |
| R9 | **Complessità del wizard** di creazione evento generato dalle capacità del tipo | Medio | Preset per tipologia, percorso rapido per la milonga singola, anteprima costante |
| R10 | **Lancio prematuro del Premium** su una base utenti troppo piccola: la ricerca partner restituisce risultati vuoti e non mantiene la promessa | Alto, brucia la fiducia una volta sola | Soglie di attivazione (`07` §8), ricerca partner gratuita e limitata fino a quel momento |
| R11 | **La ricerca partner diventa un canale di molestie**, con effetti sulla reputazione dell'intera piattaforma nella community del tango | Il più alto del prodotto | Consenso reciproco obbligatorio, tutele sempre gratuite, nessuna funzione di prossimità o di presenza online, moderazione presidiata, codice di condotta |
| R12 | **Percezione di app di incontri travestita** | Alto e difficilmente reversibile | Esclusioni deliberate di genere, età e distanza; linguaggio dei testi; nessuna scoperta casuale di profili |
| R13 | **Gli organizzatori percepiscono l'accesso anticipato come disposizione arbitraria del loro inventario** | Alto sul rapporto con i clienti principali | Adesione volontaria evento per evento, tetto sull'inventario riservato, beneficio misurato e mostrato |
| R14 | **Doppia natura fiscale della piattaforma**: intermediaria sui biglietti, venditrice diretta sugli abbonamenti | Medio | Separare i flussi contabili e i documenti dall'inizio, non dopo |
| R18 | **Falsi positivi della classificazione automatica delle immagini**: una foto innocua trattenuta durante una serata in cui il tempo è tutto, e un partecipante che non capisce perché il suo contenuto non appare | Medio sull'esperienza | Coda prioritaria in console, notifica al moderatore, indicazione all'autore che il contenuto è in verifica e non perduto, soglia di sensibilità tarabile |
| R19 | **Sblocco di sala usato fuori dalla sala**: il QR della schermata di cortesia fotografato e condiviso allargherebbe la chat a chi non è presente | Medio sulla tenuta del vincolo di accesso | Codice a rotazione breve, verifica del possesso di un titolo valido, limitazione di frequenza, rigenerazione su richiesta del moderatore |
| R20 | **Biglietto senza titolare a ridosso dell'evento**: la persona iscritta da altri rifiuta tardi e non resta tempo per trasferire o rimborsare | Basso-medio | Richiesta di conferma inviata immediatamente, solleciti automatici, trasferimento proposto per primo all'acquirente |

### Questioni aperte

| # | Questione | Serve entro |
|---|---|---|
| Q1 | Le quattro decisioni sulla matrice dei ruoli (rimborsi alla cassa, pubblicazione autonoma dell'Event Manager, assegnazione per evento, preset "Staff") | Prima dello sviluppo dei permessi |
| Q2 | Meccanismo di raccolta della fee su PayPal e Satispay | Prima del checkout |
| Q3 | Contenuto del piano premium oltre alla chat, e prezzo | Prima della fase 2 |
| Q4 | Percentuali definitive della politica di rimborso e validazione legale dei T&C | Prima della pubblicazione |
| Q5 | Fatturazione: quali documenti emette la piattaforma, quali l'organizzatore, con quale strumento | Prima del primo incasso reale |
| Q6 | Tempistiche di conservazione di documenti dei requisiti e contenuti della chat | Prima del primo evento |
| Q7 | Timeline di progetto ed eventuale evento reale che fa da scadenza | Per la pianificazione |
| Q8 | Dati e utenti da migrare da sistemi esistenti | Per la pianificazione |
| Q9 | Disponibilità di uno o due organizzatori reali e di alcuni ballerini per la validazione dei flussi | Prima della progettazione delle interfacce |
| Q10 | Identità visiva: esiste un marchio "Mirada" con linee guida? | Prima della progettazione delle interfacce |
| Q13 | Contropartita per l'organizzatore che aderisce all'accesso anticipato (proposta: nessuna, con beneficio misurato) | Prima della fase 2 |
| Q16 | La data di attivazione del Premium coincide con l'inizio della fase 2 o cade più avanti dentro di essa? | Alla pianificazione della fase 2 |
| Q17 | Se alla data di attivazione lo storico è ancora sottile, il livello si presenta come indicazione e non come garanzia, puntando sull'attestazione dei maestri: si accetta? | Prima dell'attivazione |
| Q18 | Revisione del prezzo dopo il primo anno di dati: si programma da subito nelle condizioni contrattuali? | Prima dell'attivazione |
| Q19 | Ripartizione dei diritti di prevendita: attivazione dell'accordo di partner PayPal e verifica della fattibilità su Satispay | **Prima dello sviluppo del checkout** |
| ~~Q20~~ | ~~Minori~~ | **Chiusa** il 31 luglio (`11` D10): ammessi alle tre soglie di età |
| ~~Q21~~ | ~~Classificazione automatica delle immagini~~ | **Chiusa** il 31 luglio (`11` D11): adottata |
| ~~Q22~~ | ~~Contestazioni di addebito~~ | **Chiusa** il 31 luglio (`11` D12): penale all'organizzatore, doppia soglia |

### Sessioni di approfondimento da pianificare

I temi rinviati a una trattazione dedicata sono stati chiusi tutti. Ne resta traccia qui per
sapere dove sono stati risolti.

| Tema | Stato |
|---|---|
| ~~Titoli d'ingresso e pass multi-sessione~~ | **Chiuso** in `09-titoli-e-pass.md`: elenco esplicito delle sessioni incluse, scaglioni facoltativi, unità di vendita per persona o per coppia, un QR per biglietto. Chiude anche la correzione provvisoria A4 |
| ~~Tesseramento associativo~~ | **Chiuso**: il tesseramento avviene interamente fuori dalla piattaforma, almeno in fase 1. Nessuna entità da modellare; dove serve accertarlo, si usa una dichiarazione |
| ~~Titolo di accesso fiscale~~ | **Chiuso per posizionamento** all'ottavo giro: gli adempimenti restano dell'organizzatore e si svolgono fuori dalla piattaforma, che emette una conferma d'ordine con QR e non un titolo fiscale. Reggono RF-ORG-8, RF-TCK-11 e RF-BKO-9; il briefing `10` resta disponibile come consulenza di conferma, non come precondizione |
| ~~Audit, punti da B3 a C5~~ | **Chiuso** in `11-chiusura-audit.md`, con tre decisioni residue del committente (Q20, Q21, Q22) |
