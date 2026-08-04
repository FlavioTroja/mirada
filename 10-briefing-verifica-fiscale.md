# Briefing per la verifica fiscale — emissione dei titoli d'ingresso

**Destinatario**: commercialista specializzato in spettacolo e intrattenimento, e/o operatore di biglietteria autorizzato
**Oggetto**: obblighi di emissione dei titoli d'ingresso per eventi di tango argentino venduti tramite piattaforma online
**Data**: 31 luglio 2026

> **Stato: non più bloccante.** Il committente ha stabilito che gli adempimenti fiscali restano
> in capo all'organizzatore e si svolgono fuori dalla piattaforma, come già avviene oggi. La
> piattaforma è un canale di vendita: emette una conferma d'ordine con QR di accesso, non un
> titolo fiscale. Questo briefing resta valido e utile — per una consulenza di conferma, o da
> girare a un organizzatore che ponga la domanda — ma **non è una precondizione allo sviluppo**.
> Restano rilevanti in particolare le domande 5 e 8 e le ipotesi H4 e H5.

---

## 1. Contesto

Stiamo progettando una piattaforma di vendita online di ingressi a eventi di tango argentino
in Italia: festival, marathon, encuentro, stage didattici e serate danzanti (milonghe). Gli
eventi sono organizzati da soggetti terzi che si registrano sulla piattaforma.

Elementi rilevanti dell'impianto:

- **Tutti i titoli sono venduti come biglietti commerciali.** Non è prevista la vendita come
  quota di partecipazione riservata ai soci, e il tesseramento associativo resta fuori dalla
  piattaforma.
- Il prezzo del titolo è stabilito dall'organizzatore; la piattaforma aggiunge **diritti di
  prevendita** a proprio favore, pagati dal partecipante ed esposti come voce separata.
- **L'incasso avviene direttamente sull'account di pagamento dell'organizzatore**, con i diritti
  di prevendita ripartiti a favore della piattaforma sulla stessa transazione.
- Il titolo è oggi previsto come **PDF nominale con QR firmato**, verificato all'ingresso.
  Non è un titolo emesso da un sistema certificato.
- Gli organizzatori attesi sono eterogenei: società commerciali, associazioni con partita IVA,
  associazioni senza, persone fisiche che organizzano occasionalmente.
- Un singolo evento può vendere insieme **accessi didattici** (workshop e seminari) e **accessi
  a serate danzanti**, spesso dentro un unico pass a prezzo unico.

---

## 2. Le domande

### Inquadramento dell'attività

1. Un evento di tango con ingresso a pagamento rientra tra gli **intrattenimenti** o tra gli
   **spettacoli**? Il trattamento cambia a seconda che si tratti di sola serata danzante, di
   soli seminari didattici, o di un evento che comprende entrambi?
2. Il trattamento cambia in funzione della natura dell'organizzatore (società, associazione con
   o senza partita IVA, persona fisica occasionale)?
3. Esistono **soglie, esenzioni o regimi semplificati** applicabili per dimensione dell'evento,
   importo degli incassi, occasionalità o numero di eventi annui?

### Obbligo del titolo di accesso

4. Per gli eventi che rientrano nel regime, è obbligatorio che il titolo sia emesso attraverso
   un **sistema di emissione certificato** — con numerazione progressiva, sigillo fiscale e
   trasmissione dei dati — oppure sono ammesse forme alternative per la vendita esclusivamente
   online?
5. **Chi è il soggetto obbligato all'emissione**: l'organizzatore dell'evento o chi vende il
   titolo per suo conto? Quale ruolo assume una piattaforma online che raccoglie l'ordine ma non
   incassa direttamente il prezzo del titolo, che va sull'account dell'organizzatore?
6. È ammissibile che la piattaforma si appoggi a un **emittente già autorizzato**, in modalità
   white label, restando il punto di vendita verso il pubblico? Quali obblighi resterebbero in
   capo alla piattaforma e quali all'emittente?
7. Un **PDF nominale con QR verificato all'ingresso** può essere sufficiente per gli eventi non
   soggetti al regime? Ci sono requisiti minimi di contenuto o di conservazione anche in quel
   caso?

### Composizione del prezzo

8. Un pass unico che comprende **workshop didattici e serate danzanti** va scomposto ai fini
   fiscali tra le due componenti, o è trattato unitariamente? Se va scomposto, con quale
   criterio? *(È la domanda con il maggiore impatto sul nostro modello dati: determina se il
   titolo debba portare una ripartizione del prezzo per componente.)*
