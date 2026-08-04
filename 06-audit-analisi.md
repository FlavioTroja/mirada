# Mirada Tango — Audit critico dell'analisi

**Data** 30 luglio 2026 · Revisione dei documenti da `01` a `05`

Autoverifica dell'analisi: contraddizioni tra documenti, temi non trattati, definizioni
ambigue. Ogni voce riporta dove si trova il problema e una proposta di risoluzione. Le voci
marcate **[DECISIONE]** non possono essere chiuse dall'analista.

Sintesi: **5 contraddizioni**, **13 buchi di analisi**, **5 punti di chiarezza formale**.

## Stato delle risoluzioni — aggiornato al 31 luglio 2026

> **L'audit è chiuso integralmente.** I punti da **B3 a C5** sono chiusi in
> `11-chiusura-audit.md`, che ne riporta la risoluzione punto per punto e i 34 requisiti che ne
> discendono. Le tre scelte di merito del committente — ammissione dei minori (D10), adozione
> della classificazione automatica delle immagini (D11), regime delle contestazioni di addebito
> (D12) — sono state **confermate il 31 luglio 2026**, tutte secondo la raccomandazione
> dell'analista.
>
> Il testo che segue è la versione originale dell'audit del 30 luglio, conservata perché
> documenta il problema così come è stato rilevato. Le proposte in esso contenute sono state in
> parte superate dalle risoluzioni: fa fede `11`.


