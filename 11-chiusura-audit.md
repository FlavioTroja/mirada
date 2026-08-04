# Mirada Tango — Chiusura dei punti aperti dell'audit

**Data** 31 luglio 2026 · Allegato a `06-audit-analisi.md` · Chiude i sedici punti da **B3** a **C5**

I punti da A1 ad A5 e da B1 a B2 sono stati chiusi nei giri di decisione precedenti. Restavano
aperti undici buchi di analisi e cinque punti di forma, che l'audit collocava «prima del primo
evento reale» o «alla prossima revisione». Questo documento li chiude tutti: per ciascuno
riporta cosa manca, la risoluzione adottata e i requisiti che ne discendono.

Tre punti contenevano una scelta che non spettava all'analista — ammissione dei minori,
adozione della classificazione automatica delle immagini, regime delle contestazioni di
addebito. Sono stati **confermati dal committente il 31 luglio 2026**, tutti e tre secondo la
raccomandazione: il dettaglio è al §4. **L'audit non ha più alcuna voce aperta.**

---

## 1. Quadro sintetico

| # | Punto | Esito |
|---|---|---|
| **B3** | Chargeback e contestazioni | Risolto — sei requisiti nuovi, una regola trasversale. Penale all'organizzatore e doppia soglia (**D12**) |
| **B4** | Moderazione automatica di immagini e nickname | Risolto — classificazione preventiva delle immagini adottata (**D11**), filtro sul nickname |
| **B5** | Consenso della persona iscritta da altri | Risolto — stato `da_confermare`, facoltà di rifiuto, minimizzazione dei dati |
| **B6** | Account di incasso collegato ma non abilitato | Risolto — verifica dello stato, non del collegamento |
| **B7** | Annullamento di una singola sessione | Risolto — peso di ripartizione per sessione e rimborso proporzionale |
| **B8** | Carnet di ingressi | **Chiuso per conseguenza** dalla decisione sul tesseramento, con dipendenza dichiarata |
| **B9** | Minori | Risolto — minori ammessi alle tre soglie di età, con dichiarazione sull'evento (**D10**) |
| **B10** | Wall senza prova tecnica e senza moderatore | Risolto — modalità prova e rotazione di sicurezza |
| **B11** | Chat irraggiungibile negli eventi senza check-in | Risolto — sblocco di sala con codice a rotazione |
| **B12** | Archivio della wall contro politica di conservazione | Risolto — consenso onesto ed esportazione ristretta al proiettato |
| **B13** | Carrello multi-organizzatore | Risolto — suddivisione per organizzatore, diritti di prevendita per biglietto |
| **C1** | Numerazione dei requisiti fuori sequenza | Risolto come regola; esecuzione rinviata alla revisione 1.2 |
| **C2** | «Posto letto» contro «gestione alloggi» | Risolto — sono due funzioni distinte, ora dichiarate tali |
| **C3** | Lezioni private del primo rilascio contro quelle di fase 2 | Risolto — due forme distinte, ora dichiarate |
| **C4** | La traduzione riguarda solo la scheda evento | Risolto — regola estesa a tutti i testi del percorso d'acquisto |
| **C5** | Cosa fa scattare `vendita_chiusa` | Risolto — quattro criteri configurabili, il primo che si verifica |

**Bilancio**: 34 requisiti nuovi, 3 regole di business nuove, 4 requisiti modificati,
3 rischi nuovi. Nessuna decisione già presa viene rimessa in discussione.

---

## 2. Cosa è cambiato dal 30 luglio, e come incide

L'audit è stato scritto prima dei giri sesto, settimo e ottavo. Tre effetti vanno registrati
prima di entrare nel merito:

- **B8 si chiude da sé.** Il carnet serve alle milonghe e alle pratiche ricorrenti, che con la
  decisione sul tesseramento sono uscite dal segmento del primo rilascio. `09-titoli-e-pass.md`
  §9 lo registra già.
- **B5 si allarga.** L'iscrizione di terzi non riguarda più solo la coppia: con i pass emessi
  manualmente e le vendite su canali esterni, le persone presenti in piattaforma senza averlo
  chiesto sono di più.
- **B3 diventa più concreto.** Con i diritti di prevendita incassati direttamente dalla
  piattaforma sulla stessa transazione, una contestazione accolta non colpisce solo
  l'organizzatore: storna anche il ricavo della piattaforma.

---

## 3. Risoluzione punto per punto

### B3 — Chargeback e contestazioni

**Dove**: nessun documento · **Priorità**: prima del primo evento reale

Il modello di incasso diretto crea un'asimmetria: la contestazione colpisce il conto
dell'organizzatore, ma **le prove sono tutte in piattaforma** — l'ordine, l'accettazione delle
condizioni, il biglietto emesso, l'orario di check-in. Un organizzatore lasciato solo davanti a
una richiesta di prova la perde per omessa risposta, non perché avesse torto.

