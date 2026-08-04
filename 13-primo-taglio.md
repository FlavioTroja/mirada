# Mirada Tango — Il primo taglio

**Data** 31 luglio 2026 · **Proposta di perimetro** · Allegato a `04-analisi-funzionale.md` §10

**Obiettivo**: mettere due o tre organizzatori già clienti in condizione di **aprire le
prenotazioni del prossimo evento**, con incasso reale sul proprio account.

La fase 1 conta trecento requisiti. Non è «subito». Questo documento definisce il sottoinsieme
minimo che porta un evento vero in vendita, e — più importante — dichiara che cosa resta fuori e
**che cosa lo sostituisce nel frattempo**, perché un taglio senza sostituto non è un taglio, è
un buco.

---

## 1. Il principio del taglio

Con **due o tre clienti noti**, molte funzioni possono essere presidio umano invece che
software. Non tutte: la regola che distingue è una sola.

> Resta software ciò che accade **mentre nessuno guarda** — di notte, sotto contesa, in sala
> senza rete. Diventa presidio umano ciò che accade **poche volte e in orario di lavoro**.

Un rimborso è un'email e un clic su Stripe: si può fare a mano dieci volte. Due persone che
comprano l'ultimo posto follower alle 21:04 di un martedì non si possono gestire a mano
nemmeno una volta.

---

## 2. La scoperta che sblocca i tempi

**Un solo prestatore di pagamento nel primo taglio: Stripe.**

Q19 — la ripartizione dei diritti di prevendita su PayPal e Satispay — era registrata come
**l'unica precondizione allo sviluppo del checkout**. Con Stripe Connect la ripartizione è
nativa: la quota di piattaforma è trattenuta sulla transazione, senza accordi da negoziare.

**Q19 esce quindi dal percorso critico.** L'accordo di partner PayPal, che ha tempi di
approvazione non governabili, si avvia adesso e corre in parallelo allo sviluppo; Satispay si
verifica con calma. Nessuno dei due blocca più la partenza.

È l'unica cosa in questo documento che cambia una data anziché un perimetro.

---

## 3. Che cosa non è tagliabile

Prima dei tagli, il nocciolo. Sono le funzioni che, se assenti, rendono il prodotto
indistinguibile da un modulo di prenotazione qualsiasi — o che espongono a un danno.

| Che cosa | Perché |
|---|---|
| **Motore di capienza** (`05` per intero) | Quote per ruolo, tolleranza di sbilancio, iscrizione a coppia, impegno atomico. È il prodotto: senza, si vende un form |
| **Prenotazione di 15 minuti** | Senza, si vende lo stesso posto due volte durante il pagamento |
| **QR firmato verificabile offline** | Un QR non firmato è un QR falsificabile con uno screenshot |
| **Check-in senza connessione** | Le sale da ballo senza rete sono la norma, non l'eccezione. È la funzione che si scopre mancante nel momento peggiore |
| **Diritti di prevendita esposti a parte** | È il modello di ricavo, ed è ciò che rende la piattaforma un canale di prevendita |
| **RF-ORG-8, RF-TCK-11, RF-BKO-9** | Le tre condizioni che reggono il posizionamento fiscale. Toglierne una espone il committente. Costano poco: una dichiarazione, dei testi corretti, un'esportazione |

---

## 4. Dentro il primo taglio