| # | Esito |
|---|---|
| **A1** impegno di capienza | **Chiuso.** La capienza si impegna **all'avvio del pagamento**, con rilascio su fallimento o scadenza tecnica. Uno **sforamento di pochi posti sulle quote commerciali è accettato** in fase 1 e non genera rimborsi automatici. Recepito in `04` RB2, RB4, RF-PAY-8/9/11 e in `05` §5.1. *Con una sola eccezione introdotta dall'analista: la capienza della sala non ammette sforamento, essendo un limite di sicurezza e non commerciale* |
| **A2** natura della fee | **Chiuso nel merito.** I diritti di prevendita sono **ricavo della piattaforma, pagati dal partecipante**, e non transitano mai dall'organizzatore. L'ipotesi di maturarli come credito verso l'organizzatore è scartata. Resta un vincolo tecnico: la ripartizione in un pagamento unico dipende da cosa supporta ciascun prestatore (`04` §6.5) |
| **A3** doppio cancello di approvazione | **Chiuso.** Eliminata la moderazione del primo evento: il controllo della piattaforma avviene una volta sola, all'approvazione dell'organizzazione |
| **A4** stato `utilizzato` del biglietto | **Rinviato** alla sessione dedicata a titoli e pass. Applicata nel frattempo la sola correzione neutra: l'utilizzo è un check-in sulla coppia biglietto-sessione, con sessione implicita per gli eventi semplici. Non pregiudica nessuna scelta futura sui titoli |
| **A5** cardinalità Biglietto ↔ Iscrizione | **Chiuso.** Una iscrizione per persona per evento, con più biglietti collegati. Consumi di capienza, requisiti, ruolo e presenze sull'iscrizione; valore economico e trasferibilità sul biglietto |
| **B1** tesseramento | **Chiuso per esclusione dallo scopo.** Il tesseramento avviene interamente fuori dalla piattaforma: nessuna entità da modellare, nessuna vendita di quota associativa, nessuna verifica automatica. Dove un organizzatore deve accertarlo, usa una dichiarazione |
| **B2** modello fiscale | **Semplificato**: tutti i titoli sono biglietti commerciali, con prezzo dell'organizzatore più diritti di prevendita della piattaforma. Cade la doppia natura del titolo. **Resta aperto il regime del titolo di accesso** (`08` §3.2 bis), che questa scelta rende attuale anziché eventuale |
| **B3** chargeback | **Chiuso** (`11` §3). Ciclo della contestazione preso in carico dalla piattaforma per conto dell'organizzatore: fascicolo di prova automatico, esito applicato come un rimborso, monitoraggio del tasso. RF-PAY-27→32 e RF-PAY-38, RF-ORG-13, RB22. **D12** confermata: penale al prestatore a carico dell'organizzatore, doppia soglia di attenzione e sospensione |
| **B4** moderazione immagini e nickname | **Chiuso** (`11` §3). Classificazione automatica preventiva delle sole immagini, con trattenimento selettivo; filtro sul nickname e facoltà di oscurarlo. RF-WALL-43/44/45, RF-ACC-9, RB23. **D11** confermata: la classificazione è adottata |
| **B5** consenso dei terzi | **Chiuso** (`11` §3). Stato `da_confermare` che non blocca l'ingresso, facoltà di rifiuto che restituisce il biglietto all'acquirente, minimizzazione dei dati raccolti. RF-PAY-33, RF-CPL-13→16, RB24 |
| **B6** abilitazione all'incasso | **Chiuso** (`11` §3). Si verifica lo stato di abilitazione e non il collegamento; la decadenza sospende la vendita, mai i biglietti emessi. RF-ORG-10→12, RB13 modificata |
| **B7** annullamento di una sessione | **Chiuso** (`11` §3). Peso di ripartizione per sessione, rimborso proporzionale senza scaglioni, soglia oltre la quale scatta il rimborso integrale. RF-EVT-35/36/37, RF-RMB-12/13 |
| **B8** carnet | **Chiuso per conseguenza**: il carnet serve alle milonghe ricorrenti, uscite dal segmento con la decisione sul tesseramento. Dipendenza dichiarata in `11` §3 |
| **B9** minori | **Chiuso** (`11` §3). Tre soglie: account da 14 anni, sotto i 14 iscrizione da parte di un adulto senza account, chat riservata ai maggiorenni. RF-ACC-10/11/12, RF-EVT-38. **D10** confermata: i minori sono ammessi |
| **B10** prova e presidio della wall | **Chiuso** (`11` §3). Modalità prova con carta di calibrazione, rotazione di sicurezza sui soli contenuti già approvati, contenuti di servizio programmabili. RF-WALL-46→49 |
| **B11** chat senza check-in | **Chiuso** (`11` §3). Sblocco di sala tramite il QR della schermata di cortesia, con codice a rotazione; avviso in configurazione. RF-CHK-16/17, RF-EVT-39, RB11 modificata |
| **B12** archivio e conservazione | **Chiuso** (`11` §3). Consenso che dichiara il riutilizzo, esportazione ristretta ai soli contenuti proiettati, registro delle esportazioni. RF-WALL-50→53, RF-WALL-24 modificata |
| **B13** carrello multi-organizzatore | **Chiuso** (`11` §3). Suddivisione in un ordine per organizzatore; i diritti di prevendita calcolati **per biglietto** eliminano la questione «fee per ordine o per riga». RF-PAY-34→37, RF-PAY-1 modificata |
| **C1 → C5** forma e chiarezza | **Chiusi** (`11` §3). C1 come regola, con esecuzione pianificata alla revisione 1.2; C2, C3, C4 e C5 recepiti in `04` |

### Nuovo elemento emerso da questa decisione

Escludere il tesseramento chiude un debito di analisi e **ne apre uno più grande**: era la
natura associativa a tenere la maggior parte degli eventi di ballo fuori dal regime del titolo
di accesso fiscale. Senza quella, la verifica fiscale sullo strato 3 di `08` passa da
raccomandazione a **precondizione per aprire le vendite del primo evento reale**.

---

## Parte A — Contraddizioni da risolvere prima dello sviluppo

### A1. Quando esattamente si impegna la capienza — **[DECISIONE]**

**Dove**: `04` RB2, RF-PAY-8, RF-PAY-11 · `05` §5, nota finale