Va aggiunto un elemento che l'audit non considerava: **la maggior parte delle contestazioni
nasce da chi non ha trovato il percorso di rimborso.** Il presidio più efficace non è il
fascicolo di prova, è rendere ovvio come si chiede indietro il proprio denaro.

**Risoluzione.** La piattaforma prende in carico l'intero ciclo della contestazione per conto
dell'organizzatore: raccolta automatica delle prove, trasmissione entro il termine,
applicazione dell'esito. Una contestazione accolta produce esattamente gli effetti di un
rimborso — non un caso a parte, lo stesso percorso.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-27 | Registrazione delle **contestazioni di addebito** notificate dal prestatore, con stato, importo conteso, motivo dichiarato e termine di risposta, visibili all'organizzatore e all'amministrazione di piattaforma | M |
| RF-PAY-28 | **Costituzione automatica del fascicolo di prova** alla ricezione: ordine e righe, biglietto emesso, momento e indirizzo di rete dell'accettazione delle condizioni, versione della policy di rimborso vigente all'acquisto, storico dei trasferimenti, orario e postazione di check-in, comunicazioni recapitate. Trasmissione al prestatore entro il termine, con sollecito all'organizzatore se è richiesto un suo contributo | M |
| RF-PAY-29 | **Esito**: se la contestazione è accolta, il biglietto è invalidato, l'iscrizione decade e le quote sono rilasciate con lo stesso meccanismo del rimborso; se è respinta, nulla cambia. In entrambi i casi le parti sono notificate | M |
| RF-PAY-30 | I **diritti di prevendita seguono la sorte della transazione**: una contestazione accolta ne produce lo storno a carico della piattaforma, coerentemente con il funzionamento dell'incasso diretto | M |
| RF-PAY-31 | Monitoraggio del **tasso di contestazione per organizzazione**, su due soglie: **attenzione**, con avviso all'Owner, e **sospensione**, allineata a quella del prestatore, con presa in carico del Super Admin | M |
| RF-PAY-32 | La conferma d'ordine e l'area personale espongono in evidenza **come chiedere un rimborso e come raggiungere l'organizzatore**: è la misura che riduce le contestazioni alla radice | M |

**RB22** — Una contestazione di addebito accolta produce gli stessi effetti di un rimborso:
biglietto invalidato, iscrizione decaduta, quote rilasciate. Nessun ingresso avviene con un
titolo il cui incasso è stato revocato.

**Chiuso da D12**: penale del prestatore a carico dell'organizzatore, dichiarata nelle
condizioni di servizio (RF-ORG-13); doppia soglia, di attenzione e di sospensione (RF-PAY-38).
Motivazioni al §4.

---

### B4 — La chat libera non ha moderazione automatica delle immagini

**Dove**: `04` RF-WALL-7, RF-WALL-9, R4 · **Priorità**: prima del primo evento reale

La decisione «chat libera, wall curata» è stata progettata per la wall. Ma senza
pre-moderazione una foto esplicita **è immediatamente visibile a tutti i partecipanti**, anche
se non raggiungerà mai il maxischermo. RF-WALL-9 filtra il solo linguaggio, e la mitigazione R4
protegge la proiezione.

Il punto correlato è altrettanto serio: **il nickname non è moderato**, ed è l'unico dato
dell'autore che finisce proiettato in sala.

**Risoluzione.** Due soglie distinte e cumulative. Le immagini passano una classificazione
automatica prima di comparire in chat; solo ciò che risulta sospetto viene trattenuto in attesa
di un moderatore. È una pre-moderazione selettiva: non rallenta il flusso normale, che resta
libero, e non contraddice la decisione presa — la chat resta libera per il testo e per tutto
ciò che supera il controllo. Il nickname è filtrato alla creazione e a ogni modifica, e il
moderatore può oscurarlo per un singolo contenuto.

La regola che governa il silenzio è la più importante: **un contenuto trattenuto e mai
esaminato resta trattenuto.** Un sistema che pubblica per scadenza di un timer è un sistema che
pubblica proprio quando nessuno guarda.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-43 | **Classificazione automatica di ogni immagine prima della pubblicazione in chat.** L'immagine sospetta è trattenuta e non compare a nessuno in attesa della decisione di un moderatore; il flusso normale non subisce ritardi percepibili | M |
| RF-WALL-44 | L'esito della classificazione è registrato e la coda dei contenuti trattenuti compare in console **con priorità su tutto il resto**. Se nessun moderatore decide, il contenuto **resta trattenuto**: il silenzio non pubblica | M |
| RF-WALL-45 | Il moderatore può **oscurare o sostituire il nickname** mostrato sulla wall per un singolo contenuto, e segnalare l'utente perché il nickname sia cambiato d'ufficio dalla moderazione di piattaforma | M |
| RF-ACC-9 | Il **nickname è soggetto a filtro automatico** alla creazione e a ogni modifica, ed è modificabile un numero limitato di volte nell'arco di un periodo | M |

