# Mirada Tango — L'app del tanghero

**Data** 31 luglio 2026 · **Milestone di progetto, fase 2** · Allegato a `04-analisi-funzionale.md` §10

Cinque funzioni indicate dal committente come traguardo del prodotto: l'app che il ballerino
usa per sentirsi protagonista, e che lo rende promotore della piattaforma presso i propri
organizzatori.

**Collocazione confermata: fase 2.** Il primo taglio serve gli organizzatori clienti sulle
prenotazioni del prossimo evento (`13-primo-taglio.md`); il resto della fase 1 completa
biglietteria, chat e Live Wall; questa milestone viene dopo. Il documento serve a due cose:
fissare il traguardo perché non si perda, e **segnalare fin da ora le poche scelte di fase 1
che, se prese male, renderebbero costose queste funzioni.**

---

## 1. Quadro delle cinque funzioni

| # | Funzione | Che cosa esiste già | Che cosa è nuovo | Costo |
|---|---|---|---|---|
| **1** | Social Matcher per workshop | Bacheca cerco-partner (RF-PRT-1→6, fase 1) e ricerca partner avanzata (RF-PRM-8, fase 2) | **Stile di ballo** come attributo · ancoraggio al singolo workshop anziché all'evento | Basso: estende funzioni già progettate |
| **2** | Tanda & DJ Live Tracker | Nulla. Tanda e cortina esistono solo nel glossario | **Tutto**: è un sottosistema nuovo | **Il più alto dei cinque**, ma non per il software |
| **3** | Passaporto Tanghero Go | Apple/Google Wallet (RF-TCK-10, fase 2) · notifiche push (RF-COM-7, fase 3) | Push **geolocalizzata** all'arrivo in location · lo storico come oggetto curato | Medio |
| **4** | Mappa della community | Nulla: «chi partecipa» era stato escluso da «solo ticketing» | Provenienze dei partecipanti, in forma aggregata e in opt-in | Basso in sé, medio con lo scambio di contatti |
| **5** | Bacheca dei nomadi | Il posto letto in convenzione è un servizio accessorio di fase 1, cosa diversa | Passaggi in auto e alloggi condivisi tra pari | Basso a costruirlo, **non banale a inquadrarlo** |

Tre delle cinque estendono cose già progettate. La seconda è l'unica davvero nuova, ed è anche
quella con la resa emotiva più alta.

---

## 2. Social Matcher per workshop

### Che cosa aggiunge davvero

La bacheca di fase 1 è già questa funzione, in forma grezza: annuncio per evento, ruolo
proprio, ruolo cercato, livello, contatto interno. Tre aggiunte la trasformano.

**Lo stile di ballo.** È l'aggiunta migliore delle cinque, e non è ovvia: *milonguero*, *salon*,
*nuevo*, *fantasía* discriminano la compatibilità tra due persone **più del livello**. Due
avanzati di scuole diverse ballano peggio insieme di due intermedi dello stesso stile. Nessuna
bacheca esistente lo chiede, e il vocabolario è esattamente ciò che dà credibilità nella
community.

**L'ancoraggio al singolo workshop.** Oggi l'annuncio è per evento. Cercare un partner «per il
seminario di sabato alle 15 sulla milonga con traspié» è un'altra cosa: la domanda è precisa,
la risposta è verificabile, e l'abbinamento serve a due persone che dopo due ore si salutano.
È anche ciò che tiene la funzione lontana dall'appuntamento.

**La reciprocità dell'iscrizione.** Se due utenti si trovano tramite un annuncio, il passo
successivo è un'iscrizione a coppia su un unico ordine (RF-CPL-6). Chiudere quel cerchio —
dall'annuncio al biglietto in due — è ciò che distingue lo strumento da un gruppo Facebook.

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-13 | **Stile di ballo prediletto** nel profilo, a scelta multipla dal catalogo (milonguero, salon, nuevo, fantasía, altro), con la stessa natura di indicazione del livello dichiarato | 2 |
| RF-PRT-7 | L'annuncio può essere ancorato a **una o più sessioni specifiche** dell'evento, non al solo evento: il partner si cerca per quel workshop, non in generale | 2 |
| RF-PRT-8 | Filtri della bacheca estesi a **stile** e **sessione**, oltre a ruolo e livello | 2 |
| RF-PRT-9 | Dall'annoncio abbinato si passa direttamente all'**iscrizione a coppia** sulle sessioni concordate, con l'ordine unico già previsto da RF-CPL-6 | 2 |
| RF-PRT-10 | L'annuncio dichiara sempre **per che cosa** si cerca il partner: workshop, lezione privata, o partecipazione all'evento. Non esiste un annuncio senza finalità | 2 |