I documenti dicono due cose diverse. `04` afferma che la capienza si impegna «alla conferma
dell'incasso, mai prima» e che gli ordini scaduti non hanno «mai impegnato capienza».
L'allegato `05` afferma che «l'impegno avviene prima dell'incasso definitivo e si rilascia se
il pagamento fallisce». Sono due progetti diversi, non due formulazioni dello stesso.

**Aggravante non considerata**: ho descritto la finestra di impegno come «di millisecondi».
È vero solo per la carta con addebito immediato. PayPal e Satispay portano l'utente fuori
dall'applicazione: Satispay richiede di aprire l'app e confermare, e la finestra reale è di
**minuti**. Le due varianti hanno quindi conseguenze molto diverse:

| Variante | Vantaggio | Costo |
|---|---|---|
| Impegno alla conferma d'incasso (come in `04`) | Nessun posto bloccato da checkout abbandonati | Doppia vendita possibile per l'intera durata del redirect: con Satispay, minuti. Il rimborso automatico di RB4 diventa un evento frequente, non un caso limite |
| Impegno all'avvio del pagamento, rilascio su fallimento o scadenza (come in `05`) | Doppia vendita praticamente azzerata | È un hold tecnico di alcuni minuti. Contraddice formalmente la decisione «niente prenotazione temporanea», anche se non è un hold di carrello |

**Proposta**: adottare la seconda variante con scadenza tecnica breve ed esplicita (proposta:
10 minuti, e comunque la durata della sessione di pagamento del PSP, che va configurata in
minuti e non lasciata al default), riscrivere RB2 come «la capienza non è mai impegnata dal
carrello: si impegna all'avvio del pagamento e si rilascia in caso di fallimento o
scadenza», e mantenere RB4 come rete di sicurezza per il caso residuo. Serve la conferma del
committente, perché ridefinisce una decisione già presa.

### A2. La fee «pagata dal partecipante» non lo è su PayPal e Satispay — **[DECISIONE]**

**Dove**: `04` AS1, RB1, RF-PAY-6, nota §6.5 opzione (c) · `01` tabella monetizzazione

La decisione è che la fee sia pagata dal partecipante, esposta come voce separata. La
soluzione proposta per PayPal e Satispay — maturare la fee come credito e addebitarla
all'organizzatore con rendiconto periodico — **capovolge la natura della fee**: il
partecipante paga un importo unico all'organizzatore, e la piattaforma incassa dall'organizzatore.
Fiscalmente e contrattualmente diventa una commissione a carico dell'organizzatore, non del
partecipante, e la voce «fee di piattaforma» esposta in checkout diventa una
rappresentazione non corrispondente al flusso reale del denaro.

Non è un dettaglio contabile: cambia chi è il cliente della piattaforma, chi emette quale
documento e chi ha diritto a cosa in caso di rimborso.

**Proposta**: unificare il modello anziché differenziarlo per PSP. Due strade coerenti:
*(i)* la fee è **sempre** una commissione dell'organizzatore, e il prezzo esposto la include
già — l'organizzatore alza il prezzo di listino se vuole scaricarla sul partecipante,
esattamente come fa oggi con le commissioni bancarie; *(ii)* si accettano solo PSP che
supportano nativamente la commissione di marketplace, e Satispay entra solo quando e se lo
supporta. La strada (i) è più semplice e più onesta verso il partecipante; la (ii) preserva
la decisione originale ma riduce i metodi di pagamento.