**RB23** — Nessuna immagine raggiunge la chat senza aver superato la classificazione
automatica; nessun contenuto raggiunge la wall senza approvazione umana. Le due soglie sono
distinte e cumulative.

**Chiuso da D11**: la classificazione automatica è **adottata**. È un servizio esterno a
consumo, con costo ricorrente e latenza: entra nei costi di esercizio, nell'elenco dei
trasferimenti dell'informativa e tra le dipendenze da monitorare. Se il servizio non risponde,
RB23 non si allenta — l'immagine resta trattenuta finché non è stata classificata o approvata da
un moderatore.

---

### B5 — Manca il consenso della persona iscritta da altri

**Dove**: `04` RF-PAY-3, RF-CPL-6, RF-CPL-8, §9 · **Priorità**: prima del primo evento reale

Chi acquista inserisce nome, cognome, email e ruolo di ballo di altre persone. L'analisi
prevede una notifica, non un'accettazione: a un terzo vengono attribuiti un ruolo di ballo e
una partecipazione a un evento senza che abbia fatto nulla.

**Risoluzione.** L'iscrizione creata da altri nasce in stato `da_confermare`. Il biglietto è
valido e **l'ingresso non è mai bloccato** — un vincolo sul controllo accessi punirebbe la
persona sbagliata, e in sala nessuno vuole discutere di consensi. Ciò che resta sospeso è tutto
il resto: profilo, comunicazioni non essenziali, chat. La persona può anche rifiutare, e il
rifiuto restituisce il biglietto alla disponibilità di chi l'ha comprato.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-33 | Chi acquista per altri fornisce i **soli dati necessari all'emissione del titolo**: nome, cognome, email e ruolo di ballo. Nessun altro attributo del terzo è raccolto dall'acquirente, compresi quelli dei servizi accessori, che sono richiesti direttamente all'interessato | M |
| RF-CPL-13 | La persona iscritta da altri riceve una **richiesta di conferma**. Fino alla conferma l'iscrizione è `da_confermare`: il biglietto è valido e **l'ingresso è consentito**, ma restano inattivi il profilo, le comunicazioni non essenziali e l'accesso alla chat | M |
| RF-CPL-14 | La persona iscritta da altri può **rifiutare**. Il rifiuto rende il biglietto privo di titolare e lo restituisce alla disponibilità dell'acquirente, che può trasferirlo o chiederne il rimborso secondo la policy dell'evento; i dati del terzo sono cancellati, con la sola traccia contabile obbligatoria | M |
| RF-CPL-15 | L'acquirente **attesta di essere autorizzato** a comunicare i dati delle persone che iscrive, e l'informativa dichiara la base giuridica del trattamento dei dati inseriti da terzi | M |
| RF-CPL-16 | Sollecito automatico della conferma a intervalli configurabili, e comunque prima dell'evento: un biglietto senza titolare scoperto la sera stessa non è più trasferibile | M |

**RB24** — Nessuno risulta iscritto a un evento senza esserne informato e senza poter rifiutare.
Il rifiuto non lede chi ha pagato: restituisce il biglietto alla sua disponibilità.

---

### B6 — Non è previsto il caso dell'account di incasso non abilitato

**Dove**: `04` RF-ORG-5 · **Priorità**: prima del primo evento reale

Collegare un account non significa poter incassare. La verifica di identità presso il prestatore
può restare incompleta, o essere revocata dopo, e i fondi si accumulano senza poter essere
trasferiti. RF-ORG-5 verifica il collegamento, che è la cosa sbagliata da verificare.

**Risoluzione.** Si verifica lo **stato di abilitazione**, in modo continuativo. La decadenza
sospende la vendita, non i biglietti già emessi: chi ha pagato entra comunque, e i rimborsi
restano eseguibili, perché il problema è dell'organizzatore verso il prestatore e non del
partecipante.

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-10 | La piattaforma verifica presso il prestatore lo **stato di abilitazione all'incasso**, non il solo collegamento. La prima pubblicazione richiede l'abilitazione piena | M |
| RF-ORG-11 | **Controllo periodico** dello stato. Alla decadenza: sospensione della pubblicazione di nuovi eventi e della vendita su quelli già pubblicati, con avviso all'Owner che indica quale adempimento manca presso il prestatore. I biglietti emessi restano validi e i rimborsi restano eseguibili | M |
| RF-ORG-12 | **Cruscotto dello stato di incasso** in evidenza nell'area dell'organizzazione, con gli eventuali fondi in attesa di trasferimento presso il prestatore e le azioni richieste | M |

**RB13 modificata** — Un evento non è pubblicabile se l'organizzazione non è approvata e non ha
un account di incasso collegato **e abilitato**.

---

### B7 — Manca l'annullamento di una singola sessione

**Dove**: `04` RF-EVT-19, RF-RMB-8 · **Priorità**: alla prossima revisione