### Il nodo, che non è tecnico

Il committente lo chiama «il Tinder del Tango». Come descrizione interna è efficace e centra il
meccanismo; **come posizionamento pubblico sarebbe l'errore più costoso del progetto.** L'analisi
lo registra già come il rischio più alto del prodotto (R11) e come rischio difficilmente
reversibile (R12): nella community del tango le molestie in sala sono un tema discusso e
sensibile, e una piattaforma percepita come app di incontri travestita perde la fiducia una
volta sola.

La distanza tra le due cose non è nel codice, è in tre scelte già prese in `07` §4.1 e da
mantenere: **si cerca per una sessione, non una persona**; **nessun filtro di genere, età,
distanza o presenza online**; **nessuna scoperta casuale di profili**. Con quelle in piedi il
meccanismo resta lo stesso e il significato è opposto.

RF-PRT-10 è la traduzione operativa del principio: ogni annuncio dichiara la finalità, e non
esiste un annuncio generico.

---

## 3. Tanda & DJ Live Tracker

È la funzione con la resa più alta e l'unica veramente nuova. Coglie una cosa vera: il tanghero
è ossessionato dalle orchestre, e sapere che sta suonando Di Sarli del '44 con Rufino non è
un'informazione, è appartenenza.

| ID | Requisito | Pr. |
|---|---|---|
| RF-MUS-1 | **Anagrafica delle tande**: orchestra, cantante, anni, stile (tango, vals, milonga), brani. Riutilizzabile tra eventi e alimentata dal catalogo di piattaforma | 2 |
| RF-MUS-2 | Il DJ dispone di una **console essenziale**: la scaletta preparata in anticipo e un solo gesto per dichiarare l'inizio della tanda successiva. Nessuna digitazione durante la serata | 2 |
| RF-MUS-3 | La schermata dell'app mostra in tempo reale **tanda in corso** — orchestra, cantante, anno, stile — e **che cosa segue**, se il DJ ha reso pubblica la scaletta | 2 |
| RF-MUS-4 | Il ballerino può **salvare una tanda** nel proprio archivio personale, con orchestra, anno e serata in cui l'ha ballata. L'esportazione verso servizi di ascolto è **a tentativo migliore**, non una promessa | 2 |
| RF-MUS-5 | **Voto della serata** e voto per tanda, aggregati e restituiti al DJ e all'organizzatore a fine evento | 2 |
| RF-MUS-6 | Lo storico musicale confluisce nel passaporto: orchestre più ballate, DJ seguiti, andamento nel tempo | 2 |

### I due nodi da guardare in faccia

**Chi inserisce il dato.** Il DJ sta lavorando, al buio, e non digiterà mai. Le tre strade
possibili non si equivalgono:

| Strada | Valutazione |
|---|---|
| **Scaletta preparata più un tocco per avanzare** | **La sola praticabile.** Un tocco ogni dodici minuti circa, all'inizio della tanda. I DJ di tango preparano già le tande in anticipo: si chiede loro di caricare ciò che hanno già |
| Riconoscimento audio dal microfono | Da escludere. Il repertorio è fatto di incisioni anteriori al 1960 in rimasterizzazioni specifiche, mal coperte dai servizi di riconoscimento. Fallirebbe proprio sui brani che contano |
| Integrazione con il software del DJ | Frammentata su troppi programmi diversi. Eventualmente dopo, mai come strada principale |