**Da chiudere anche**: la reversibilità della fee maturata in caso di rimborso integrale
(RF-RMB-8 impone la restituzione della fee: se la fee è già stata fatturata
all'organizzatore, serve una nota di credito).

### A3. Due cancelli di approvazione, uno dei quali non deciso — **[DECISIONE]**

**Dove**: `04` RF-ORG-2, RF-ORG-3, RF-EVT-15 · `01` onboarding

La decisione presa è che l'**organizzazione** sia approvata dal super admin. Ma RF-EVT-15
prevede anche uno stato `in_approvazione` per il **primo evento** dell'organizzazione: è un
residuo della mia proposta iniziale, che il committente non ha né confermato né respinto,
perché la domanda riguardava l'onboarding e non gli eventi.

**Proposta**: eliminare la moderazione del primo evento. Se l'organizzazione è già stata
verificata da una persona, un secondo cancello aggiunge attrito e un compito ricorrente al
super admin senza aggiungere garanzie. Se invece si vuole tenerlo, va detto con quale
criterio si approva un evento e in quanto tempo, perché un organizzatore che non può
pubblicare è un organizzatore che se ne va.

### A4. Lo stato `utilizzato` del biglietto è incompatibile con i pass multi-sessione

**Dove**: `04` RF-TCK-4, RF-CHK-4, RF-CHK-8, RB7

RF-TCK-4 mette `utilizzato` tra gli stati del **biglietto**. Ma RF-CHK-8 prevede il check-in
per singola sessione: un Full Pass viene scansionato dodici volte in tre giorni. Con lo stato
sul biglietto, il secondo ingresso risulterebbe «già utilizzato».

**Proposta** (risolvibile dall'analista): togliere `utilizzato` dagli stati del biglietto e
tenere gli stati `valido`, `trasferito`, `annullato`, `rimborsato`. L'utilizzo è un attributo
della coppia *(biglietto, sessione)*, non del biglietto: esiste un CheckIn per sessione, e
l'esito «già utilizzato» di RF-CHK-4 va inteso come «già utilizzato **per questa sessione**».
Per gli eventi senza sessioni si usa una sessione implicita, così il modello resta unico.

### A5. La relazione Biglietto ↔ Iscrizione non è definita

**Dove**: `04` §5.1 diagramma, §5.2 «Iscrizione» · `05` §2.2

Il diagramma collega RigaOrdine a Biglietto ma non collega mai Biglietto a Iscrizione, e il
testo dice che l'iscrizione è «una per persona nell'evento». Se una persona compra un Milonga
Pass **e** un workshop singolo ha due biglietti: una iscrizione o due? La domanda non è
teorica, perché l'allegato registra i consumi di capienza per `iscrizione_id`.

**Proposta** (risolvibile dall'analista): **una Iscrizione per persona per evento**, con
relazione uno-a-molti verso i Biglietti. I consumi restano ancorati all'iscrizione, e le
quote di titolo vengono consumate una per ciascun titolo posseduto. Va aggiunto al diagramma
il collegamento mancante e va dichiarata la cardinalità.

---

## Parte B — Buchi di analisi

### B1. L'entità Tesseramento non esiste nel modello dati

**Dove**: `04` RF-REQ-2, §5 · decisione confermata su tesseramento associativo

RF-REQ-2 verifica «la tessera registrata a sistema», ma nel modello concettuale non esiste
alcuna entità che rappresenti una tessera. Manca tutto: associazione emittente, numero,
data di emissione e scadenza, quota versata, stato.

C'è anche una conseguenza multi-tenant non considerata: **una tessera è emessa da una
specifica associazione e non vale per un'altra.** Se l'organizzatore A richiede il
tesseramento, non può accettare la tessera dell'associazione B. Il requisito va quindi
parametrizzato con l'ente emittente ammesso, e il partecipante può avere più tessere attive.

Manca inoltre la **vendita della tessera come riga d'ordine**: RF-REQ-2 la menziona, ma
`RigaOrdine` prevede solo titoli e servizi, e la quota associativa ha una natura fiscale
diversa da un biglietto — non è un corrispettivo per una prestazione, è un versamento
associativo.

### B2. Il modello fiscale è completamente assente

**Dove**: `04` AS6, RF-PAY-6, RF-PAY-12, Q5

L'analisi dice che i prezzi sono netti dell'organizzatore e che la fee è esposta a parte, ma
non dice mai se i prezzi sono comprensivi di imposta, quale aliquota si applichi, né come si
comporta il sistema con organizzatori che hanno regimi diversi. È un buco rilevante proprio
per il pubblico atteso: molti organizzatori di tango sono associazioni in regime agevolato o
con attività decommercializzata verso i soci, altri sono società con IVA ordinaria, altri
sono persone fisiche senza partita IVA.

Serve almeno: il regime fiscale come attributo dell'organizzazione, l'imposta come attributo
della riga d'ordine, la distinzione tra corrispettivo e quota associativa, e la scelta se il
prezzo inserito dall'organizzatore sia lordo o netto d'imposta. La fee di piattaforma è in
ogni caso una prestazione di servizi soggetta a IVA ordinaria.

### B3. Chargeback e contestazioni non sono trattati

**Dove**: nessun documento

Non esiste un requisito sulle contestazioni di addebito. In un modello con incasso diretto
sull'account dell'organizzatore, il chargeback colpisce l'organizzatore, ma la richiesta di
prova arriva alla piattaforma, che è l'unica a possedere la traccia dell'acquisto e del
check-in. Serve: notifica della contestazione, raccolta automatica delle prove (ordine,
biglietto, orario di check-in, indirizzo di rete, accettazione delle condizioni),
invalidazione del biglietto in caso di esito negativo, e una politica sulla sospensione degli
organizzatori con un tasso di contestazioni anomalo.

### B4. La chat libera non ha moderazione automatica delle immagini

**Dove**: `04` RF-WALL-7, RF-WALL-9, R4

La decisione «chat libera, wall curata» è stata analizzata solo per la wall. Ma senza
pre-moderazione **una foto esplicita è immediatamente visibile a tutti i partecipanti**, anche
se non raggiungerà mai il maxischermo. RF-WALL-9 prevede un filtro automatico sul solo
linguaggio. La mitigazione R4 protegge la proiezione, non la chat.

**Proposta**: classificazione automatica delle immagini prima della pubblicazione in chat,
con sospensione del solo contenuto sospetto in attesa del moderatore — una pre-moderazione
selettiva che non rallenta il flusso normale. In alternativa, dichiarare esplicitamente il
rischio accettato.

Correlato: **il nickname non è moderato.** È l'unico dato dell'autore proiettato su un
maxischermo, ed è scelto liberamente dall'utente. Serve un filtro e la possibilità per il
moderatore di sostituirlo o oscurarlo.

### B5. Manca il consenso della persona iscritta da altri

**Dove**: `04` RF-PAY-3, RF-CPL-6, RF-CPL-8, §9

Chi acquista inserisce nome, cognome, email e ruolo di ballo di altre persone: il partner di
coppia e gli amici per cui compra. L'analisi prevede una notifica, non un'accettazione. Ma i
dati di un terzo vengono trattati senza che quel terzo abbia fatto nulla, e alla persona
vengono attribuiti un ruolo di ballo e una partecipazione a un evento.

**Proposta**: il partner o l'ospite riceve una richiesta di conferma; fino alla conferma il
biglietto è valido ma l'iscrizione è in stato `da_confermare`, e i dati trattati sono i soli
minimi necessari all'emissione del titolo. Va inoltre esplicitata nell'informativa la base
giuridica del trattamento dei dati inseriti da terzi.

### B6. Non è previsto il caso dell'account di incasso non abilitato

**Dove**: `04` RF-ORG-5

Collegare un account non significa poter incassare: la verifica di identità del PSP può
restare incompleta, o essere revocata dopo, con il risultato che i fondi si accumulano senza
poter essere trasferiti. Serve: verifica dello stato di abilitazione prima della
pubblicazione, controllo periodico, blocco della pubblicazione di nuovi eventi se
l'abilitazione decade, e avviso all'organizzatore con l'indicazione di cosa manca.

### B7. Manca l'annullamento di una singola sessione

**Dove**: `04` RF-EVT-19, RF-RMB-8

È previsto l'annullamento dell'evento intero, non quello di una sessione: il maestro che si
ammala e salta un workshop dentro un festival che si svolge regolarmente. Serve poter
annullare una sessione, calcolare la quota di rimborso proporzionale per chi l'aveva nel
proprio pass, e comunicare ai soli interessati. È il caso più frequente in assoluto tra
quelli non coperti.

### B8. Manca il carnet di ingressi

**Dove**: `04` RF-EVT-7, RF-EVT-17

Per le milonghe e le pratiche ricorrenti, l'abbonamento a ingressi multipli — «dieci serate
da usare quando vuoi» — è la forma di vendita più diffusa dopo il biglietto singolo, ed è la
principale leva di fidelizzazione delle scuole. Il modello attuale non lo prevede: un titolo
è legato a un evento e a sessioni specifiche. Serve un titolo a consumo, con numero di
ingressi residui, validità temporale e decremento al check-in.

### B9. I minori non sono considerati

**Dove**: `04` §9

Le scuole di tango hanno corsi e stage per adolescenti, e alcune milonghe hanno fasce
pomeridiane aperte ai minori. Manca: la registrazione di un minore, il consenso di chi
esercita la responsabilità genitoriale, l'età minima per l'account, e l'esclusione dei minori
dalla chat. Anche solo la scelta di non ammettere minori va dichiarata, perché è comunque una
scelta di prodotto.

### B10. La wall non ha modalità di prova né comportamento senza moderatore

**Dove**: `04` §6.11

Due assenze pratiche che si scoprono in sala, cioè troppo tardi:

- **Prova tecnica**: serve una modalità che proietti contenuti campione per verificare
  proiettore, risoluzione, leggibilità e colori durante l'allestimento, prima che arrivi
  chiunque.
- **Moderatore assente**: se nessuno presidia la console — perché è mezzanotte e il
  moderatore sta ballando — la coda si svuota e lo schermo resta sulla cortesia per ore. Va
  deciso se esiste una rotazione automatica dei contenuti già approvati, se i contenuti di
  servizio possono essere programmati in anticipo, e cosa si mostra in assenza di presidio.

### B11. La chat è irraggiungibile negli eventi senza check-in

**Dove**: `04` RF-CHK-14, RF-WALL-2

L'accesso alla chat è subordinato al check-in. Ma molti organizzatori non scansionano nulla:
milonga a ingresso libero, serata con lista alla porta, evento gratuito. In quegli eventi la
chat non si sblocca per nessuno e il modulo è inerte, senza che il sistema lo segnali.

**Proposta**: prevedere uno sblocco alternativo — il **QR di sala** già previsto sulla
schermata di cortesia (RF-WALL-34) può valere come check-in leggero per la sola chat, con
verifica del possesso di un titolo valido. E in fase di configurazione, se il modulo chat è
attivo su un evento senza check-in previsto, il sistema deve avvisare.

### B12. L'archivio della wall contraddice la politica di conservazione

**Dove**: `04` RF-WALL-24, RF-WALL-12, §9

RF-WALL-24 consente all'organizzatore di scaricare in blocco tutti i contenuti approvati.
RF-WALL-12 e la sezione privacy prevedono la cancellazione automatica dei contenuti dopo un
periodo. Le due cose insieme significano che la cancellazione è puramente nominale: le copie
sono già fuori dal sistema.

**Proposta**: dichiararlo nel consenso al primo invio — «le foto proiettate possono essere
conservate e riutilizzate dall'organizzatore» — e limitare l'esportazione ai soli contenuti
effettivamente proiettati, che sono già stati resi pubblici in sala. Un contenuto approvato ma
mai proiettato non deve finire nell'archivio.

### B13. Il carrello multi-organizzatore non è risolto

**Dove**: `04` RF-PAY-1

Il requisito consente più eventi «dello stesso organizzatore», ma non dice cosa accade quando
l'utente aggiunge un evento di un secondo organizzatore. Con incassi diretti su account
distinti, un pagamento unico non è possibile.

**Proposta**: il carrello si suddivide automaticamente in un ordine per organizzatore, con
pagamenti separati e sequenziali, e l'interfaccia lo dichiara prima del pagamento. Va deciso
se la fee si applica per ordine o per riga, perché con una fee a importo fisso la differenza
è percepibile.

---

## Parte C — Chiarezza e forma

### C1. La numerazione dei requisiti è fuori sequenza

Le integrazioni della revisione 1.1 hanno prodotto sequenze come RF-EVT-9 → RF-EVT-20 →
RF-EVT-10, e RF-PAY-13 → RF-PAY-15 → RF-PAY-14. Funziona come riferimento univoco, ma in un
documento destinato al cliente sembra trascuratezza. Da rinumerare in modo continuo alla
prossima revisione, con una tabella di corrispondenza se gli identificativi sono già stati
citati altrove.

### C2. «Posto letto» e «gestione alloggi» sembrano in contraddizione

`04` §5.2 elenca il posto letto tra i servizi accessori del primo rilascio; la roadmap mette
la «gestione alloggi con matching di ospitalità» in fase 3. Sono due cose diverse — vendere
un letto in convenzione non è organizzare l'ospitalità tra ballerini — ma il documento non lo
dice e la contraddizione è apparente. Da distinguere esplicitamente.

### C3. Le lezioni private del primo rilascio non sono quelle della fase 2

Nel primo rilascio la lezione privata è un servizio accessorio con uno slot orario scelto tra
quelli predisposti dall'organizzatore. In fase 2 diventa una prenotazione sul calendario del
maestro, con disponibilità reali. Da dichiarare, altrimenti sembra una funzione ripetuta o
già presente.

### C4. La traduzione riguarda solo la scheda evento

RF-PUB-9 prevede una seconda lingua per i contenuti dell'organizzatore, ma i testi che il
partecipante straniero deve capire per forza sono altri: le dichiarazioni da accettare, i
nomi dei requisiti, le descrizioni dei servizi, la policy di rimborso. Da estendere a tutti i
testi redatti dall'organizzatore, o da limitare dichiaratamente.

### C5. Non è definito cosa fa scattare `vendita_chiusa`

RF-EVT-15 prevede lo stato ma non il criterio: data e ora di chiusura, esaurimento,
decisione manuale, o inizio dell'evento. Sono quattro comportamenti diversi e vanno tutti
previsti come alternative configurabili.

---

## Priorità di risoluzione

| Prima di scrivere codice | Prima del primo evento reale | Alla prossima revisione |
|---|---|---|
| A1 impegno di capienza · A2 natura della fee · A3 doppia approvazione · A4 stato del biglietto · A5 cardinalità · B1 tesseramento · B2 modello fiscale | B3 chargeback · B4 moderazione immagini e nickname · B5 consenso dei terzi · B6 abilitazione all'incasso · B10 prova della wall · B11 chat senza check-in · B12 archivio e conservazione | B7 sessione annullata · B8 carnet · B9 minori · B13 carrello multi-organizzatore · tutta la parte C |

Le tre voci **[DECISIONE]** — A1, A2, A3 — sono quelle che non posso chiudere: ridefiniscono
scelte già prese dal committente.

---

## Esito finale

Tutte e ventuno le voci di questo audit sono chiuse. La tabella dello stato in testa al
documento indica per ciascuna dove è stata risolta:

| Blocco | Dove è stato chiuso |
|---|---|
| A1, A2, A3, A5 | Quinto giro di decisioni (`01`) |
| A4 | Settimo giro e `09-titoli-e-pass.md` §7 |
| B1, B2 | Sesto e ottavo giro (`01`), con `08` §3.2 bis |
| B3 → C5 | `11-chiusura-audit.md` |

Le tre scelte di merito del committente — **D10** minori, **D11** classificazione delle
immagini, **D12** regime delle contestazioni — sono state confermate il 31 luglio 2026, tutte
secondo la raccomandazione dell'analista. **Nessuna voce di questo audit resta aperta.**
