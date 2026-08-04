# Mirada Tango — Il piano Premium per i ballerini

**Data** 30 luglio 2026 · Allegato a `04-analisi-funzionale.md` §6.16 · Chiude la questione aperta Q3

---

## 1. Il modello

L'applicazione di base resta **gratuita**: registrarsi, consultare il calendario e il
programma, acquistare biglietti, ricevere i propri titoli e fare il check-in non costano nulla
e non costeranno nulla. È la scelta corretta anche dal punto di vista commerciale: un
marketplace che mette un pedaggio davanti all'acquisto riduce le vendite su cui guadagna la
fee.

Il Premium è un **secondo motore di ricavo**, indipendente dal primo, con una caratteristica
che lo rende interessante: non è pagato dagli organizzatori, non riduce il loro margine e non
richiede la loro adesione — con **una sola eccezione**, l'accesso prioritario, di cui al §5.

Le due linee di ricavo si comportano in modo complementare: la fee sui biglietti è
stagionale e legata agli eventi, l'abbonamento è ricorrente e prevedibile.

---

## 2. Il catalogo dei diritti

Ogni funzionalità Premium è un **diritto** verificato dall'unico servizio di controllo già
previsto in RF-PRM-2. Aggiungerne uno è configurazione, non sviluppo.

| Diritto | Cosa sblocca | Valore percepito | Costo di realizzazione |
|---|---|---|---|
| `ricerca_partner_avanzata` | Ricerca e contatto di partner per ruolo, livello, città ed evento (§4) | **Alto** — è il bisogno più sentito dai ballerini singoli | Alto: è una funzione nuova, con implicazioni di sicurezza |
| `accesso_anticipato` | Apertura delle iscrizioni in anticipo sul pubblico, sugli eventi e sugli slot che l'organizzatore include (§5) | **Alto** su eventi e maestri richiesti, nullo sugli altri | Medio: estende le finestre di vendita già previste |
| `chat_evento` | Scrittura nella chat di sala | Medio, e solo durante l'evento | Nullo: già previsto |
| `profilo_verificato` | Livello attestato da un maestro presente in piattaforma, con badge | Medio-alto: risolve il problema dell'autodichiarazione | Medio |
| `annuncio_in_evidenza` | Annuncio cerco-partner in cima ai risultati | Medio | Basso |
| `avvisi_anticipati` | Notifica sull'apertura delle iscrizioni degli eventi seguiti, prima dell'annuncio pubblico | Medio-alto: nel tango gli eventi ambiti si esauriscono in minuti | Basso |
| `archivio_personale` | Download delle proprie foto proiettate sulla wall e dei contenuti dell'evento | Basso-medio | Basso |
| `storico_personale` | Statistiche di partecipazione: eventi, maestri, DJ, città, andamento nel tempo | Basso, ma alto in affezione | Basso |
| `fee_ridotta` | Fee di piattaforma azzerata o dimezzata sui biglietti | Alto e misurabile in euro | Nullo tecnicamente, ma erode la prima linea di ricavo |

## 2.1 La composizione decisa

**Un solo piano, 4,99 € all'anno**, che sblocca tutti i diritti del catalogo tranne
`fee_ridotta`. Nessuna opzione mensile: la stagionalità del tango — attività ferma a luglio e
agosto, ripresa a settembre — rende l'abbonamento annuale la forma naturale, e ne elimina il
problema delle disdette estive.

`fee_ridotta` è **escluso**, come deciso. A una fee del 5% si ripagherebbe con 100 € di
biglietti, cioè un solo festival, e cannibalizzerebbe la linea di ricavo principale proprio
sugli utenti più attivi.

## 2.2 Che cosa significa davvero 4,99 € all'anno

A questo prezzo il Premium **non è un motore di ricavo, ed è importante saperlo in partenza**
perché cambia i criteri con cui va giudicato. I conti, per abbonato e per anno:

| Voce | Importo |
|---|---|
| Prezzo al pubblico, IVA inclusa | 4,99 € |
| IVA ordinaria da versare | −0,90 € |
| Commissione del prestatore di pagamento (ordine di grandezza su un importo così piccolo) | −0,32 € |
| **Netto per la piattaforma** | **≈ 3,77 €** |