9. I **diritti di prevendita** della piattaforma costituiscono una prestazione autonoma soggetta
   a IVA ordinaria? Vanno esposti separatamente sul titolo, oltre che in fase di acquisto? Chi
   emette il documento verso il partecipante per questa componente?
10. Se sullo stesso ordine coesistono il titolo d'ingresso e **servizi accessori** (pasti,
    pernottamento, transfer, lezioni private), il trattamento di questi ultimi è autonomo?

### Gestione del ciclo di vita

11. Come si trattano **rimborsi e annullamenti** su titoli già emessi: annullamento del titolo,
    documenti da produrre, tempistiche?
12. È ammesso il **cambio di nominativo** su un titolo già emesso, e con quali formalità?
13. La **vendita alla porta** il giorno dell'evento, con incasso in contanti o POS, segue lo
    stesso regime della vendita online o ha obblighi propri?
14. Gli **accrediti e gli omaggi** a staff, artisti e ospiti vanno documentati con un titolo, e
    con quale forma?

### Adempimenti connessi

15. Quali obblighi verso **SIAE** ricadono sull'organizzatore e quali eventualmente sulla
    piattaforma, per la parte di diritti d'autore e per la parte di rendicontazione degli
    ingressi?
16. Esistono obblighi di **conservazione** dei dati di vendita, e per quanto tempo?

---

## 3. Cosa ci serve come risposta

Una risposta scritta, anche sintetica, che permetta di stabilire:

- **quali categorie di eventi** tra quelli descritti richiedono l'emissione certificata e quali no;
- **su chi ricade l'obbligo** nella configurazione descritta;
- **se il prezzo di un pass misto** vada scomposto, e come;
- se esistono **percorsi alternativi** praticabili per la vendita esclusivamente online.

Le prime tre determinano requisiti di sistema e vanno chiuse **prima di sviluppare il checkout
e l'emissione del biglietto**. La quarta determina tempi e costi di un'eventuale integrazione
con un emittente autorizzato, che stimiamo in 3-6 mesi in prevalenza contrattuali.

---

## 4. Le nostre ipotesi di lavoro, da confermare o smentire

Riportiamo le leve che riteniamo determinino la risposta, così che possiate confermarle o
correggerle punto per punto. Sono ipotesi formulate senza competenza specialistica.

| # | Ipotesi | Effetto se confermata |
|---|---|---|
| H1 | Le **serate danzanti con musica riprodotta da DJ** rientrano tra gli intrattenimenti, e quindi nel regime del titolo di accesso quando l'ingresso è a pagamento | È il caso della maggior parte dei nostri eventi |
| H2 | I **seminari e i corsi di ballo** sono prestazione didattica e non intrattenimento, quindi fuori dal regime | Uno stage di soli workshop non richiederebbe titolo di accesso |
| H3 | Un **evento gratuito** non genera obbligo, restando fermi gli adempimenti sui diritti d'autore | Pratiche e presentazioni restano fuori |
| H4 | L'obbligo di emissione ricade sull'**organizzatore**, non su chi vende per suo conto | La piattaforma resta canale di prevendita e il documento che emette è una conferma d'ordine con QR di accesso, non un titolo fiscale |
| H5 | Per organizzatori occasionali o di piccole dimensioni esistono **forme semplificate** — storicamente titoli a tagliando vidimati anziché sistema automatizzato | Cambierebbero i costi e i tempi di conformità per una parte degli organizzatori |
| H6 | I **diritti di prevendita** della piattaforma sono prestazione autonoma soggetta a IVA ordinaria, documentata dalla piattaforma verso il partecipante | Nessun impatto sul titolo dell'organizzatore |

Le due questioni che questa impostazione **non risolve**, e su cui chiediamo in particolare il
vostro parere:

1. Se la piattaforma è **l'unico canale di vendita** di un evento, la qualificazione di
   H4 regge, o la piattaforma entra comunque nella catena di emissione?
2. La scomposizione del **pass misto** della domanda 8: è la sola questione che, se risolta in
   un certo modo, ci obbliga a modificare la struttura dei dati.

## 5. Nota

Le considerazioni contenute in questo documento riflettono l'impostazione data al progetto e
non costituiscono un inquadramento fiscale: sono formulate proprio per essere confermate o
corrette. In particolare non diamo per acquisito che gli eventi descritti rientrino nel regime
degli intrattenimenti: è la prima cosa che chiediamo di verificare.