**Il salvataggio su Spotify e Apple Music.** Va promesso con prudenza: le tande di tango
provengono spesso da edizioni rimasterizzate specifiche che sui servizi di ascolto non esistono,
o esistono in versioni diverse. Cercare «Di Sarli — Bahía Blanca» restituirà qualcosa, ma non
necessariamente l'incisione ballata. La forma onesta è **l'archivio personale dentro l'app** —
orchestra, anno, cantante, serata — con il collegamento allo streaming offerto quando esiste. Un
tanghero che si vede proporre la versione sbagliata se ne accorge, e la credibilità costruita
sul vocabolario si perde su un dettaglio come questo.

### La sinergia che rende la funzione più economica di quanto sembri

Il glossario di `04` §3 lo dice già senza averne tratto la conseguenza: **la cortina è il
momento naturale per la rotazione dei contenuti sulla wall.** Se il DJ segna l'inizio della
tanda, il sistema sa quando cade la cortina — e la Live Wall può sincronizzare la propria
rotazione sulla musica invece che su un timer cieco.

Un solo gesto del DJ serve quindi due funzioni: alimenta il tracker per i ballerini e dà il
ritmo alla wall. È anche il momento in cui le persone smettono di ballare e alzano gli occhi
sullo schermo: la proiezione dei contenuti in cortina è **il momento di massima attenzione della
serata**. Nessuna delle due funzioni, presa da sola, giustificherebbe da sé lo sforzo di far
partecipare il DJ; insieme sì.

> **Conseguenza per la fase 1**: la console della wall va costruita in modo che la rotazione
> possa ricevere un segnale esterno di avanzamento, oltre al proprio timer. È una previsione
> architetturale che costa poco ora e molto dopo.

---

## 4. Passaporto Tanghero Go

Due cose distinte sotto lo stesso nome, ed è bene tenerle separate perché hanno costi diversi.

**Il pass digitale.** Apple e Google Wallet erano già in fase 2 (RF-TCK-10). L'aggiunta è la
**notifica geolocalizzata all'arrivo**: «Benvenuto alla Milonga sul Molo, il tuo pass è pronto».
È un tocco di scenografia che costa poco e si nota molto — e ha un effetto pratico reale, perché
il pass compare senza che nessuno cerchi l'email di conferma nella coda all'ingresso.

**Il passaporto vero e proprio.** Lo storico personale: quante serate, in quante città, con
quali DJ e maestri, la progressione nel tempo. È la funzione più sottovalutata delle cinque, per
tre ragioni che si rinforzano a vicenda:

1. È **l'unica cosa che nessun concorrente può copiare**, perché richiede lo storico delle
   presenze — che solo la piattaforma possiede. `07` §3 lo aveva già identificato come
   fondamento del livello desunto.
2. È **condivisibile**: un tanghero che pubblica il proprio anno di tango è promozione che cita
   il prodotto, e costa zero.
3. Alimenta il livello desunto, che alimenta il Social Matcher. Le due funzioni si nutrono a
   vicenda.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAS-1 | **Pass digitale** in Apple Wallet e Google Wallet, con aggiornamento in tempo reale di orario, sala e stato del biglietto | 2 |
| RF-PAS-2 | **Notifica geolocalizzata all'arrivo in location**, con il pass pronto per la scansione. Attivabile dall'utente e disattivabile in ogni momento; nessuna posizione conservata dalla piattaforma | 2 |
| RF-PAS-3 | **Passaporto personale**: serate, città, eventi, maestri, DJ, orchestre ballate, andamento nel tempo, con presentazione curata e condivisibile come immagine | 2 |
| RF-PAS-4 | Il passaporto raccoglie anche le presenze a eventi **non venduti dalla piattaforma**, se il ballerino vi ha fatto check-in o le registra a mano: uno storico con dei buchi non è uno storico | 2 |
| RF-PAS-5 | Il passaporto è **privato per default**; la condivisione è un gesto esplicito e granulare | 2 |

RF-PAS-4 è la meno appariscente e la più importante: è la condizione perché il passaporto sia
credibile, ed è anche il punto in cui si vede che la presenza vale indipendentemente dalla
vendita.

---

## 5. Mappa della community