Tremila abbonati producono circa 11.000 € l'anno; diecimila ne producono circa 38.000. Sono
cifre che non finanziano lo sviluppo della ricerca partner né, soprattutto, il presidio umano
di moderazione che quella funzione richiede in permanenza. **L'incidenza della commissione di
pagamento è del 6-8%**, molto più alta che su un biglietto da 40 €: su importi minimi la
componente fissa pesa in modo sproporzionato.

Questo non rende la scelta sbagliata: la rende **una scelta diversa da quella che sembra**. A
4,99 € all'anno il Premium svolge bene tre funzioni che valgono più del ricavo:

1. **Qualifica le persone.** Un pagamento, anche minimo, filtra chi ha intenzioni serie. Su una
   funzione di contatto tra sconosciuti in una community sensibile alle molestie, avere una
   transazione tracciata e un'identità verificata dietro ogni richiesta è una misura di
   sicurezza che vale più di 4,99 €. È l'argomento migliore per giustificare il paywall.
2. **Massimizza l'adozione.** A questo prezzo la conversione sarà alta, e la ricerca partner ha
   bisogno esattamente di questo: densità. Una funzione di matching a 60 € l'anno resterebbe
   vuota e inutile.
3. **Apre un rapporto diretto e ricorrente** con il ballerino, indipendente dagli organizzatori.

**Raccomandazione**: presentare il Premium come qualificazione e appartenenza, non come
pacchetto di funzioni a valore. E considerare i 4,99 € un prezzo di lancio, con una revisione
programmata dopo il primo anno di dati sulla conversione: alzare il prezzo a rinnovo su una
base già acquisita è molto più facile che partire alti su una funzione vuota.

**Conseguenza operativa dell'annuale**: il rinnovo avviene una sola volta l'anno, quindi la
carta registrata sarà scaduta in una quota fisiologica di casi. Servono un preavviso di rinnovo
obbligatorio, tentativi ripetuti con recupero dello strumento di pagamento, e un periodo di
tolleranza prima della decadenza dei diritti.

---

## 3. Il livello di ballo, che è il prerequisito di tutto

La ricerca partner «dello stesso livello» richiede un dato che oggi non esiste nel modello:
il **livello del ballerino**. Il livello è attualmente un attributo delle sessioni, non delle
persone.

Il problema non è tecnico. Nel tango l'autodichiarazione del livello è notoriamente
inaffidabile — quasi tutti si collocano al centro — e il livello è anche un segnale di status
usato per selezionare con chi si balla. Una funzione a pagamento costruita su un dato
autodichiarato produce incontri sbagliati e delusione verso la piattaforma, cioè esattamente
il contrario di ciò che si vende.

**Proposta: tre fonti, mostrate insieme e mai fuse in un'etichetta unica.**

| Fonte | Come si ottiene | Attendibilità |
|---|---|---|
| **Dichiarato** | L'utente scelge tra principiante, intermedio, avanzato, e indica gli anni di pratica | Bassa, ma è il punto di partenza |
| **Desunto** | Calcolato dallo storico in piattaforma: quali sessioni ha frequentato e con quale livello, quanti eventi, in quanto tempo | **Alta**, e la piattaforma è l'unica a possederlo |
| **Attestato** | Un maestro presente in piattaforma conferma il livello di un allievo, su richiesta | Massima, ma disponibile per pochi |

Il livello desunto è l'elemento distintivo: nessun gruppo social o bacheca esistente può
calcolarlo, perché nessuno possiede lo storico delle partecipazioni. Diventa credibile dopo
qualche mese di dati reali, e questo ha una conseguenza sulla tempistica di lancio (§8).

Nell'interfaccia il confronto va sempre motivato — «ha frequentato quattro workshop di livello
avanzato negli ultimi dodici mesi» — anziché ridotto a un'etichetta. Una motivazione visibile
è verificabile dall'utente, un'etichetta no.

---

## 4. La ricerca partner avanzata

### 4.1 Che cosa è, e che cosa non deve diventare