È il caso non coperto più frequente in assoluto: il maestro che si ammala e salta un workshop
dentro un festival che si svolge regolarmente. Annullare l'evento intero sarebbe assurdo,
non annullare nulla sarebbe scorretto verso chi aveva quel workshop nel proprio pass.

Il nodo è **quanto vale una sessione dentro un pass a prezzo unico**. Ripartire in parti uguali
è semplice ma iniquo: un seminario di tre ore e una milonga di cinque non valgono lo stesso, e
in un Full Pass con dodici sessioni la differenza è percepibile.

**Risoluzione.** Ogni sessione porta un **peso di ripartizione**, con default uniforme e
facoltà per l'organizzatore di assegnarne di diversi. Il rimborso è proporzionale al peso e non
applica gli scaglioni, perché la causa non è imputabile al partecipante. Oltre una soglia di
peso complessivo annullato, l'annullamento parziale diventa una modifica sostanziale e apre il
diritto al rimborso integrale del titolo.

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-35 | **Annullamento di una singola sessione** su evento che si svolge regolarmente, con motivazione, comunicazione ai soli titolari di titoli che la includono, e rilascio delle quote della sessione | M |
| RF-EVT-36 | Ogni sessione porta un **peso di ripartizione** che determina la quota di prezzo a essa attribuibile dentro un titolo multi-sessione. Default uniforme sul numero di sessioni incluse; pesi diversi assegnabili dall'organizzatore in fase di creazione | M |
| RF-EVT-37 | I **servizi accessori legati alla sessione annullata** — la lezione privata in quello slot, il pasto di quella giornata — seguono la sessione e sono rimborsati integralmente | M |
| RF-RMB-12 | L'annullamento di una sessione dà diritto al **rimborso della quota attribuibile** su ogni titolo che la include, comprensiva della corrispondente parte di diritti di prevendita, **senza applicazione degli scaglioni** | M |
| RF-RMB-13 | Se le sessioni annullate superano una **soglia di peso** configurabile sul titolo — default 30% — o se la sessione annullata è l'unica inclusa, il partecipante ha diritto al **rimborso integrale del titolo**, esercitabile entro 14 giorni dalla comunicazione secondo RB14 | M |

Nota: il peso di ripartizione ha un secondo uso, già richiesto altrove. `10` domanda 8 chiede se
un pass misto vada scomposto tra componente didattica e componente danzante ai fini fiscali. Se
la risposta fosse affermativa, **il peso di ripartizione è già la struttura dati che serve**, e
RF-BKO-9 può esporla nell'esportazione. Un requisito nato per i rimborsi copre gratuitamente il
rischio fiscale che restava aperto.

---

### B8 — Manca il carnet di ingressi

**Dove**: `04` RF-EVT-7, RF-EVT-17 · **Priorità**: alla prossima revisione

**Chiuso per conseguenza.** Il carnet — «dieci serate da usare quando vuoi» — è la forma di
vendita delle milonghe e delle pratiche ricorrenti, che con la decisione sul tesseramento sono
uscite dal segmento del primo rilascio. `09-titoli-e-pass.md` §9 lo registra già tra le funzioni
rinviate.

**Dipendenza da dichiarare**: se in futuro le milonghe settimanali rientrassero nel perimetro —
cosa che accadrebbe se la vendita come quota associativa venisse riaperta — il carnet è **il
primo requisito da riaprire**, prima ancora della ricorrenza degli eventi. È un titolo a consumo
con ingressi residui, validità temporale e decremento al check-in: non è una variante di quelli
esistenti, è un'entità nuova.

---

### B9 — I minori non sono considerati

**Dove**: `04` §9 · **Priorità**: alla prossima revisione

Le scuole di tango hanno stage per adolescenti e alcune milonghe hanno fasce pomeridiane aperte
ai minori. Manca tutto: età minima per l'account, consenso di chi esercita la responsabilità
genitoriale, esclusione dalla chat. Anche la scelta di **non** ammettere minori è una scelta di
prodotto e va dichiarata.

**Risoluzione proposta**, su tre soglie distinte che vanno tenute separate perché rispondono a
esigenze diverse:

| Soglia | Regola | Perché |
|---|---|---|
| **Account autonomo** | 14 anni compiuti | È l'età fissata in Italia per il consenso autonomo ai servizi della società dell'informazione |
| **Partecipazione sotto i 14 anni** | Nessun account: il minore è iscritto da un adulto che dichiara di esercitare la responsabilità genitoriale. Biglietto nominale gestito dall'adulto | Coincide con il percorso di B5, senza costruire un secondo meccanismo |
| **Chat di evento** | 18 anni | La chat alimenta una proiezione pubblica e non ha moderazione preventiva sul testo. È la soglia prudente, ed è la stessa che servirà alla ricerca partner in fase 2 |

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-10 | **Età minima per l'account: 14 anni compiuti**, con dichiarazione dell'età alla registrazione e conseguenze dichiarate in caso di dichiarazione mendace | M |
| RF-ACC-11 | Sotto i 14 anni **non esiste account**: il minore partecipa come iscritto senza account, inserito nell'ordine da un adulto che **dichiara di esercitare la responsabilità genitoriale** o di esserne delegato. Il biglietto è nominale ed è gestito dall'adulto, che ne esercita anche i diritti | M |
| RF-ACC-12 | L'accesso in scrittura alla chat di evento è **riservato ai maggiorenni**; lo stesso vincolo si applicherà alla ricerca partner di fase 2 | M |
| RF-EVT-38 | L'organizzatore **dichiara sull'evento** se ammette minori e a quali condizioni: accompagnamento obbligatorio, fasce orarie, sessioni consentite. Il default è che l'evento non ammette minori non accompagnati, e la scheda evento lo espone | M |

