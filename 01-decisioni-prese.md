# Mirada Tango — Decisioni prese in fase di raccolta requisiti

Aggiornato: 2026-07-30

## Impianto di prodotto

| Tema | Decisione | Conseguenze sull'analisi |
|---|---|---|
| Modello | **Marketplace multi-organizzatore** (SaaS) | Multi-tenancy, onboarding organizzatori, calendario pubblico comune, permessi per organizzazione, moderazione |
| Tipologie di evento | Milonghe/pratiche, festival e marathon/encuentro, stage/workshop, corsi ricorrenti e lezioni private — **con possibilità di aggiungerne di nuove in corso d'opera** | Il "tipo evento" è un'entità configurabile, non un enum nel codice: ogni tipo compone capacità, politiche di iscrizione e requisiti |
| Incassi | **Stripe Connect, incasso diretto all'organizzatore** + application fee della piattaforma | Nessuna custodia di fondi di terzi, KYC delegato al PSP, payout non gestiti dalla piattaforma |
| Monetizzazione | **Fee pagata dal partecipante**, "on top" e visibile in checkout | Prezzo esposto = netto organizzatore; la fee è configurabile (%, fisso, minimo/massimo) per organizzatore/piano |
| Ammissione | **First-come-first-served** + **quote per ruolo (leader/follower) con iscrizione a coppia** | Motore di capienza multi-dimensionale; gestione coppia (invito, sblocco 2 posti, scadenza pagamento partner, rottura coppia) |
| Community | **Bassa: solo ticketing** | Nessun profilo pubblico, feed, messaggistica o recensioni. L'utente ha account, biglietti, storico ordini |
| Adempimenti | **Configurabili per singolo evento** dall'organizzatore (tesseramento associativo e altri requisiti) | Motore di requisiti di partecipazione estensibile: tipi di requisito (tessera valida, documento con scadenza, dichiarazione, upload, campo custom) componibili per evento con blocco/avviso |
| Servizi accessori | **Selezionabili da catalogo in fase di creazione evento** (incl. lezioni private durante l'evento) | Catalogo di tipi di servizio, ognuno con prezzo, capienza propria e attributi specifici (taglia, dieta, slot orario) |
| Geografia e lingue | **Italia, interfaccia IT + EN**, valuta EUR | i18n dell'interfaccia dal giorno uno, contenuti organizzatore con campi traducibili opzionali; un solo regime fiscale |
| Check-in | **Web app con supporto offline** + **vendita alla porta (box office)** | Scansione QR multi-addetto, coda locale e sincronizzazione, anti-doppio-ingresso, incasso in loco con emissione immediata |
| Perimetro MVP | Ticketing completo con quote ruolo/coppia, lista d'attesa, Stripe, QR/check-in, requisiti configurabili. **Corsi ricorrenti e lezioni private in fase 2** | Roadmap a fasi; il modello dati però prevede già corsi e prenotazioni a calendario |
| Deliverable | **Analisi funzionale completa** + **versione presentabile al cliente** | Documento strutturato + impaginazione (PDF/pagina web) per stakeholder non tecnici |

## Secondo giro di decisioni (2026-07-30)

| Tema | Decisione | Conseguenze sull'analisi |
|---|---|---|
| **Modulo Live Wall + Chat** | **Dentro il primo rilascio.** Chat di evento in tempo reale con invio di testo e foto; console separata dove l'organizzatore decide cosa proiettare sulla *wall*. Attenzione particolare alla resa della schermata wall | Nuovo sottosistema realtime (canali per evento, upload media, moderazione, proiezione). Richiede un capitolo dedicato con specifica di layout, tipografia, leggibilità a distanza e comportamento in caso di rete instabile |
| Acconti | **Aboliti**: si paga l'intero importo in fase di acquisto | Nessun saldo, nessun sollecito, nessun ordine parzialmente pagato |
| Rimborsi | **Politica da definire dall'analista** (proposta in `03-politica-rimborsi.md`) | Motore di rimborso a scaglioni configurabile entro limiti di piattaforma |
| Cambio nominativo | **Sì**, trasferimento del biglietto ad altro ballerino | Storico titolarità del biglietto, invalidazione del QR precedente, limite temporale |
| Metodi di pagamento | **Stripe (carta), PayPal, Satispay**. Bonifico bancario in sviluppi futuri | Astrazione multi-PSP dal giorno uno: la fee e la riconciliazione non possono dipendere da Stripe |
| Onboarding organizzatori | Registrazione libera con **approvazione obbligatoria del super admin di piattaforma** | Stato "in attesa di approvazione", coda di verifica, motivazione del rifiuto, riapprovazione |
| Ruoli | **Serve una matrice di ruoli granulare**, da definire insieme (proposta in `02-matrice-ruoli.md`) | Permessi per singola capacità, non per ruolo monolitico |
| Co-organizzazione | **No** | Un solo titolare per evento, nessuno split degli incassi |
| Pagina evento | **Non personalizzabile**: layout unico di piattaforma, con **upload della locandina** | Un solo template di pagina evento; la locandina va gestita in più formati e ritagli |
| Quote di capienza | **Interamente customizzabili in fase di creazione evento** | Quote per ruolo, per titolo, per sessione, per servizio: tutte definite dall'organizzatore, nessuna regola imposta |
| Carrello e scadenze | **Nessun hold, nessuna scadenza**: si mette nel carrello ciò che si vuole e si paga subito | Capienza decrementata al pagamento riuscito, non alla selezione. Serve gestione della contesa: due utenti sull'ultimo posto |
| Liste d'attesa | **No** | Sold out è definitivo; niente promozione automatica |
| Cerco-partner | **Sì**, bacheca per stage e lezioni a coppie | Annuncio con evento, ruolo cercato, livello, contatto; unica eccezione al perimetro "solo ticketing" |
| Stack tecnologico | Fuori scope in questa fase | L'analisi resta tecnologicamente neutra |

## Terzo giro — modulo Chat e Live Wall (2026-07-30)

| Tema | Decisione |
|---|---|
| Accesso alla chat | **Tre condizioni congiunte**: biglietto valido + **check-in effettuato** (QR scansionato) + **piano premium attivo**. Il piano premium **non è un requisito del primo rilascio**, ma l'architettura va progettata come se il vincolo fosse già obbligatorio |
| Moderazione | **Chat libera, wall curata**: i messaggi appaiono subito in chat, sulla wall va solo ciò che il moderatore seleziona |
| Layout wall | **Focus singolo a rotazione**: un contenuto per volta, grande, transizione morbida, leggibile a 15-20 metri in sala buia |
| Output wall | **Solo browser a schermo intero con codice schermo**. Multi-schermo, wall consultabile dai partecipanti e resilienza offline restano fuori dal primo rilascio |

### Conseguenze da non sottovalutare

- **Nasce una seconda linea di ricavo**: l'abbonamento premium del ballerino, accanto alla fee
  sul biglietto. Serve un **layer di entitlement** (piani, abbonamenti, diritti) presente nel
  modello dati dal giorno uno e governato da un interruttore di configurazione, spento in MVP.
  Va deciso cosa comprende il premium oltre alla chat.
- Il vincolo del check-in rende la chat un **servizio di sala**: la sua durata di vita coincide
  con l'evento, e la sua utilità dipende dalla rete presente in location.
- **Rischio segnalato**: avendo escluso la resilienza offline, un calo di rete durante l'evento
  manda la wall a schermo nero davanti al pubblico. Mitigazione minima proposta e inclusa
  nell'analisi: buffer locale del contenuto in proiezione e degli ultimi contenuti approvati,
  così la rotazione continua anche senza connessione.

### Punto di attenzione aperto (segnalato)

L'assenza di hold e scadenze è coerente con l'assenza di liste d'attesa, ma incide
sull'**iscrizione a coppia**: senza posti riservati e senza finestra di pagamento per il
partner, la coppia funziona in un solo modo pulito — **un unico ordine paga entrambi i
posti** (chi iscrive inserisce i dati del partner e salda per due). L'alternativa "invito al
partner che paga dopo" richiederebbe per forza un hold. Procedo con l'ordine unico, salvo
diversa indicazione.

## Quarto giro — modello Premium (2026-07-30)

| Tema | Decisione |
|---|---|
| Applicazione di base | **Gratuita**: registrazione, consultazione di calendario e programma, acquisto, biglietti e check-in non costano nulla |
| Premium | **Funzionalità a pagamento per i ballerini**, come seconda linea di ricavo accanto alla fee sui biglietti. Ordine di grandezza indicato: 4,99 € |
| Funzioni Premium indicate dal committente | **Ricerca partner avanzata** con filtro per livello di ballo · **accesso prioritario** alle prenotazioni dei maestri più richiesti |
| Prezzo | **4,99 € all'anno**, piano unico, nessuna opzione mensile |
| Chat di evento | **Resta Premium**, come già deciso. Da dichiarare prima dell'acquisto del biglietto |
| Fee ridotta sui biglietti | **Esclusa** dal piano |
| Attivazione | **Fase 2, a data fissa**, indipendentemente dai numeri raggiunti |

### Conseguenze rilevanti

- Il **livello di ballo diventa un attributo della persona**, non solo della sessione. Poiché
  l'autodichiarazione nel tango è inaffidabile, il livello si compone di tre fonti mostrate
  separatamente: dichiarato, **desunto dallo storico delle partecipazioni in piattaforma** (dato
  che nessun concorrente possiede) e attestato da un maestro.
- Il perimetro «solo ticketing, community bassa» **cambia**: il prodotto acquisisce una
  componente relazionale a pagamento, con il profilo di rischio e i requisiti di moderazione
  che ne derivano.
- L'accesso prioritario è l'unica funzione Premium che **dispone di inventario non della
  piattaforma**: richiede l'adesione dell'organizzatore evento per evento.
- La piattaforma diventa **venditrice diretta al consumatore** sugli abbonamenti, non più solo
  intermediaria: account di incasso proprio, IVA ordinaria, documenti e numerazione propri,
  addebito ricorrente e diritto di recesso di quattordici giorni, che sui servizi digitali si
  applica a differenza dei biglietti per eventi con data certa.
- Progetto completo, tutele, adempimenti, soglie di attivazione e sei decisioni residue in
  `07-piano-premium.md`.

## Quinto giro — risoluzione dell'audit (2026-07-30)

| Tema | Decisione |
|---|---|
| Impegno di capienza | **Prenotazione temporanea a tempo all'avvio dell'ordine**, come nei ticketing generalisti: il posto è bloccato per la finestra che l'utente usa per completare l'acquisto, e si rilascia alla scadenza, al fallimento o all'abbandono. Riarmata all'avvio del pagamento per coprire il reindirizzamento al prestatore. **Durata 15 minuti, sempre attiva su ogni evento**, parametro di piattaforma e non dell'organizzatore. Uno **sforamento di pochi posti resta accettato** come rete di sicurezza |
| Diritti di prevendita | Pagati dal partecipante e **incassati dalla piattaforma**, non dall'organizzatore |
| Moderazione del primo evento | **Eliminata**: un solo cancello, all'approvazione dell'organizzazione |
| Cardinalità | **Una iscrizione per persona per evento**, con più biglietti collegati |
| Modello fiscale | Impostato **come i ticketing generalisti italiani**: prezzo dell'organizzatore più diritti di prevendita della piattaforma |

### Temi rinviati a sessioni dedicate

| Tema | Stato provvisorio |
|---|---|
| **Titoli d'ingresso e pass multi-sessione** | RF-EVT-7 e RF-EVT-8 restano ipotesi non concordate. L'utilizzo del biglietto è modellato per coppia biglietto-sessione, che è la forma più generale e non pregiudica nessuna scelta |
| **Tesseramento associativo** | Requisito presente, **entità assente dal modello dati**: è il debito di analisi più rilevante ancora aperto |
| **Modello fiscale degli organizzatori non commerciali** | Impostazione generale definita; resta da chiudere il trattamento di associazioni e quote associative, che riguarda la maggioranza delle milonghe |

### Nota dell'analista sullo sforamento

Lo sforamento è stato accettato sulle quote commerciali, e la semplificazione che ne deriva è
reale: cade la necessità del percorso di rimborso automatico per vendita oltre capienza. Ho
però escluso lo sforamento sulla **capienza della sala**, che non è un limite commerciale ma un
vincolo di sicurezza, spesso fissato da un'autorizzazione o da un certificato di prevenzione
incendi, e la cui responsabilità in caso di controllo ricade sull'organizzatore. Consentirgli di
superarlo per una svista di configurazione sarebbe un danno fatto a lui, non un servizio.

## Sesto giro — tesseramento (2026-07-31)

| Tema | Decisione |
|---|---|
| Natura dei titoli | **Solo biglietti commerciali.** Nessuna vendita come quota di partecipazione riservata ai soci |
| Tesseramento | **Interamente fuori dalla piattaforma**, almeno in fase 1: nessuna anagrafica delle tessere, nessuna vendita della quota associativa, nessuna verifica automatica |
| Certificato medico | **Non trattato.** Nessun documento sanitario entra in piattaforma |

### Cosa si semplifica

- Cadono l'entità Tessera, l'ente affiliante, l'anno associativo, la domanda di ammissione a
  socio e il portafoglio delle tessere.
- Cade il trattamento dei **dati sanitari**: niente cifratura dedicata, niente accessi tracciati
  sui documenti, niente valutazione d'impatto, niente cancellazione automatica dei certificati.
  Restano solo diete e allergie per i pasti. Il rischio R8 si chiude.
- L'upload di documenti nei requisiti esce dal primo rilascio: restano dichiarazioni e campi
  custom, che non trattano dati di nessun tipo.
- Il modello fiscale diventa uniforme: un solo tipo di titolo, un solo regime.

### Cosa si complica, e va detto

Era la **natura associativa** a tenere la maggior parte degli eventi di ballo fuori dal regime
del titolo di accesso fiscale. Vendendo solo biglietti commerciali quella strada non è più
percorribile, e l'obbligo del titolo di accesso passa **da eventuale ad attuale** per gli eventi
soggetti. La verifica con un commercialista dello spettacolo diventa una precondizione per
aprire le vendite del primo evento reale.

Cambia anche il **segmento di mercato del primo rilascio**: le milonghe settimanali operano in
forma associativa e restano fuori. Il perimetro si sposta su festival, marathon, encuentro e
stage — che sono però anche gli eventi con il biglietto più alto e il maggior bisogno delle
funzioni distintive della piattaforma. È una scelta coerente, purché dichiarata come
posizionamento.

## Settimo giro — titoli e pass (2026-07-31)

| Tema | Decisione |
|---|---|
| Sessioni incluse | **Elenco esplicito**, non una regola: aggiungere una sessione a evento pubblicato non cambia i titoli già venduti |
| Scaglioni di prezzo | **Facoltativi e definiti dall'organizzatore in fase di creazione**: a data, a quantità o combinati. Default: **prezzo unico che non cambia mai** |
| Blocco del prezzo | **Alla creazione dell'ordine**, coerentemente con la prenotazione da quindici minuti |
| Unità di vendita | Per persona o **per coppia**; il titolo a coppia non è acquistabile da solo |
| Sovrapposizioni | **Avvisare senza bloccare**, senza doppio consumo delle quote di sessione |
| QR | **Uno per biglietto**, non uno per sessione: in sala nessuno cerca il codice giusto tra dodici |
| Composizione libera e upgrade di titolo | **Fase 2** |

Chiude definitivamente la correzione provvisoria **A4**: l'utilizzo non è uno stato del
biglietto ma un check-in sulla coppia biglietto-sessione, con sessione implicita per gli eventi
semplici. Dettaglio completo in `09-titoli-e-pass.md`.

## Ottavo giro — posizionamento fiscale (2026-07-31)

| Tema | Decisione |
|---|---|
| Adempimenti fiscali e SIAE | **In capo all'organizzatore, gestiti fuori dalla piattaforma**, come già avviene oggi |
| Natura della piattaforma | **Strumento di vendita, non intermediario fiscale.** Emette una conferma d'ordine con QR di accesso, non un titolo fiscale |
| Verifica fiscale | **Non è più una precondizione allo sviluppo.** Il briefing `10` resta disponibile come consulenza di conferma |

### Le tre condizioni che tengono in piedi il posizionamento

1. **RF-ORG-8** — l'organizzatore dichiara il proprio inquadramento e attesta per ogni evento di
   adempiere a ciò che gli compete, con dichiarazione versionata e richiamata dalle condizioni.
2. **RF-TCK-11** — il documento emesso è dichiaratamente una conferma d'ordine: nessuna
   numerazione progressiva, nessun sigillo, nessuna dicitura che possa farlo sembrare un titolo
   fiscale.
3. **RF-BKO-9** — esportazione delle vendite con il dettaglio per titolo e per sessione, così
   che l'organizzatore possa fare le proprie ripartizioni. Senza questa terza condizione il
   posizionamento sarebbe uno scarico di responsabilità; con essa è una divisione di compiti.

La piattaforma continua a documentare e assoggettare a imposta **la propria componente** — i
diritti di prevendita — perché è ricavo suo e non dell'organizzatore.

### Sovranità dell'organizzatore sui numeri

| Tema | Decisione |
|---|---|
| Totale posti | L'organizzatore lo **aggiorna quando vuole**, anche sotto il venduto: si chiude la vendita online, non si invalida nulla |
| Emissione manuale di pass | **A sua totale discrezione, in qualunque quantità, senza vincolo di capienza**, con QR annesso |
| Conteggi | La piattaforma **tiene conto e mostra a schermo**, come informazione **non bloccante** |
| Vendite fuori piattaforma | La gestione è una **scelta in fase di creazione dell'evento**: chi non la vuole non la incontra |

**Il principio che ne risulta**: le quote governano la **sola vendita online**, dove la
piattaforma non deve vendere ciò che non c'è. Verso l'organizzatore i contatori sono
informativi: conta e mostra, non impedisce. L'unica cautela mantenuta è che ogni numero
dichiari su quali dati è calcolato (RB21), perché un conteggio parziale presentato come
completo è peggio di nessun conteggio.

### Canali di vendita

**La piattaforma non è l'unico canale**: affianca la biglietteria dell'organizzatore. Questo
chiude definitivamente il residuo legale — la qualificazione di canale di prevendita è solida —
e R15 si chiude.

Ne discende però una **conseguenza funzionale che non era stata considerata**: vendendo
l'organizzatore anche fuori, i contatori di capienza non conoscono quelle vendite. La
disponibilità mostrata al pubblico risulterebbe sovrastimata, e l'evento potrebbe essere pieno
in sala pur risultando aperto online. Introdotti quindi il **contingente riservato ai canali
esterni** (RF-EVT-32), la **registrazione delle vendite esterne** (RF-BKO-10), la **vista di
allineamento dei canali** (RF-BKO-11) e l'**ingresso di chi ha comprato altrove** (RF-CHK-15).
Nuovo rischio R17.

## Nono giro — chiusura dell'audit (2026-07-31)

Chiusi i sedici punti che restavano aperti in `06-audit-analisi.md`, da **B3** a **C5**.
Risoluzione completa in `11-chiusura-audit.md`, requisiti recepiti nella revisione 1.1b di
`04-analisi-funzionale.md`.

| Tema | Decisione |
|---|---|
| **Contestazioni di addebito** | La piattaforma prende in carico l'intero ciclo per conto dell'organizzatore: fascicolo di prova costituito automaticamente, trasmissione entro il termine, esito applicato con lo stesso percorso del rimborso. I diritti di prevendita seguono la sorte della transazione |
| **Immagini in chat** | Classificazione automatica preventiva delle sole immagini, con trattenimento selettivo di ciò che risulta sospetto. La chat resta libera per il testo. Un contenuto trattenuto e mai esaminato resta trattenuto |
| **Nickname** | Filtrato alla creazione e a ogni modifica, oscurabile dal moderatore sulla wall: è l'unico dato dell'autore che finisce su un maxischermo |
| **Persone iscritte da altri** | Iscrizione in stato `da_confermare` che **non blocca mai l'ingresso**, facoltà di rifiuto che restituisce il biglietto all'acquirente, raccolta dei soli dati necessari all'emissione |
| **Account di incasso** | Si verifica lo **stato di abilitazione**, non il collegamento, e in modo continuativo. La decadenza sospende la vendita; biglietti emessi e rimborsi restano intatti |
| **Annullamento di una singola sessione** | Ammesso, con **peso di ripartizione** per sessione — default uniforme, personalizzabile — e rimborso proporzionale senza scaglioni. Oltre il 30% del peso del titolo scatta il diritto al rimborso integrale |
| **Carnet** | Confermato fuori dal primo rilascio per conseguenza della decisione sul tesseramento, con la dipendenza dichiarata |
| **Minori** | Account dai 14 anni; sotto quella soglia nessun account e iscrizione da parte di un adulto; chat riservata ai maggiorenni; l'organizzatore dichiara sull'evento se li ammette |
| **Wall** | Modalità prova con carta di calibrazione per l'allestimento, e rotazione di sicurezza sui soli contenuti già approvati quando manca il presidio: la wall non resta mai a schermo fisso per ore |
| **Chat negli eventi senza check-in** | **Sblocco di sala**: il QR della schermata di cortesia vale come check-in leggero ai soli fini della chat, con codice a rotazione breve |
| **Archivio della wall** | L'esportazione comprende i soli contenuti **effettivamente proiettati**, e il consenso al primo invio dichiara che l'organizzatore può conservarli e riutilizzarli |
| **Carrello multi-organizzatore** | Suddivisione automatica in un ordine per organizzatore, con pagamenti sequenziali. I **diritti di prevendita si calcolano per biglietto**, così la suddivisione non cambia il totale |
| **Traduzioni** | La seconda lingua copre tutti i testi dell'organizzatore che compaiono in un percorso di acquisto o di adempimento, non la sola descrizione dell'evento |
| **Chiusura della vendita** | Quattro criteri configurabili — data, esaurimento, decisione manuale, inizio dell'evento — e chiude il primo che si verifica. Riguarda la sola vendita online |
| **Numerazione dei requisiti** | Rinumerazione continua **una sola volta**, alla revisione 1.2, con tabella di corrispondenza. Da lì in avanti gli identificativi sono stabili e mai riusati |

### Le tre decisioni residue, chiuse in giornata

Confermate dal committente il 31 luglio 2026, tutte e tre secondo la raccomandazione
dell'analista. **L'audit non ha più alcuna voce aperta.**

| # | Decisione | Esito |
|---|---|---|
| D10 | Minori | **Ammessi** alle tre soglie: account dai 14 anni compiuti · sotto i 14 nessun account, iscrizione da parte di un adulto che dichiara di esercitare la responsabilità genitoriale · chat riservata ai maggiorenni. L'organizzatore dichiara sull'evento se li ammette e a quali condizioni |
| D11 | Classificazione automatica delle immagini | **Adottata.** Ogni immagine è classificata prima di comparire in chat; ciò che risulta sospetto è trattenuto in attesa di un moderatore e non è visibile a nessuno. Il costo ricorrente entra in piano; il fornitore entra nell'elenco dei trasferimenti dell'informativa |
| D12 | Contestazioni di addebito | **Penale del prestatore a carico dell'organizzatore**, dichiarata nelle condizioni di servizio. **Soglia di sospensione allineata a quella del prestatore**, con avviso all'Owner al superamento di una soglia di attenzione inferiore |

**Perché la penale all'organizzatore.** La contestazione nasce nel rapporto tra organizzatore e
partecipante — evento diverso da quello promesso, rimborso non concesso, comunicazione assente —
e la piattaforma non ha leva su nessuna di queste cause. Farla ricadere su chi può prevenirla è
anche l'unico incentivo che funziona. La piattaforma sopporta comunque lo storno dei propri
diritti di prevendita (RF-PAY-30), quindi non è indenne: entrambe le parti perdono qualcosa, ed
entrambe hanno motivo di evitare che accada.

**Perché la soglia allineata al prestatore.** Fissarne una più severa sarebbe arbitrario, una
più permissiva sarebbe inutile: oltre la propria soglia il prestatore sospende comunque
l'account, e un organizzatore che non può incassare non può operare (RF-ORG-11). Alla
piattaforma resta il compito di **avvisare prima**, con una soglia di attenzione più bassa che
dà all'organizzatore il tempo di correggere.

### Un effetto collaterale utile

Il **peso di ripartizione per sessione**, introdotto per calcolare il rimborso di una sessione
annullata, è esattamente la struttura dati che servirebbe se la verifica fiscale rispondesse che
un pass misto va scomposto tra componente didattica e componente danzante (`10` domanda 8). Un
requisito nato per i rimborsi copre gratuitamente l'unico rischio fiscale che avrebbe imposto
una modifica al modello dati.

## Decimo giro — strategia di prodotto e ordine di costruzione (2026-07-31)

| Tema | Decisione |
|---|---|
| **Priorità immediata** | Mettere gli **organizzatori già clienti** in condizione di aprire le prenotazioni del prossimo evento. Perimetro in `13-primo-taglio.md` |
| **L'app del tanghero** | **Resta in fase 2.** Cinque funzioni indicate dal committente, registrate come milestone di progetto in `12-app-tanghero.md`: Social Matcher per workshop · Tanda e DJ Live Tracker · passaporto con wallet e notifica geolocalizzata · mappa della community · bacheca dei nomadi |
| **Chi promuove il prodotto** | I ballerini. L'adozione degli organizzatori è **dal basso**: il tanghero usa l'app e chiede al proprio organizzatore di esserci. Ne discende che l'app dev'essere gratuita e curata nell'estetica |
| **Estetica** | Toni caldi e scuri — nero, bordeaux come superficie, oro e avorio come testo — transizioni fluide. Eredita la palette che RF-WALL-31 già impone alla wall per ragioni funzionali, con verifica di contrasto WCAG 2.1 AA sulla palette |
| **Prestatore di pagamento del primo taglio** | **Solo Stripe.** La ripartizione dei diritti di prevendita è nativa: **Q19 esce dal percorso critico** e l'accordo PayPal corre in parallelo allo sviluppo |
| **Fasi** | La fase 1 si articola in **1a — primo taglio** e **1b — completamento**. L'app del tanghero apre la fase 2 |

### Le tre previsioni da fare in fase 1 perché la fase 2 non costi il doppio

1. La rotazione della **Live Wall accetta un segnale esterno di avanzamento**, oltre al proprio
   timer: è ciò che permetterà al tracker delle tande di dare il ritmo alla proiezione. La
   cortina è già indicata nel glossario come il momento naturale della rotazione, ed è il momento
   di massima attenzione della serata.
2. Il **check-in registra la presenza anche dove non c'è vendita**: passaporto e livello desunto
   valgono in proporzione a quante presenze conoscono.
3. Il **profilo ha spazio per attributi di ballo estensibili** — livello, stile, e ciò che verrà.

### Conseguenze da registrare

- Il perimetro «solo ticketing, community bassa» **cade definitivamente**: mappa della community,
  bacheca dei nomadi e passaporto sono componenti relazionali piene.
- Le **notifiche push** passano dalla fase 3 alla fase 2.
- Lo **stile di ballo** (milonguero, salon, nuevo) entra nel profilo: per l'abbinamento tra due
  ballerini discrimina più del livello.
- La decisione **D2 — chat riservata al Premium — va riesaminata** prima della fase 2: se il
  ballerino è il promotore, la funzione più condivisibile del prodotto è dietro il paywall meno
  redditizio. Nuova decisione **D14**.
- Nuove decisioni aperte: **D13** app nativa o web, **D14** chat gratuita o Premium, **D15**
  catalogo degli stili, **D16** contropartita per il DJ che alimenta il tracker.

## Principio architetturale trasversale emerso

Tre risposte su quattro convergono sullo stesso principio: **l'organizzatore configura, la piattaforma non impone**.
Tipi di evento, requisiti di partecipazione e servizi accessori sono cataloghi estensibili
selezionati e parametrizzati in fase di creazione evento. L'analisi tratterà quindi come
requisito di primo livello un modello "component-based" dell'evento, non uno schema rigido
per tipologia.

## Punti ancora aperti

Vedi `00-questionario-analisi.md` per il questionario integrale. Aggiornato dopo il nono giro:

| # | Tema | Natura |
|---|---|---|
| 1 | **Data di apertura vendite del primo evento reale** (Q7): è la scadenza vera del progetto | Per pianificare a ritroso il primo taglio |
| 2 | **D13–D16**: app nativa o web, chat gratuita o Premium, catalogo degli stili, contropartita per il DJ | Prima della pianificazione della fase 2 |
| 3 | **Le quattro decisioni sulla matrice dei ruoli** (Q1) | Prima dello sviluppo dei permessi |
| 4 | **Versione presentabile al cliente** | Deliverable concordato, non ancora prodotto |
| 5 | **Revisione 1.2** di `04` con la rinumerazione continua dei requisiti (C1) | Contestuale al deliverable per il cliente |
| 6 | Contropartita per l'accesso anticipato, data di attivazione del Premium, presentazione del livello, revisione del prezzo (Q13, Q16, Q17, Q18) | Prima della fase 2 |
| 7 | Stack tecnologico, migrazione dati, identità visiva (Q8–Q10) | Fuori scope dell'analisi finora |

**L'audit `06` non ha più alcuna voce aperta.** La **ripartizione su PayPal e Satispay (Q19)**
non è più bloccante: con il solo Stripe nel primo taglio, l'accordo di partner corre in
parallelo allo sviluppo.

Le politiche di rimborso, l'onboarding e la moderazione degli organizzatori e il pagamento in
acconto sono chiusi rispettivamente in `03`, al secondo e quinto giro, e al secondo giro.