È uno **strumento di ricerca con richiesta di contatto**, non una chat aperta e non un feed.
La distinzione è il cuore del progetto di questa funzione: una piattaforma di tango che
introduce messaggistica libera tra sconosciuti, con filtri per livello e città e a pagamento,
si avvicina involontariamente a un'app di incontri. La community del tango è particolarmente
sensibile al tema — le molestie nelle sale da ballo sono un problema reale e discusso — e la
reputazione si perde una volta sola.

| Previsto | Escluso deliberatamente |
|---|---|
| Ricerca per ruolo, livello, città, lingua, evento a cui si partecipa | Ricerca per genere o per età |
| Richiesta di contatto con messaggio di presentazione | Messaggistica libera senza consenso |
| Messaggistica **solo dopo accettazione reciproca** | Chi è online adesso, chi è nei paraggi |
| Città di riferimento | Posizione precisa o distanza in chilometri |
| Foto di profilo opzionale, moderata | Galleria di foto personali |
| Visibilità del profilo su adesione esplicita | Profili indicizzati o visibili a chi non è registrato |

### 4.2 L'asimmetria che rende il paywall sostenibile

Il diritto Premium sblocca **l'iniziativa, non la conversazione**: chi ha il Premium può
cercare e inviare richieste di contatto; chi non lo ha **riceve le richieste e può rispondere
liberamente**.

È la sola configurazione che funziona. Se anche la risposta fosse a pagamento, gli abbonati
scriverebbero a un muro e il valore del Premium sarebbe nullo il primo giorno. Così invece
ogni nuovo abbonato trova immediatamente un bacino di interlocutori raggiungibili, e chi
riceve una richiesta ha un motivo concreto per abbonarsi a sua volta.

### 4.3 Tutele, che non sono mai a pagamento

**Principio non negoziabile: nessuna funzione di tutela può essere Premium.** Blocco,
segnalazione, controllo della propria visibilità, cancellazione dei dati e limiti alle
richieste ricevute sono gratuiti per tutti, sempre. Un paywall sulla sicurezza è indifendibile
e sarebbe il primo appunto di qualunque osservatore.

| Tutela | Comportamento |
|---|---|
| Consenso reciproco | Nessun messaggio oltre la richiesta iniziale prima dell'accettazione |
| Limite alle richieste | Massimo configurabile di richieste inviate al giorno, anche per gli abbonati |
| Limite alle richieste ricevute | L'utente può sospendere la ricezione o restringerla a chi partecipa ai suoi stessi eventi |
| Blocco | Immediato, silenzioso, definitivo, e impedisce anche la comparsa nei risultati di ricerca |
| Segnalazione | Con presa in carico dalla moderazione di piattaforma e tempi dichiarati |
| Codice di condotta | Accettazione obbligatoria all'attivazione della funzione, con conseguenze dichiarate |
| Provvedimenti | Sospensione della sola funzione senza perdita dei biglietti acquistati, e rimborso proporzionale dell'abbonamento in caso di sospensione non dovuta a violazione |
| Nessuna reciprocità obbligata | Ignorare una richiesta non produce alcun segnale visibile a chi l'ha inviata |

L'ultima riga conta più di quanto sembri: l'assenza di conferme di lettura e di indicatori di
rifiuto elimina la pressione sociale che, nelle app di messaggistica, genera l'insistenza.

### 4.4 Rapporto con le funzioni già previste

Oggi l'analisi prevede già una **bacheca cerco-partner** gratuita, legata a un singolo evento
(`04` §6.9). La ricerca avanzata non la sostituisce: la bacheca resta gratuita e ancorata
all'evento, la ricerca è trasversale, continuativa e filtrata. Vanno però presentate come una
sola funzione con due livelli di profondità, non come due strumenti diversi, altrimenti
l'utente non capisce dove cercare.

---

## 5. L'accesso prioritario

### 5.1 Come funziona

Tecnicamente è un'estensione di una funzione già prevista: RF-EVT-7 assegna a ogni titolo una
**finestra di vendita**. Basta aggiungere che una finestra possa essere riservata a un piano
per un periodo definito.

```
Titolo "Lezione privata con Maestro X — slot domenica 15:00"
  apertura riservata Premium : 1 marzo, 10:00
  apertura pubblica          : 3 marzo, 10:00
```