**Chiuso da D10**: i minori sono **ammessi** alle tre soglie sopra. Escluderli del tutto sarebbe
stato più semplice da scrivere, ma taglia fuori gli stage giovanili e soprattutto non è
verificabile: senza un controllo dell'età reale l'esclusione è una dichiarazione, non un
presidio. Le tre soglie costano poco e reggono a un'ispezione.

---

### B10 — La wall non ha modalità di prova né comportamento senza moderatore

**Dove**: `04` §6.11 · **Priorità**: prima del primo evento reale

Due assenze che si scoprono in sala, cioè troppo tardi. Non esiste un modo di verificare
proiettore, risoluzione e leggibilità durante l'allestimento; e se a mezzanotte il moderatore
sta ballando — cosa che accadrà tutte le volte — la coda si svuota e il maxischermo resta sulla
schermata di cortesia per ore.

**Risoluzione.** Una modalità prova con contenuti campione e carta di calibrazione, e una
rotazione di sicurezza che ripropone i **contenuti già approvati** quando la coda si esaurisce.
Il vincolo di RB9 non si tocca: in rotazione entra solo ciò che un moderatore ha già approvato
una volta, mai contenuto nuovo.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-46 | **Modalità prova**, attivabile prima dell'apertura porte: proietta contenuti campione — testo lungo, testo breve, foto verticale, foto orizzontale, schermata di cortesia — e una **carta di calibrazione** con area di sicurezza, riferimenti tipografici e scala dei grigi, per verificare proiettore, risoluzione, colori e leggibilità a distanza durante l'allestimento | M |
| RF-WALL-47 | **Rotazione di sicurezza in assenza di presidio**: esaurita la coda, la wall ripropone i contenuti **già approvati** dell'evento e i contenuti di servizio programmati, con un tetto configurabile alle ripetizioni. Nessun contenuto non approvato entra mai in rotazione; se non esiste materiale approvato si torna alla schermata di cortesia | M |
| RF-WALL-48 | **Contenuti di servizio programmabili in anticipo**, con orario o ricorrenza: annunci, ringraziamenti agli sponsor, avvisi logistici, chiusura della serata | M |
| RF-WALL-49 | **Segnalazione di assenza di presidio**: se la coda dei contenuti in attesa cresce e nessuna azione di moderazione avviene entro un tempo configurato, il sistema avvisa i moderatori designati sui loro dispositivi | M |

---

### B11 — La chat è irraggiungibile negli eventi senza check-in

**Dove**: `04` RF-CHK-14, RF-WALL-2 · **Priorità**: prima del primo evento reale

L'accesso alla chat è subordinato al check-in, ma molti organizzatori non scansionano nulla. In
quegli eventi il modulo è inerte e nessuno se ne accorge finché non è la sera stessa.

**Risoluzione.** Il QR già previsto sulla schermata di cortesia (RF-WALL-34) vale come **sblocco
di sala** ai soli fini della chat, previa verifica del possesso di un titolo valido. Il codice
**ruota a intervalli brevi**: è la differenza tra un presidio e un teatro, perché una fotografia
dello schermo condivisa su una chat di gruppo aprirebbe altrimenti la sala a chiunque.

| ID | Requisito | Pr. |
|---|---|---|
| RF-CHK-16 | **Sblocco di sala**: il QR della schermata di cortesia vale come check-in leggero ai soli fini dell'accesso alla chat. Registra un check-in di tipo `AUTO_SALA` previa verifica del possesso di un titolo valido per l'evento. **Non sostituisce il controllo accessi** e non entra nelle liste di presenza operative, che restano quelle degli operatori | M |
| RF-CHK-17 | Il codice contenuto nel QR di sala **ruota a intervalli brevi** e vale solo per l'intervallo corrente | M |
| RF-EVT-39 | Se il modulo chat è attivo su un evento **per cui non è previsto il check-in**, la configurazione lo segnala e propone l'attivazione dello sblocco di sala. Un modulo che non si sbloccherà mai non si pubblica in silenzio | M |

**RB11 modificata** — La chat richiede biglietto valido, **presenza accertata** — per check-in
all'ingresso o per sblocco di sala — e diritto premium: tre condizioni congiunte.