Riapre una funzione che era stata esclusa: «vedere chi partecipa prima dell'acquisto» era la
domanda 64 del questionario, indicata come *fortissima leva di conversione nel tango*, ed era
caduta con la scelta «solo ticketing, community bassa».

La forma proposta dal committente è però più intelligente della domanda originale: **non i
profili, ma le provenienze.** Vedere che nella stessa sala ci sono ballerini da Parigi, Buenos
Aires e Berlino produce quasi tutto l'effetto emotivo con una frazione del rischio, perché il
dato è aggregato e nessuno è esposto individualmente.

| ID | Requisito | Pr. |
|---|---|---|
| RF-CMU-1 | **Provenienze dei partecipanti** in forma aggregata — città, paese, numero — mostrate sulla scheda evento e nell'app durante l'evento. Nessun profilo individuale è esposto da questa vista | 2 |
| RF-CMU-2 | La comparsa nell'elenco nominativo dei partecipanti è **in adesione esplicita**, disattivata per default e revocabile in ogni momento | 2 |
| RF-CMU-3 | Lo scambio di contatti tra partecipanti segue le stesse tutele della ricerca partner: **accettazione reciproca**, nessun segnale di lettura o di rifiuto, blocco e segnalazione sempre gratuiti | 2 |
| RF-CMU-4 | Chi ha partecipato allo stesso evento può ritrovarsi negli eventi futuri, **se entrambi hanno aderito**: è il meccanismo che tiene insieme la community internazionale tra un festival e l'altro | 2 |

La linea da non superare è quella già fissata: il numero aggregato è di tutti, il nome è di chi
sceglie di mostrarlo, il contatto richiede il consenso di entrambi.

---

## 6. Bacheca dei nomadi

Passaggi in auto e alloggi condivisi. È una funzione a costo di sviluppo basso e valore
percepito alto, che risolve un problema reale: la community del tango viaggia, e oggi lo
organizza in gruppi Facebook e WhatsApp dispersivi.

Va distinta dalle due funzioni vicine che l'analisi già contiene, perché la confusione tra loro
ha già prodotto una contraddizione apparente una volta (`06` C2):

| Funzione | Che cos'è | Fase |
|---|---|---|
| **Posto letto** | Inventario in convenzione con una struttura, venduto come una cena | Fase 1 |
| **Bacheca dei nomadi** | Annunci tra pari: passaggi in auto, stanze da dividere | **Fase 2, questa** |
| **Gestione dell'ospitalità** | Abbinamento gestito tra chi offre un divano e chi cerca | Fase 3 |

| ID | Requisito | Pr. |
|---|---|---|
| RF-NOM-1 | Annunci legati a un evento di due tipi: **viaggio** (partenza, data, posti disponibili o cercati) e **alloggio condiviso** (zona, tipo di sistemazione, posti, periodo) | 2 |
| RF-NOM-2 | Contatto attraverso messaggistica interna, con le stesse tutele della bacheca cerco-partner: nessuna email esposta, segnalazione, blocco | 2 |
| RF-NOM-3 | Gli annunci si chiudono all'inizio dell'evento o su decisione dell'autore | 2 |
| RF-NOM-4 | La piattaforma è **bacheca e non intermediario**: non verifica i conducenti, non risponde delle sistemazioni, non gestisce denaro tra le parti. La condizione è dichiarata su ogni annuncio, non solo nelle condizioni di servizio | 2 |

RF-NOM-4 non è una formalità. Mettere in contatto sconosciuti che viaggeranno in auto insieme o
divideranno una stanza è un'attività con un'esposizione diversa da una bacheca cerco-partner, e
va inquadrata prima di pubblicarla, non dopo il primo problema. Il **nessun denaro tra le parti
dentro la piattaforma** è la scelta che tiene la funzione semplice: chi divide la benzina lo fa
tra sé, come oggi.

---

## 7. Direzione estetica

L'indicazione del committente — toni caldi e scuri, nero, oro, bordeaux, transizioni fluide,
niente aria da gestionale — è un requisito di prodotto e va trattata come tale. Due osservazioni
utili.