| Area | Contenuto | Requisiti |
|---|---|---|
| **Account** | Registrazione, profilo con ruolo di ballo, ruolo sovrascrivibile per iscrizione, cancellazione dei dati | RF-ACC-1, 3, 4, 7 |
| **Organizzazione** | Creata **a mano** dal Super Admin. Account di incasso collegato e verificato abilitato. Dichiarazione di inquadramento fiscale | RF-ORG-5, 8, 9, 10 |
| **Evento** | Percorso di creazione, dati base, locandina, location, **sessioni**, cast, ciclo di vita, anteprima, chiusura vendita | RF-EVT-1→6, 14, 15, 40, 41 |
| **Titoli** | Definizione, sessioni incluse come elenco esplicito, scaglioni di prezzo, unità per persona o per coppia, titoli senza ruolo, modelli precompilati | RF-EVT-7, 23, 25, 26, 27, 28, 29, 30 |
| **Quote** | Su qualunque dimensione, flag limitante, contingente per canali esterni, aggiornamento dei totali | RF-EVT-9, 20, 21, 22, 32, 33 |
| **Requisiti** | Solo **dichiarazione** e **campo custom**. Nessun upload, nessun dato sanitario | RF-REQ-1, 4, 5, 6 |
| **Scheda evento** | Pagina pubblica con disponibilità per ruolo, URL stabile, immagine di condivisione, dati strutturati | RF-PUB-5, 6 |
| **Checkout** | Carrello, prenotazione 15 minuti con conto alla rovescia e riarmo, dati dei partecipanti, riepilogo con diritti di prevendita, **Stripe**, impegno atomico, idempotenza, disponibilità parziale | RF-PAY-1→4, 6, 7 (solo Stripe), 8→13, 15→17, 20→26, 33 |
| **Biglietto** | QR firmato, PDF via email e in area personale, **trasferimento del nominativo**, emissione manuale di pass | RF-TCK-1→9, 11, 12, 14→18 |
| **Ruolo e coppia** | Quote per ruolo, disponibilità distinta, ruolo flessibile, cancello di tolleranza, iscrizione a coppia, vista di controllo | RF-CPL-1→8, 11, 12 |
| **Check-in** | App web, lista scaricata, funzionamento offline, esiti distinti, più operatori, ricerca manuale, per sessione, annullamento, contatore presenze | RF-CHK-1→9, 13 |
| **Back-office** | Cruscotto con iscritti per ruolo e sbilancio, elenco iscritti, **export CSV**, liste operative, riepilogo economico, esportazione con dettaglio per sessione | RF-BKO-1→4, 6, 9 |
| **Comunicazioni** | Email transazionali, modelli in italiano e inglese | RF-COM-1, 6 |
| **Piattaforma** | Cataloghi (tipi evento, requisiti, servizi), elenco organizzazioni ed eventi, registro delle azioni sensibili | RF-ADM-2, 4, 9 |

Il **motore di capienza** di `05` è dentro per intero, invarianti e casistica di test compresi.
Il caso T23 — cinquanta acquisti simultanei su dieci posti — va automatizzato prima
dell'apertura vendite del primo evento, non dopo.

**Servizi accessori**: dentro se il primo evento li vende (pasti, t-shirt, transfer). Sono
RF-EVT-11 e le quote di ambito servizio, già coperte dal motore. È una domanda da fare ai
clienti, non una scelta di architettura.

---

## 5. Che cosa resta fuori, e che cosa lo sostituisce

| Fuori | Sostituto nel primo taglio |
|---|---|
| **Chat e Live Wall** | Nulla. Completano la fase 1 subito dopo. Sono la funzione che vende il prodotto, non quella che apre le vendite |
| **Bacheca cerco-partner** | Nulla. Resto della fase 1 |
| **PayPal e Satispay** | Solo Stripe, che copre carta, Apple Pay e Google Pay. L'accordo PayPal si avvia in parallelo |
| **Motore di rimborso a scaglioni** (RF-RMB-1→8) | **Rimborso manuale registrato a sistema**, che rilascia le quote e invalida il QR (RF-RMB-9 resta). La policy è scritta sulla scheda evento e applicata a mano. Il trasferimento del nominativo, che è dentro, ne assorbe buona parte |
| **Contestazioni di addebito** (RF-PAY-27→32) | Gestione manuale con i dati esportati. Con tre clienti sono pochi casi l'anno |
| **Onboarding self-service degli organizzatori** (RF-ORG-1→4, 7) | Creazione a mano dal Super Admin. Sono clienti già noti: la coda di approvazione serve quando arrivano sconosciuti |
| **Calendario pubblico, ricerca, mappa** (RF-PUB-1→4, 7, 8) | Collegamento diretto alla scheda evento, diffuso dall'organizzatore sui propri canali. Vedi il rischio al §6 |
| **Codici promozionali** (RF-PAY-5) | **Titolo riservato con codice**, che RF-EVT-7 già prevede come attributo di visibilità: copre lo sconto per soci, allievi e ospiti senza costruire un motore di promozioni |
| **Vendita alla porta** (RF-CHK-10→12) | Da valutare evento per evento: se il primo evento vende in cassa la sera stessa, rientra. Altrimenti resta fuori |
| **Annullamento di singola sessione, minori, classificazione delle immagini, sblocco di sala** | Chiusi in analisi, realizzati con i moduli a cui appartengono. La classificazione e lo sblocco servono solo con la chat |
| **Wallet, notifiche push, passaporto, tracker delle tande, mappa community, nomadi** | Fase 2 (`12-app-tanghero.md`) |
| **Premium** | Progettato e spento, come già deciso. L'interruttore concede tutto a tutti |