---

### B12 — L'archivio della wall contraddice la politica di conservazione

**Dove**: `04` RF-WALL-24, RF-WALL-12, §9 · **Priorità**: prima del primo evento reale

RF-WALL-24 consente all'organizzatore di scaricare in blocco tutti i contenuti approvati;
RF-WALL-12 e la sezione privacy ne prevedono la cancellazione automatica. Insieme, significano
che la cancellazione è nominale: le copie sono già fuori.

**Risoluzione.** Si dice la verità nel consenso e si restringe l'esportazione. Un contenuto
approvato ma **mai proiettato** non è mai stato reso pubblico e non deve finire nell'archivio:
è la distinzione che rende la restrizione difendibile senza togliere all'organizzatore ciò che
gli serve davvero, cioè le foto della sua serata.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-50 | Il **consenso al primo invio** dichiara che i contenuti proiettati sono resi pubblici in sala e **possono essere conservati e riutilizzati dall'organizzatore**, che ne diventa titolare autonomo. Senza il consenso l'invio non è possibile | M |
| RF-WALL-51 | L'esportazione di fine serata comprende i **soli contenuti effettivamente proiettati**. Un contenuto approvato e mai andato in onda non entra nell'archivio | M |
| RF-WALL-52 | Ogni esportazione è **registrata** con autore, momento e numero di contenuti, ed è consultabile dal partecipante nella sezione dei propri contenuti | M |
| RF-WALL-53 | La cancellazione automatica è **dichiarata per ciò che è**: la piattaforma cancella quanto detiene e non può revocare le copie già esportate. L'accordo con l'organizzatore ne disciplina la conservazione | M |

**RF-WALL-24 modificata** — Archivio dell'evento: i contenuti **proiettati**, scaricabili in
blocco dall'organizzatore a fine serata.

---

### B13 — Il carrello multi-organizzatore non è risolto

**Dove**: `04` RF-PAY-1 · **Priorità**: alla prossima revisione

Con incassi diretti su account distinti un pagamento unico non è possibile, e il requisito
attuale si limita a dire «dello stesso organizzatore» senza dire cosa accade altrimenti.

**Risoluzione.** Suddivisione automatica in un ordine per organizzatore, con pagamenti separati
e sequenziali, dichiarata prima del pagamento. La questione lasciata aperta dall'audit — fee per
ordine o per riga — **si risolve da sé calcolando i diritti di prevendita per biglietto**: la
suddivisione non cambia il totale, e non nasce l'incentivo perverso a manipolare il carrello per
pagare meno.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-34 | Il carrello con eventi di **organizzatori diversi si suddivide in un ordine per organizzatore**, con pagamenti separati e sequenziali. La suddivisione è dichiarata prima del pagamento, con l'importo di ciascun ordine | M |
| RF-PAY-35 | I **diritti di prevendita si calcolano per biglietto**, non per ordine: la suddivisione non modifica il totale complessivo pagato | M |
| RF-PAY-36 | Ogni sotto-ordine ha la **propria prenotazione temporanea**, avviata contestualmente; il conto alla rovescia mostrato è il più stringente. L'abbandono dopo il primo pagamento rilascia le prenotazioni residue e **non annulla ciò che è già stato pagato** | M |
| RF-PAY-37 | Riepilogo finale e area personale presentano i sotto-ordini come **un solo acquisto**, con il dettaglio per organizzatore e ricevute distinte | M |

**RF-PAY-1 modificata** — Carrello con più titoli, più servizi accessori e più partecipanti,
anche su eventi di organizzatori diversi, con la suddivisione di RF-PAY-34.

---

### C1 — La numerazione dei requisiti è fuori sequenza

Le integrazioni successive hanno prodotto sequenze come RF-EVT-9 → RF-EVT-20 → RF-EVT-10, e
questo documento ne aggiunge altre. In un documento di lavoro non è un problema; nella versione
destinata al cliente sembra trascuratezza.

**Risoluzione — regola adottata:**

1. La rinumerazione continua avviene **una sola volta, alla revisione 1.2** di `04`, contestuale
   alla produzione della versione presentabile al cliente. Rinumerare a ogni integrazione
   invaliderebbe i riferimenti in corso d'opera.
2. La revisione 1.2 porta in allegato una **tabella di corrispondenza** vecchio → nuovo.
3. Da quel momento gli identificativi sono **stabili e mai riusati**: un requisito eliminato
   lascia il proprio numero vuoto, con la dicitura *soppresso*. È l'unico modo perché un
   riferimento citato in una email di sei mesi prima significhi ancora qualcosa.

L'esecuzione è lavoro meccanico e va pianificata con la revisione 1.2, non con questo documento.

---

### C2 — «Posto letto» e «gestione alloggi» sembrano in contraddizione

Non lo sono, ma il documento non lo dice. **Risoluzione — distinzione dichiarata:**