Vale sia per gli slot delle lezioni private, sia per i titoli d'ingresso degli eventi ambiti,
sia per i servizi accessori a capienza ridotta.

### 5.2 Il problema che non è tecnico — **[DECISIONE]**

L'accesso prioritario ha una particolarità che lo distingue da ogni altro diritto del
catalogo: **la piattaforma venderebbe un vantaggio su inventario che non è suo.** I posti
sono dell'organizzatore, gli slot sono del tempo del maestro. Non si può disporne
unilateralmente, né contrattualmente né come rapporto di fiducia.

Serve quindi che l'inclusione sia **una scelta dell'organizzatore, evento per evento**, e va
deciso cosa l'organizzatore riceve in cambio:

| Ipotesi | Cosa ottiene l'organizzatore | Nota |
|---|---|---|
| Adesione gratuita con vantaggio reciproco | Visibilità in evidenza verso gli abbonati, che sono il pubblico più attivo e più propenso a comprare | La più semplice, e probabilmente sufficiente: l'apertura anticipata riempie l'evento prima e riduce l'invenduto |
| Quota di ricavo | Una percentuale dell'abbonamento redistribuita | Complessa da calcolare e da spiegare, con un'attribuzione arbitraria |
| Contropartita in fee | Fee ridotta sugli eventi che aderiscono | Erode la prima linea di ricavo |

**Proposta**: adesione gratuita e volontaria, con misurazione del beneficio (percentuale di
riempimento nella finestra anticipata) da mostrare all'organizzatore. Se il beneficio è reale
l'adesione si sostiene da sé; se non lo è, nessuna quota di ricavo la renderà accettabile.

### 5.3 Tre vincoli di equità

Senza questi, l'accesso prioritario danneggia il prodotto più di quanto lo monetizzi.

1. **Trasparenza**: le date di apertura anticipata e pubblica sono dichiarate sulla pagina
   dell'evento fin dalla pubblicazione. Nessuna scarsità nascosta.
2. **Tetto sull'inventario riservato**: una percentuale massima configurabile — proposta 30% —
   di posti allocabili nella finestra anticipata. Se il Premium può esaurire tutto, la
   disponibilità pubblica diventa una finzione e la reazione della community è garantita.
3. **Nessuna coda a pagamento**: il vantaggio è una finestra temporale anticipata, non una
   priorità all'interno della stessa finestra. Due abbonati che comprano nello stesso momento
   competono ad armi pari, come previsto dal motore di capienza.

---

## 6. Conflitti con decisioni già prese

| # | Conflitto | Proposta |
|---|---|---|
| P1 | La chat di evento richiede il Premium (`04` RF-WALL-2, RB11) | **Risolto: la chat resta Premium**, come deciso. L'obiezione era calibrata su un abbonamento mensile; a 4,99 € **all'anno** perde quasi tutta la sua forza, perché l'accesso alla chat di sala costa al partecipante circa quaranta centesimi al mese. Resta un solo accorgimento necessario: la scheda dell'evento e la conferma d'ordine devono dire **prima dell'acquisto** che la chat di sala richiede il Premium, così nessuno lo scopre in sala a evento iniziato |
| P2 | Il perimetro è «solo ticketing, community bassa»: nessun profilo pubblico, nessuna messaggistica. La ricerca partner introduce entrambi | La decisione va aggiornata: il prodotto ha ora una componente relazionale a pagamento. Non è un cambio di rotta accidentale, ma va reso esplicito perché sposta il profilo di rischio e i requisiti di moderazione |
| P3 | «Nessuna lista d'attesa, nessuna prenotazione temporanea, primo che paga»: l'accesso anticipato non le contraddice, perché agisce sulla finestra di apertura e non sulla coda | Nessuna modifica. Va però chiarito nei testi pubblici, perché al ballerino sembrerà una corsia preferenziale |
| P4 | Le lezioni private sono in fase 2 come prenotazione sul calendario del maestro; in primo rilascio sono slot venduti come servizio accessorio | L'accesso anticipato funziona su entrambe le forme, perché agisce sulla finestra di vendita. Nessun blocco |
| P5 | Il livello di ballo non esiste come attributo della persona | Va aggiunto al profilo, con le tre fonti del §3. Il livello desunto richiede storico, quindi tempo |