**È già metà specificata, e non per caso.** RF-WALL-31 prescrive per la wall un fondo molto
scuro e testo avorio anziché bianco pieno, per non abbagliare chi balla in sala. Non è una scelta
grafica ma funzionale, e l'app può ereditarla: il prodotto guadagna una coerenza reale — la
stessa palette in mano e sul maxischermo — senza inventare nulla.

**Il vincolo che va rispettato con disciplina.** L'accessibilità WCAG 2.1 AA è già un requisito
non funzionale. Su fondo nero, l'oro ha contrasto sufficiente per il testo; **il bordeaux no**,
o solo al limite. La regola operativa: bordeaux per superfici, bordi e accenti, oro e avorio per
il testo. È una limitazione che non toglie nulla all'eleganza — anzi, un bordeaux usato come
superficie e non come inchiostro è più elegante.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAS-6 | Sistema visivo unico tra app, scheda evento e wall: palette scura calda — nero, bordeaux come superficie, oro e avorio come testo — tipografia curata, transizioni in dissolvenza. Il rispetto di WCAG 2.1 AA è verificato sulla palette prima che sulle singole schermate | 2 |

---

## 8. Che cosa questa milestone cambia nelle decisioni prese

| Decisione | Effetto |
|---|---|
| «Solo ticketing, community bassa» | **Cade definitivamente.** Era già stata incrinata dal Premium (`07` P2); con mappa della community, nomadi e passaporto il prodotto ha una componente relazionale piena. Va dichiarato, non subito |
| Notifiche push in fase 3 (RF-COM-7) | **Anticipate alla fase 2**: la notifica geolocalizzata è parte del passaporto |
| Il livello di ballo come dato del profilo | Si arricchisce dello **stile**, che per l'abbinamento conta più del livello |
| Chat riservata al Premium (D2, RB11) | **Da riesaminare prima della fase 2.** Se il ballerino è il promotore, la funzione più condivisibile del prodotto — la propria foto sul maxischermo — è dietro il paywall meno redditizio (`07` §2.2: circa 3,77 € netti l'anno). La linea difendibile resta *presenza e visibilità gratis, iniziativa di contatto a pagamento* |
| Perimetro del primo rilascio | Nessun effetto: questa milestone è interamente fase 2 |

---

## 9. Le tre previsioni da fare in fase 1

Costano poco ora, molto dopo. Sono l'unica ragione per cui questo documento va scritto prima e
non al momento di realizzarlo.

1. **La rotazione della wall accetta un segnale esterno di avanzamento**, oltre al proprio timer.
   È ciò che permetterà al tracker delle tande di dare il ritmo alla proiezione senza riscrivere
   la console.
2. **Il check-in registra la presenza anche dove non c'è vendita.** Il passaporto e il livello
   desunto valgono in proporzione a quante presenze conoscono; se la presenza esiste solo dove
   c'è un biglietto venduto dalla piattaforma, lo storico nasce con i buchi (RF-PAS-4).
3. **Il profilo ha spazio per attributi di ballo estensibili** — livello, stile, e ciò che verrà.
   Aggiungere una colonna a un profilo con diecimila righe è un fastidio; averla prevista non
   costa niente.

---

## 10. Decisioni da prendere

| # | Decisione | Serve entro |
|---|---|---|
| D13 | **Nativa o web?** Notifica geolocalizzata, wallet e icona sul telefono implicano un'app nativa o quantomeno una PWA installabile con push. Cambia stima, competenze e distribuzione | Prima della pianificazione della fase 2 |
| D14 | **La chat di sala resta Premium?** Vedi §8. Raccomandazione dell'analista: renderla gratuita e tenere il Premium sull'iniziativa di contatto | Prima dell'attivazione del Premium |
| D15 | Il **catalogo degli stili** è chiuso e governato dal Super Admin, o estensibile dagli utenti? Raccomandazione: chiuso, altrimenti i filtri non funzionano | Alla progettazione del Matcher |
| D16 | Il tracker delle tande richiede la collaborazione del DJ: si prevede una **contropartita** — visibilità, statistiche della serata, profilo pubblico — o si conta sull'adesione spontanea? | Prima della fase 2 |