| Funzione | Che cos'è | Fase |
|---|---|---|
| **Posto letto** | Servizio accessorio a inventario noto: l'organizzatore ha una convenzione con una struttura, vende N posti a un prezzo, con quota di capienza e cut-off di rimborso propri. È identico a una cena | **Primo rilascio** |
| **Gestione dell'ospitalità** | Matching tra ballerini: chi offre un divano e chi cerca un posto dove dormire, con abbinamento, contatto e responsabilità del tutto diverse | **Fase 3** |

La prima vende un prodotto, la seconda mette in contatto due persone perché una dorma a casa
dell'altra. Che la seconda stia in fase 3 non è un caso: ha lo stesso profilo di rischio della
ricerca partner e richiede gli stessi presidi.

---

### C3 — Le lezioni private del primo rilascio non sono quelle della fase 2

**Risoluzione — distinzione dichiarata:**

| Fase | Forma | Cosa richiede |
|---|---|---|
| **Primo rilascio** | Servizio accessorio con **slot predisposti dall'organizzatore**: un elenco di orari a capienza, venduti come qualunque altro accessorio | Nulla di nuovo: è già coperto dal catalogo dei servizi |
| **Fase 2** | **Prenotazione sul calendario del maestro**, con disponibilità reali, conferma, politica di cancellazione | Il ruolo Maestro con login, il calendario, la disponibilità |

Non è la stessa funzione due volte: nella prima forma il maestro non ha accesso alla
piattaforma, e chi garantisce che sia libero alle 15 di domenica è l'organizzatore.

---

### C4 — La traduzione riguarda solo la scheda evento

RF-PUB-9 prevede una seconda lingua per «i contenuti dell'organizzatore», ma i testi che un
partecipante straniero deve capire per forza sono altri: le dichiarazioni da accettare, i nomi
dei requisiti, la policy di rimborso. Un encuentro internazionale con la descrizione tradotta e
la dichiarazione di responsabilità in solo italiano ha un problema, non un'imperfezione.

**Risoluzione — regola:** se un testo redatto dall'organizzatore compare in un **percorso di
acquisto o di adempimento**, è traducibile.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PUB-10 | La seconda lingua opzionale copre **tutti i testi redatti dall'organizzatore che compaiono in un percorso di acquisto o di adempimento**: nomi e descrizioni dei titoli e delle sessioni, nomi e testi dei requisiti e delle dichiarazioni da accettare, descrizioni dei servizi accessori, testo della policy di rimborso, contenuti di servizio della wall. In assenza della traduzione si mostra il testo originale **con l'indicazione della lingua**, mai una stringa vuota | M |
| RF-PUB-11 | Il back-office segnala all'organizzatore **quali testi obbligatori non sono ancora tradotti** quando l'evento dichiara una seconda lingua, prima della pubblicazione | M |

---

### C5 — Non è definito cosa fa scattare `vendita_chiusa`

**Risoluzione — quattro criteri configurabili, non alternativi:**

| Criterio | Comportamento |
|---|---|
| **Data e ora dichiarate** | Chiusura programmata, tipica dei festival che chiudono le iscrizioni una settimana prima per organizzare le liste |
| **Esaurimento** | Tutte le quote limitanti della vendita online sono sature |
| **Decisione manuale** | L'organizzatore chiude quando vuole, senza motivazione |
| **Inizio dell'evento** | Criterio **sempre attivo**, come ultimo in ordine di tempo |

Chiude **il primo che si verifica**. La riapertura manuale resta possibile finché l'evento non è
iniziato e la capienza lo consente — serve per il caso concreto della rinuncia che libera posti
tre giorni prima.

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-40 | Il passaggio a `vendita_chiusa` avviene per il **primo dei criteri configurati che si verifica**: data e ora dichiarate, esaurimento di tutte le quote limitanti, decisione manuale, inizio dell'evento — quest'ultimo sempre attivo. La riapertura manuale è possibile finché l'evento non è iniziato e la capienza lo consente | M |
| RF-EVT-41 | `vendita_chiusa` chiude la **sola vendita online**: vendita alla porta ed emissione manuale di pass restano possibili, coerentemente con RB20 | M |

---

## 4. Decisioni del committente — chiuse

Le tre scelte di merito sono state **confermate il 31 luglio 2026**, tutte secondo la
raccomandazione dell'analista.

| # | Decisione | Esito |
|---|---|---|
| **D10** | **Minori** (B9) | **Ammessi** alle tre soglie: account dai 14 anni compiuti · sotto i 14 nessun account, con iscrizione da parte di un adulto · chat riservata ai maggiorenni. L'organizzatore dichiara sull'evento se li ammette e a quali condizioni. RF-ACC-10/11/12, RF-EVT-38 |
| **D11** | **Classificazione automatica delle immagini** (B4) | **Adottata.** Ogni immagine è classificata prima di comparire in chat; ciò che risulta sospetto è trattenuto e non è visibile a nessuno. RF-WALL-43/44, RB23 |
| **D12** | **Contestazioni di addebito** (B3) | **Penale del prestatore a carico dell'organizzatore**, dichiarata nelle condizioni di servizio. **Soglia di sospensione allineata a quella del prestatore**, preceduta da una soglia di attenzione più bassa che genera un avviso all'Owner. RF-PAY-31, RF-ORG-13 |