---

## 6. I rischi del taglio, dichiarati

| # | Rischio | Come si presidia |
|---|---|---|
| **T1** | **Il rimborso manuale non scala.** Funziona con tre organizzatori, diventa un problema al quinto | Misurare quante richieste arrivano sul primo evento reale. Il motore a scaglioni rientra prima del quarto cliente, non quando fa male |
| **T2** | **Senza calendario pubblico non c'è marketplace.** Il primo taglio è una biglietteria, non un canale: nessun effetto di rete, nessuna scoperta | Dirlo ai clienti con chiarezza. Stanno adottando uno strumento di gestione; il canale arriva con il calendario e con l'app. Prometterlo ora sarebbe una promessa non mantenuta al primo evento |
| **T3** | **Un solo metodo di pagamento.** Una parte del pubblico italiano di eventi paga volentieri con PayPal | Misurare l'abbandono in checkout sul primo evento. È anche il dato che dirà quanto vale davvero l'accordo PayPal |
| **T4** | **La prima vendita vera è un collaudo.** Apertura iscrizioni di un festival atteso significa centinaia di accessi in pochi minuti sul componente più delicato | T23 automatizzato prima, e presidio umano in diretta durante la prima apertura vendite |

---

## 7. Precondizioni non tecniche

Nessuna di queste è sviluppo, e tutte possono bloccare la partenza.

1. **Account Stripe Connect della piattaforma**, e onboarding dei clienti con verifica di
   identità completata. Non è immediato: va avviato per primo.
2. **Condizioni di servizio e informativa privacy**, nella versione minima ma reale — comprese
   la dichiarazione dell'organizzatore (RF-ORG-8) e l'accordo sul trattamento dei dati dei
   partecipanti.
3. **Testi del documento emesso** conformi a RF-TCK-11: conferma d'ordine, nessuna numerazione
   progressiva, nessuna dicitura che lo faccia sembrare un titolo fiscale.
4. **La data del primo evento reale.** È la vera scadenza del progetto e non è ancora nota
   (Q7). Tutto il resto si pianifica a ritroso da lì.

---

## 8. Sequenza proposta

| Passo | Contenuto |
|---|---|
| **1** | Motore di capienza con la sua casistica di test, e modello dati dell'evento. È il fondamento: si costruisce per primo e si collauda prima di avere un'interfaccia |
| **2** | Creazione evento, titoli, quote, scheda pubblica |
| **3** | Checkout Stripe con prenotazione, emissione del biglietto, email |
| **4** | Check-in offline e back-office con esportazioni |
| **5** | **Primo evento reale**, con presidio in diretta all'apertura vendite |
| **6** | Chat e Live Wall, bacheca, rimborsi automatici, PayPal — completamento della fase 1 |
| **7** | L'app del tanghero (`12`) |

Il passo 5 non è una consegna, è un collaudo: il primo evento vero va scelto tra i clienti
**piccolo abbastanza da poterlo seguire di persona** e abbastanza vero da mettere sotto sforzo
le quote per ruolo. Un festival da ottocento persone come primo evento è un rischio inutile.

---

## 9. Che cosa serve sapere dai clienti

Cinque domande, e le risposte cambiano il perimetro sopra:

1. **Quando apre le vendite il prossimo evento?** È la scadenza reale.
2. Che tipo di evento è: festival con sessioni multiple, marathon con pass unico, stage?
   Determina quanto del modello serve subito.
3. **Usa quote per ruolo e iscrizione a coppia?** Se sì, il nocciolo è confermato; se no,
   il primo evento non collauda ciò che distingue il prodotto — e ne serve un altro che lo faccia.
4. Vende **servizi accessori** (pasti, alloggio, t-shirt, lezioni private)?
5. Vende **alla porta** la sera dell'evento, e su **altri canali** oltre alla piattaforma?