---

## 7. Fatturazione, adempimenti, recesso

L'abbonamento è la **prima vendita diretta della piattaforma al consumatore finale**, e non
passa dagli account degli organizzatori. Conseguenze concrete:

| Tema | Requisito |
|---|---|
| Incasso | Account di pagamento proprio della piattaforma, distinto dall'infrastruttura marketplace usata per i biglietti |
| Imposta | Prestazione di servizi con IVA ordinaria. Il prezzo di 4,99 € va dichiarato come comprensivo d'imposta |
| Documento | Ricevuta o fattura elettronica al consumatore, emessa dalla piattaforma, con numerazione propria |
| Addebito ricorrente | Autenticazione forte al primo addebito, mandato per i successivi, gestione dei tentativi falliti con periodo di tolleranza e sospensione graduata |
| Rinnovo | Comunicazione prima del rinnovo, disdetta con lo stesso numero di clic della sottoscrizione |
| Cessazione | I diritti restano attivi fino alla fine del periodo pagato, poi decadono senza cancellare dati o biglietti |
| **Diritto di recesso** | **Si applica.** L'esclusione di quattordici giorni valida per i biglietti di eventi con data certa **non copre i servizi digitali in abbonamento**: serve la richiesta esplicita di esecuzione immediata con informativa sulla perdita del recesso, oppure va concesso il recesso. Da validare con il legale |
| Prezzi e comunicazione | Variazione di prezzo comunicata in anticipo, con facoltà di disdetta prima dell'applicazione |

L'ultima riga della tabella è quella che viene dimenticata più spesso: un abbonamento a
4,99 € ha obblighi informativi che un biglietto per una milonga non ha.

---

## 8. Quando lanciarlo

**Decisione: attivazione in fase 2, a data fissa**, indipendentemente dai numeri raggiunti. Il
Premium resta interamente progettato e presente nel modello dati con il suo interruttore già
dal primo rilascio.

La data fissa rinuncia alla garanzia che le soglie di massa critica sarebbero servita, e va
quindi compensata con misure di riempimento del bacino. La buona notizia è che **il prezzo
scelto lavora nella stessa direzione**: a 4,99 € all'anno la conversione è alta, quindi la
densità di profili si costruisce in fretta. Le due decisioni — data fissa e prezzo minimo — si
sostengono a vicenda; sarebbero state incompatibili con un prezzo mensile.

Restano tre condizioni da preparare **prima** della data di attivazione, altrimenti la funzione
apre vuota:

1. **Lancio per densità, non per copertura.** La ricerca partner va aperta prima sugli eventi e
   sulle città dove esiste massa — un festival con quattrocento iscritti, una scuola con
   duecento allievi — e solo dopo estesa a tutto il calendario. Una ricerca nazionale su un
   bacino sottile restituisce risultati vuoti; la stessa ricerca circoscritta a un evento reale
   funziona dal primo giorno.
2. **Bacino precostituito.** La bacheca cerco-partner per evento, gratuita già nel primo
   rilascio, è il primo mattone: alla data di attivazione la piattaforma deve già sapere chi
   cerca un partner, con quale ruolo e per quale evento. Va previsto un invito diretto a queste
   persone.
3. **Livello desunto già alimentato.** Richiede storico di partecipazioni, che si accumula solo
   con il tempo: se la data di attivazione cade prima che esistano mesi di dati reali, il
   matching si baserà sulla sola autodichiarazione. In quel caso è meglio **non presentare il
   livello come garanzia** ma come indicazione, e attivare l'attestazione da parte dei maestri,
   che non dipende dall'anzianità della piattaforma.

Va inoltre deciso se la data di attivazione coincide con l'inizio della fase 2 o cade più
avanti dentro di essa: la fase 2 contiene anche corsi e lezioni private, e la ricerca partner
non ha alcuna dipendenza da quelle.

---

## 9. Rischi propri del Premium