### Requisiti che ne discendono

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-13 | Le **condizioni di servizio per l'organizzatore** dichiarano che la penale applicata dal prestatore su ogni contestazione di addebito è a suo carico, e la addebitano sul primo regolamento utile. La dichiarazione è versionata come tutte le altre | M |
| RF-PAY-38 | Il monitoraggio del tasso di contestazione opera su **due soglie**: una di **attenzione**, più bassa, che genera un avviso all'Owner con l'indicazione delle cause ricorrenti; una di **sospensione**, allineata a quella del prestatore, che porta la questione al Super Admin | M |
| RF-ADM-10 | Il **catalogo dei diritti dei piani** e le **soglie di contestazione** sono parametri di configurazione della piattaforma, modificabili dal Super Admin senza rilascio: le soglie dei prestatori cambiano nel tempo | M |

### Le ragioni delle due scelte non ovvie

**Perché la penale all'organizzatore.** La contestazione nasce nel rapporto tra organizzatore e
partecipante — evento diverso da quello promesso, rimborso non concesso, comunicazione assente —
e la piattaforma non ha leva su nessuna di queste cause. Farla ricadere su chi può prevenirla è
anche l'unico incentivo che funziona. La piattaforma non ne esce indenne: subisce comunque lo
storno dei propri diritti di prevendita (RF-PAY-30). Entrambe le parti perdono qualcosa, ed
entrambe hanno motivo di evitare che accada.

**Perché la soglia allineata al prestatore.** Fissarne una più severa sarebbe arbitrario, una
più permissiva sarebbe inutile: oltre la propria soglia il prestatore sospende comunque
l'account, e un organizzatore che non può incassare non può operare (RF-ORG-11). Il valore che
la piattaforma può aggiungere non è una soglia propria, è **avvisare prima** — con una soglia di
attenzione più bassa e con l'indicazione di quali ordini stanno generando contestazioni, mentre
c'è ancora tempo per correggere.

**Conseguenza operativa di D11 da mettere in piano.** La classificazione è un servizio esterno a
consumo: entra nei costi ricorrenti, nell'elenco dei trasferimenti dell'informativa (§9 di `04`)
e tra le dipendenze da monitorare. Se il servizio non risponde, la regola di RB23 non si allenta:
l'immagine resta trattenuta finché non è stata classificata o approvata da un moderatore.

---

## 5. Rischi nuovi

| # | Rischio | Impatto | Mitigazione |
|---|---|---|---|
| **R18** | **Falsi positivi della classificazione automatica**: una foto innocua trattenuta durante una serata in cui il tempo è tutto, e un partecipante che non capisce perché il suo contenuto non appare | Medio sull'esperienza | Coda prioritaria in console, notifica al moderatore, indicazione all'autore che il contenuto è in verifica e non perduto, soglia di sensibilità tarabile |
| **R19** | **Sblocco di sala usato fuori dalla sala**: il QR fotografato e condiviso allarga la chat a chi non è presente | Medio sulla tenuta del vincolo | Codice a rotazione breve, verifica del possesso di un titolo valido, limitazione di frequenza, possibilità per il moderatore di rigenerare il codice |
| **R20** | **Biglietto senza titolare a ridosso dell'evento**: il terzo iscritto da altri rifiuta tardi, e non c'è più tempo per trasferire o rimborsare | Basso-medio | Richiesta di conferma inviata immediatamente, solleciti automatici, e proposta del trasferimento come prima opzione all'acquirente |

---

## 6. Stato dell'audit dopo questo documento

| Parte | Stato |
|---|---|
| **A1 – A5** contraddizioni | Chiuse nei giri quinto e settimo |
| **B1 – B2** tesseramento e modello fiscale | Chiusi nei giri sesto e ottavo |
| **B3 – B13** buchi di analisi | **Chiusi in questo documento**, decisioni del committente comprese |
| **C1 – C5** chiarezza e forma | **Chiusi in questo documento**; l'esecuzione di C1 è pianificata con la revisione 1.2 |
| **D10, D11, D12** scelte di merito | **Confermate dal committente il 31 luglio 2026**, tutte secondo la raccomandazione dell'analista (§4) |

**L'audit è chiuso integralmente.** Restano fuori da questo documento, e per ragioni diverse:
la **verifica sulla ripartizione dei diritti di prevendita** presso PayPal e Satispay (Q19), che
è una precondizione allo sviluppo del checkout e non un punto di analisi; le **quattro decisioni
sulla matrice dei ruoli** (Q1), che appartengono a `02`; e la **versione presentabile al
cliente**, che è un deliverable e non una lacuna.