| # | Rischio | Impatto | Mitigazione |
|---|---|---|---|
| RP1 | **Attivazione a data fissa su una base ancora sottile**: la ricerca partner apre con pochi profili e non mantiene la promessa | Alto, e brucia la fiducia una volta sola | Lancio per densità e non per copertura, bacino precostituito dalla bacheca, invito diretto a chi cerca partner (§8). Il prezzo minimo aiuta: la conversione alta riempie il bacino in fretta |
| RP1b | **Il ricavo non copre il costo di presidio**: a ≈3,77 € netti per abbonato l'anno, la moderazione umana della ricerca partner costa più di quanto la funzione incassi ai volumi iniziali | Medio-alto sulla sostenibilità | Riconoscere il Premium come strumento di qualificazione e non come linea di ricavo (§2.2), dimensionare la moderazione sul volume reale di richieste, prevedere una revisione del prezzo dopo il primo anno di dati |
| RP2 | La ricerca partner diventa un canale di molestie, con effetti sulla reputazione dell'intera piattaforma | **Il più alto del prodotto** | Consenso reciproco, tutele gratuite, moderazione presidiata, codice di condotta, nessuna funzione di prossimità |
| RP3 | Il livello autodichiarato produce incontri mal assortiti e delusione | Medio-alto | Livello desunto e attestato, motivazione del confronto sempre visibile |
| RP4 | Gli organizzatori percepiscono l'accesso anticipato come una disposizione arbitraria del loro inventario | Alto sul rapporto con i clienti principali | Adesione volontaria, evento per evento, con beneficio misurato |
| RP5 | La community percepisce il prodotto come un'app di incontri travestita | Alto e difficilmente reversibile | Esclusioni deliberate del §4.1, linguaggio dei testi, nessuna funzione di scoperta casuale |
| RP6 | ~~`fee_ridotta` cannibalizza la linea di ricavo principale~~ | — | **Chiuso**: il diritto è escluso dal piano |
| RP7 | ~~Disdette stagionali estive concentrate~~ | — | **Chiuso**: il piano è solo annuale |
| RP7b | **Rinnovi annuali falliti**: con un solo addebito l'anno, una quota fisiologica di carte è scaduta al rinnovo | Medio sul tasso di rinnovo | Preavviso obbligatorio, tentativi ripetuti, recupero dello strumento di pagamento, periodo di tolleranza prima della decadenza dei diritti |
| RP7c | **Incidenza della commissione di pagamento del 6-8%** su un importo così piccolo, contro l'1-2% di un biglietto | Basso in valore assoluto, rilevante in percentuale | Verificare le condizioni per micropagamenti col prestatore scelto; nessun costo aggiuntivo da introdurre a carico dell'utente |
| RP8 | Doppia natura fiscale della piattaforma: intermediaria sui biglietti, venditrice diretta sugli abbonamenti | Medio | Separare i flussi contabili dall'inizio, non dopo |

---

## 10. Decisioni da prendere

### Chiuse

| # | Decisione | Esito |
|---|---|---|
| D1 | Struttura del prezzo | **Un solo piano, 4,99 € all'anno**, che sblocca tutti i diritti. Nessuna opzione mensile |
| D2 | Chat di evento gratuita o Premium | **Resta Premium**, con l'obbligo di dichiararlo prima dell'acquisto del biglietto |
| D4 | `fee_ridotta` nel piano | **No**, escluso |
| D5 | Momento di attivazione | **Fase 2, a data fissa**, con le tre condizioni preparatorie del §8 |
| D6 | Piano annuale | **Sì, ed è l'unica forma prevista** |

### Ancora aperte

| # | Decisione |
|---|---|
| D3 | Contropartita per l'organizzatore che aderisce all'accesso anticipato (proposta: nessuna, con beneficio misurato e mostrato) |
| D7 | La data di attivazione coincide con l'inizio della fase 2 o cade più avanti dentro di essa? La ricerca partner non ha dipendenze da corsi e lezioni private |
| D8 | Se alla data di attivazione lo storico di partecipazioni è ancora sottile, il livello viene presentato come indicazione anziché come garanzia e si punta sull'attestazione dei maestri: si accetta? |
| D9 | Revisione del prezzo dopo il primo anno di dati sulla conversione: si programma da subito nelle condizioni contrattuali? |
