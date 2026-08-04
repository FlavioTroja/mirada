# Mirada Tango — Allegato tecnico-funzionale: il motore di capienza

**Versione** 1.0 · **Data** 30 luglio 2026 · Allegato a `04-analisi-funzionale.md` §5.2

Questo allegato specifica il modello che governa la disponibilità dei posti. È il componente
più delicato del prodotto: sbaglia in silenzio, sbaglia sotto carico, e ogni errore si
traduce in una persona che ha pagato e non entra. Va implementato con test prima che con
codice.

---

## 1. Perché un'entità dedicata

Sullo stesso evento convivono vincoli di natura diversa e indipendente:

| Vincolo | Origine | Esempio |
|---|---|---|
| Capienza della sala | Sicurezza, obbligo di legge | 220 persone |
| Equilibrio dei ruoli | Qualità del ballo | 110 leader, 110 follower |
| Disponibilità commerciale | Scelta di prezzo | 150 full pass, 60 milonga pass |
| Capienza di una sala secondaria | Logistica | workshop avanzato: 25 coppie |
| Impegno con un fornitore | Contratto esterno | cena di gala: 90 coperti |

Un campo `capienza` sull'evento e un altro sul titolo coprono i primi tre casi male e gli
ultimi due per niente. Modellare la quota come **entità** rende ogni vincolo una riga di
configurazione, e rende identico il codice che serve una milonga da 120 posti e un encuentro
50+50 con tolleranza.

---

## 2. Schema dei dati

### 2.1 `QuotaCapienza`

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `evento_id` | riferimento | Ogni quota appartiene a un evento |
| `ambito` | enum | `EVENTO` · `SESSIONE` · `TITOLO` · `SERVIZIO` |
| `ambito_id` | riferimento nullo | Nullo quando `ambito = EVENTO` |
| `ruolo` | enum nullo | `LEADER` · `FOLLOWER` · nullo = quota totale, indifferente al ruolo |
| `limite` | intero ≥ 0 | Tetto assoluto |
| `consumato` | intero ≥ 0 | Contatore denormalizzato, aggiornato nella stessa transazione dei consumi |
| `limitante` | booleano | Se falso, la quota conta i posti ma **non blocca** la vendita. Default: vero |
| `riservata_a` | enum nullo | `ACCREDITO` per gli omaggi, `CANALE_ESTERNO` per la biglietteria dell'organizzatore e gli altri canali di vendita. Una quota riservata è sottratta alla vendita online e non compare nella disponibilità pubblica. Nullo = quota ordinaria |
| `tolleranza_sbilancio` | intero nullo | Valorizzato solo sulle quote di ruolo appaiate del medesimo ambito. Nullo = nessun cancello |
| `sforamento_ammesso` | intero ≥ 0 | Posti accettabili oltre il limite senza rifiutare l'ordine. Default 0. **Forzato a 0 e non modificabile sulla quota di capienza della sala** |
| `visibile_al_pubblico` | booleano | Se falso la disponibilità residua non viene esposta in scheda evento |

**Vincoli di integrità**

- Unicità della terna `(evento_id, ambito, ambito_id, ruolo)`: non esistono due quote per la stessa cosa.
- `consumato ≤ limite + sforamento_ammesso` sempre, in ogni istante, anche transitorio.
- `ambito_id` non nullo per ogni ambito diverso da `EVENTO`.
- `ruolo` valorizzabile solo su ambiti `EVENTO` e `SESSIONE`: le quote di titolo e di servizio sono per persona, indipendentemente da come balla.
- `tolleranza_sbilancio` coerente tra le due quote appaiate dello stesso ambito.

### 2.2 `ConsumoQuota`

Il registro di ciò che ogni iscrizione occupa. È l'elemento che rende il rilascio esatto
anziché ricostruito.

| Campo | Tipo | Note |
|---|---|---|
| `quota_id` | riferimento | |
| `iscrizione_id` | riferimento | |
| `quantita` | intero ≥ 1 | Normalmente 1 |
| `creato_il` | data e ora | |

Chiave unica su `(quota_id, iscrizione_id)`: è ciò che rende l'impegno **idempotente** anche
in caso di doppia notifica del PSP.

### 2.3 Campi rilevanti su `Iscrizione`

| Campo | Note |
|---|---|
| `ruolo_dichiarato` | Ciò che l'utente ha scelto: `LEADER`, `FOLLOWER`, `FLESSIBILE` |
| `ruolo_assegnato` | Il ruolo effettivo, risolto alla conferma del pagamento. Mai nullo su eventi con quote di ruolo |
| `canale` | `VENDITA_ONLINE` · `VENDITA_PORTA` · `ACCREDITO` |

Conservare entrambi i ruoli serve a due cose: spiegare all'utente perché è stato messo tra i
follower, e permettere all'organizzatore di riequilibrare i flessibili se lo sbilancio cambia.

---

## 3. Il flag `limitante`

Recepisce la prima decisione approvata. Nasce da un caso concreto: il Full Pass include 12
sessioni; se una sola è esaurita per un ruolo, il pass diventerebbe invendibile a metà del
pubblico.

| `limitante` | Comportamento | Quando usarlo |
|---|---|---|
| **vero** | La quota blocca l'acquisto quando è satura | Workshop con posti effettivi, cene, posti letto, capienza di sala |
| **falso** | La quota conta e mostra i numeri, ma non impedisce la vendita | Milonghe incluse in un pass, dove non esiste un posto assegnato e la sala assorbe |

Regola derivata: **la capienza dell'evento e le quote di ruolo dell'evento sono sempre
limitanti** e il flag non è modificabile su di esse. Sono vincoli fisici e di sicurezza, non
scelte commerciali.

Conseguenza operativa: quando un organizzatore include in un pass una sessione limitante e
satura, il sistema non nasconde il problema. Gli propone tre strade: aumentare la quota della
sessione, dichiararla non limitante, oppure mettere in vendita una variante di pass che non
la include.

---

## 4. Risoluzione delle quote applicabili

```
funzione quote_applicabili(iscrizione, titolo, servizi_scelti, ruolo) → insieme di quote

  Q ← insieme vuoto

  # 1. Livello evento: sempre
  Q ← Q ∪ quota(EVENTO, null, ruolo: null)          # capienza della sala
  Q ← Q ∪ quota(EVENTO, null, ruolo: ruolo)         # equilibrio dei ruoli

  # 2. Livello titolo: solo se la vendita è commerciale
  se iscrizione.canale ≠ ACCREDITO
      Q ← Q ∪ quota(TITOLO, titolo.id, ruolo: null)
  altrimenti
      Q ← Q ∪ quota_accrediti(EVENTO)               # quota riservata agli omaggi

  # 3. Livello sessione: una per ogni sessione inclusa nel titolo
  per ogni sessione in titolo.sessioni_incluse
      Q ← Q ∪ quota(SESSIONE, sessione.id, ruolo: null)
      Q ← Q ∪ quota(SESSIONE, sessione.id, ruolo: ruolo)

  # 4. Livello servizio: uno per ogni accessorio acquistato
  per ogni servizio in servizi_scelti
      Q ← Q ∪ quota(SERVIZIO, servizio.id, ruolo: null)

  ritorna Q privo dei riferimenti nulli    # le quote non configurate semplicemente non esistono
```

**Assenza di quota significa assenza di vincolo.** Un evento senza alcuna quota configurata
vende senza limite; la capienza della location, se presente in anagrafica, viene proposta
come valore di default alla creazione, non imposta.

**Gli accrediti** consumano la capienza della sala e le quote di ruolo — un ospite non pagante
occupa comunque spazio in pista — ma non le quote di titolo, che sono inventario commerciale.
Se l'organizzatore vuole 110 leader paganti più 5 accrediti leader, configura la quota leader
a 115: è configurazione, non un caso particolare del codice.

---

## 5. Verifica e impegno

```
funzione impegna(iscrizioni_ordine) → esito

  # A. Risoluzione, con assegnazione dei ruoli flessibili
  per ogni i in iscrizioni_ordine
      se i.ruolo_dichiarato = FLESSIBILE
          i.ruolo_assegnato ← risolvi_flessibile(evento, iscrizioni_ordine)
      altrimenti
          i.ruolo_assegnato ← i.ruolo_dichiarato
      i.quote ← quote_applicabili(i, ...)

  # B. Aggregazione: quante unità serve su ciascuna quota per l'intero ordine
  richiesta ← mappa quota → somma delle quantità richieste

  # C. Cancello di tolleranza, valutato sull'ordine intero
  se non supera_cancello_tolleranza(evento, iscrizioni_ordine)
      ritorna RIFIUTO(motivo: RUOLO_IN_ATTESA, ruolo: ..., ...)

  # D. Impegno atomico
  transazione
      per ogni quota in richiesta, ordinate per quota.id crescente     # evita i deadlock
          se non quota.limitante
              registra_consumo(quota, iscrizione, quantita)            # conta, non blocca
              continua
          righe ← AGGIORNA quota
                  IMPOSTA consumato = consumato + :quantita
                  DOVE id = :quota.id E consumato + :quantita <= limite
          se righe = 0
              annulla transazione
              ritorna RIFIUTO(motivo: ESAURITO, quota: quota)
          registra_consumo(quota, iscrizione, quantita)                # unicità → idempotenza
  fine transazione

  ritorna ACCETTATO
```

Note di implementazione che non sono dettagli:

- L'ordinamento per identificativo crescente è l'unica difesa contro i deadlock quando due
  ordini toccano lo stesso insieme di quote in ordine diverso.
- L'aggiornamento **condizionato** (`DOVE ... consumato + quantita <= limite`) è ciò che rende
  la verifica e l'impegno una sola operazione. Leggere prima e scrivere dopo è la modalità
  con cui si vendono posti inesistenti.
- L'unicità su `ConsumoQuota` rende l'operazione ripetibile: se il PSP notifica due volte lo
  stesso incasso, il secondo tentativo non muove i contatori.
- L'impegno avviene **all'avvio dell'ordine** e prende la forma di una **prenotazione
  temporanea a tempo**, sul modello dei ticketing generalisti: l'utente dispone di una finestra
  per inserire i dati e pagare. Si rilascia alla scadenza, al fallimento del pagamento o
  all'abbandono esplicito. La prenotazione è **riarmata all'avvio del pagamento**, per coprire
  il tempo di reindirizzamento verso i prestatori che portano l'utente fuori
  dall'applicazione. Conseguenza da monitorare: nelle finestre di apertura vendite gli ordini
  abbandonati sottraggono posti fino alla scadenza.

**Nota sulla differenza rispetto a un ticketing per spettacoli.** TicketOne blocca *quel*
posto, identificato sulla mappa della sala: deve gestire un lock su una risorsa singola e
nominata. Qui i posti non sono numerati, quindi la prenotazione è un semplice **impegno di
quantità sul contatore**, con lo stesso aggiornamento condizionato già descritto. È la ragione
per cui questa funzione, che in un ticketing generalista è una delle più delicate, qui costa
poco: cambia solo il momento in cui l'impegno scatta e si aggiunge la scadenza.

### 5.1 Tolleranza di sforamento

Decisione del committente: **uno sforamento di pochi posti sulle quote commerciali è accettato
e non genera rimborsi automatici.** È una situazione gestibile in sala, e la scelta semplifica
sensibilmente il sistema: cade la necessità del percorso di rimborso automatico per vendita
oltre capienza.

L'aggiornamento condizionato del passaggio D diventa quindi:

```
DOVE id = :quota.id E consumato + :quantita <= limite + quota.sforamento_ammesso
```

con `sforamento_ammesso` configurabile per quota e pari a zero per default.

**La capienza della sala.** Sulla **vendita online** la quota di capienza della sala non ammette
sforamento: `sforamento_ammesso` è forzato a zero e non modificabile. Non è un limite
commerciale ma un vincolo di sicurezza, e la piattaforma non deve vendere di propria iniziativa
oltre quel numero. Sull'**emissione manuale** da parte dell'organizzatore, invece, il
superamento è possibile e produce un avviso ben visibile ma nessun blocco: la responsabilità
della sala è sua, ed è lui a sapere se quel numero corrisponde ancora alla realtà.

Per le quote di servizi accessori vincolate a un fornitore esterno, dove lo sforamento significa
una persona senza cena o senza letto, il default resta zero ma l'organizzatore può alzarlo
consapevolmente.

### 5.2 I tre canali che alimentano i contatori

| Canale | Bloccato dalle quote? | Come entra nei contatori |
|---|---|---|
| **Vendita online** | **Sì**, con la tolleranza di sforamento | Impegno atomico, come descritto sopra |
| **Emissione manuale di pass** dell'organizzatore | **No, mai** | Registrata all'emissione, con titolo, causale e ruolo di ballo |
| **Vendite su canali esterni** | **No**, e la gestione è facoltativa per evento | Registrazione manuale delle quantità, se l'organizzatore ha scelto di gestirle |

È la distinzione che tiene insieme due esigenze opposte: la piattaforma deve impedire di
vendere ciò che non c'è, e non deve impedire all'organizzatore di fare ciò che ritiene sul
proprio evento. **I contatori sono vincolanti verso il pubblico e informativi verso
l'organizzatore.**

---

## 6. Il cancello di tolleranza

La tolleranza **non estende il limite**: restringe dinamicamente l'accesso al ruolo
sovrarappresentato. Traduce l'intenzione reale dell'organizzatore di marathon, che non è
"massimo 60 leader" ma "non voglio ritrovarmi con venti leader in più dei follower".

```
funzione supera_cancello_tolleranza(evento, iscrizioni_ordine) → booleano

  t ← tolleranza_sbilancio dell'ambito EVENTO
  se t è nullo → ritorna vero                       # nessun cancello configurato

  L ← consumato(quota EVENTO, LEADER)   + leader richiesti nell'ordine
  F ← consumato(quota EVENTO, FOLLOWER) + follower richiesti nell'ordine

  ritorna |L − F| ≤ t
```

La valutazione è **sull'ordine intero**, non riga per riga: è ciò che consente a una coppia di
passare anche quando il singolo verrebbe fermato.

Esempio con limiti 60/60 e tolleranza 5:

| Stato attuale | Un leader singolo | Un follower singolo | Una coppia |
|---|---|---|---|
| 40 L, 38 F | ammesso (sbilancio 3) | ammesso | ammessa |
| 40 L, 35 F | **rifiutato**: sbilancio già a 5 | ammesso | ammessa |
| 58 L, 58 F | ammesso | ammesso | ammessa |
| 60 L, 55 F | rifiutato: **limite assoluto** | ammesso | rifiutata: limite leader saturo |

**Proprietà notevole**: una coppia aggiunge un'unità per parte, lo sbilancio resta invariato,
quindi supera sempre il cancello. È esattamente il comportamento degli encuentros reali, che
aprono prima le iscrizioni a coppie e poi, se resta spazio, quelle singole. Il modello lo
riproduce senza codice dedicato.

**I due rifiuti vanno distinti nell'interfaccia**, perché hanno significati opposti:

| Motivo | Significato | Messaggio proposto |
|---|---|---|
| `ESAURITO` | Limite assoluto raggiunto, situazione definitiva | «Posti follower esauriti» |
| `RUOLO_IN_ATTESA` | Blocco temporaneo per sbilancio, può sbloccarsi | «Iscrizioni leader momentaneamente sospese, in attesa di follower. Puoi iscriverti subito in coppia, oppure cercare un partner nella bacheca» |

Il secondo messaggio è anche il miglior richiamo alla bacheca cerco-partner e all'iscrizione a
coppia: il vincolo diventa un suggerimento utile invece di un muro.

---

## 7. Il ruolo flessibile

```
funzione risolvi_flessibile(evento, iscrizioni_ordine) → ruolo

  se le quote di ruolo non esistono → ritorna null

  residuo_L ← limite(LEADER) − consumato(LEADER)
  residuo_F ← limite(FOLLOWER) − consumato(FOLLOWER)

  se residuo_L ≠ residuo_F      → ritorna il ruolo con residuo maggiore
  se consumato_L ≠ consumato_F  → ritorna il ruolo con consumato minore
  ritorna LEADER                                  # convenzione, per determinismo nei test
```

L'assegnazione avviene **alla conferma del pagamento**, non nel carrello, perché lo stato può
cambiare nel frattempo. L'utente viene informato del ruolo che gli è stato assegnato nella
conferma d'ordine e sul biglietto.

L'organizzatore può riassegnare manualmente un flessibile da un ruolo all'altro: l'operazione
rilascia i consumi del vecchio ruolo e ne impegna quelli del nuovo, con le stesse verifiche di
un acquisto.

---

## 8. Rilascio

Ogni operazione che libera un posto passa dallo stesso meccanismo: si leggono i `ConsumoQuota`
dell'iscrizione, si decrementano esattamente quei contatori, si cancellano le righe.

| Operazione | Effetto sui consumi |
|---|---|
| Rimborso di un'iscrizione | Rilascio integrale, servizi accessori compresi |
| Rimborso di un solo componente della coppia | Rilascio dei soli consumi di quell'iscrizione; l'altra resta intatta |
| Annullamento dell'evento | Rilascio di tutto; i contatori tornano a zero |
| Trasferimento del biglietto, stesso ruolo | Nessun movimento: cambia il titolare dell'iscrizione, non l'occupazione |
| Trasferimento con ruolo diverso | Rilascio del vecchio ruolo e impegno del nuovo, **nella stessa transazione**: se il nuovo ruolo è saturo il trasferimento è rifiutato e nulla cambia |
| Pagamento fallito o scaduto | Rilascio dell'impegno tecnico |
| Scioglimento della coppia senza rinuncia | Nessun movimento: le persone restano, cambia solo il legame |

La regola implicita ma essenziale: **il rilascio non è mai un decremento "a occhio"**. Si
rilascia ciò che risulta impegnato, riga per riga. È l'unico modo per non accumulare deriva
tra contatori e realtà su un evento che vive mesi tra vendite, rimborsi e trasferimenti.

---

## 9. Modifica dei limiti da parte dell'organizzatore

| Operazione | Regola |
|---|---|
| Aumento del limite | Sempre consentito |
| Riduzione a un valore ≥ `consumato` | Consentita |
| Riduzione a un valore < `consumato` | **Ammessa**, con avviso. La disponibilità online va a zero e la vendita si chiude; nessun biglietto già emesso viene invalidato e nessuno viene espulso |
| Spostamento di posti tra i ruoli | È una coppia di modifiche di limite, valutata con le stesse regole |
| Modifica della tolleranza | Sempre consentita; non produce effetti retroattivi sugli iscritti già ammessi |
| Passaggio di una quota da non limitante a limitante con `consumato > limite` | Rifiutato, con la stessa proposta di chiusura |
| Eliminazione di una quota con `consumato > 0` | Rifiutata: si può solo chiudere |

Nessuna modifica di configurazione può espellere qualcuno che è già dentro. È l'invariante che
protegge la fiducia dei partecipanti e va imposta a livello di dati, non di interfaccia.

---

## 10. Interazioni con il resto del sistema

| Ambito | Comportamento |
|---|---|
| **Vendita alla porta** | Attinge esattamente agli stessi contatori della vendita online. La cassa può quindi trovarsi davanti un esaurito in tempo reale, e riceve lo stesso messaggio dell'utente |
| **Accrediti e omaggi** | Consumano la quota riservata, la capienza della sala e le quote di ruolo; non consumano le quote di titolo |
| **Check-in** | **Non consuma quota.** Le quote governano l'ammissione, il contatore presenze di RF-CHK-13 governa la sicurezza. Sono due assi distinti e confonderli produce numeri incoerenti |
| **Indicatore di scarsità** | Calcolato su `limite − consumato` della quota più stretta tra quelle applicabili al ruolo dell'utente, ed esposto solo se `visibile_al_pubblico` |
| **Cruscotto organizzatore** | Lo sbilancio corrente si legge direttamente dai due contatori di ruolo: non serve alcun calcolo aggregato |
| **Assenza di liste d'attesa** | Coerente con il modello: quando `consumato = limite` non esiste alcuna coda da promuovere |
| **Canali esterni** | La piattaforma affianca la biglietteria dell'organizzatore. Le vendite fuori piattaforma consumano il **contingente riservato** (`riservata_a = CANALE_ESTERNO`) tramite registrazione manuale delle quantità, e consumano comunque la capienza della sala. Senza questo meccanismo i contatori descrivono solo metà della realtà, e la disponibilità mostrata al pubblico è sistematicamente sovrastimata |

---

## 11. Disponibilità parziale in checkout

Recepisce la seconda decisione approvata: **non si fa fallire un'iscrizione da 90 euro per una
cena da 25.**

```
alla richiesta di pagamento:
  verifica preliminare (senza impegno) di tutte le quote applicabili

  se sono sature soltanto quote di ambito SERVIZIO:
      → non rifiutare l'ordine
      → segnalare le righe indisponibili con il motivo
      → proporre la rimozione di quelle righe e il ricalcolo del totale
      → richiedere una conferma esplicita dell'utente
      → procedere con l'ordine ridotto

  se è satura una quota di ambito EVENTO, TITOLO o SESSIONE limitante:
      → rifiutare l'ordine con l'indicazione precisa di cosa manca
      → nel caso della sessione, nominare la sessione e il ruolo
```

La conferma esplicita è obbligatoria: un ordine che si riduce da solo dopo il pagamento è un
addebito non corrispondente a ciò che l'utente ha visto.

Messaggi proposti:

| Caso | Messaggio |
|---|---|
| Servizio esaurito | «La cena di gala è appena andata esaurita. Puoi completare l'iscrizione senza la cena: il totale scende a €90. Confermi?» |
| Sessione limitante satura | «Il workshop avanzato di domenica è completo per il ruolo follower, e fa parte del Full Pass. Puoi acquistare il Milonga Pass oppure iscriverti come leader se balli entrambi i ruoli» |
| Titolo esaurito | «Il Full Pass è esaurito. Sono ancora disponibili: Milonga Pass, ingresso singolo di sabato» |

---

## 12. Invarianti da verificare in continuo

| # | Invariante |
|---|---|
| I1 | La **quota parte di consumo proveniente dalla vendita online** non supera mai `limite + sforamento_ammesso`, e non supera mai `limite` sulla capienza della sala. Il consumo totale, che comprende emissioni manuali e canali esterni, può eccedere: è informativo e sotto la responsabilità dell'organizzatore |
| I2 | `consumato` coincide con la somma delle `quantita` dei `ConsumoQuota` collegati |
| I3 | Ogni iscrizione attiva ha un consumo su tutte le quote a lei applicabili, e su nessun'altra |
| I4 | Nessuna iscrizione attiva senza `ruolo_assegnato` su eventi con quote di ruolo |
| I5 | Su eventi con tolleranza configurata, `|L − F| ≤ tolleranza` — con la sola eccezione documentata delle riallocazioni manuali di limite decise dall'organizzatore |
| I6 | Nessun `ConsumoQuota` collegato a iscrizioni rimborsate o annullate |
| I7 | La somma dei consumi sulle quote di ruolo dell'evento non supera il consumo della quota totale dell'evento |

Le invarianti I2 e I7 sono le candidate naturali a un controllo periodico automatico con
allarme: una divergenza è il primo sintomo di una condizione di corsa sfuggita ai test.

---

## 13. Casistica di test

| # | Scenario | Esito atteso |
|---|---|---|
| T1 | Milonga senza quote di ruolo, 119 su 120, acquisto di 1 posto | Ammesso, contatore a 120 |
| T2 | Stessa milonga a 120 su 120 | Rifiutato, motivo `ESAURITO` |
| T3 | Un residuo, ordine da 2 posti | Rifiutato interamente: nessun consumo parziale |
| T4 | 110/110 tolleranza 5, stato 40 L e 35 F, un leader singolo | Rifiutato, motivo `RUOLO_IN_ATTESA` |
| T5 | Stesso stato, un follower singolo | Ammesso |
| T6 | Stesso stato, una coppia | Ammessa: lo sbilancio non cambia |
| T7 | Limite leader 60, stato 60 L e 55 F, un leader | Rifiutato con motivo `ESAURITO`, non `RUOLO_IN_ATTESA` |
| T8 | Ruolo flessibile con 40 L e 35 F | Assegnato follower |
| T9 | Ruolo flessibile con quote e consumi identici | Assegnato leader per convenzione, in modo deterministico |
| T10 | Full Pass con sessione **limitante** satura per il ruolo | Rifiutato, con nome della sessione e del ruolo nel messaggio |
| T11 | Full Pass con sessione **non limitante** satura | Ammesso; il contatore della sessione supera il limite ed è segnalato al cruscotto |
| T12 | Cena esaurita, titolo disponibile | Ordine non rifiutato: segnalazione, proposta di rimozione, conferma, ordine ridotto |
| T13 | Rimborso di un'iscrizione con pass, 4 sessioni e cena | Sei contatori decrementati esattamente, righe di consumo cancellate |
| T14 | Trasferimento a titolare con ruolo diverso, nuovo ruolo saturo | Rifiutato, nessun contatore modificato |
| T15 | Trasferimento a titolare con lo stesso ruolo | Contatori invariati, titolare aggiornato |
| T16 | Riduzione del limite leader da 110 a 100 con 105 consumati | Rifiutata, con proposta di chiusura a 105 |
| T17 | Due pagamenti concorrenti sull'ultimo posto | Un solo impegno riesce; l'altro è rifiutato all'avvio del pagamento, prima di qualunque addebito |
| T17b | Quota commerciale al limite con `sforamento_ammesso = 2`, due acquisti successivi | Entrambi ammessi, contatore a `limite + 2`; il terzo è rifiutato |
| T17c | Quota di capienza della sala al limite, `sforamento_ammesso` forzato a 0 | Rifiutato, e il campo non è modificabile dall'organizzatore |
| T17d | Ordine avviato e mai completato | Capienza rilasciata alla scadenza della prenotazione, posto di nuovo acquistabile |
| T17e | Prenotazione scaduta mentre l'utente è sulla pagina del prestatore di pagamento | Il riarmo all'avvio del pagamento deve averlo impedito; se accade comunque e il pagamento riesce, si applica la tolleranza di sforamento o, oltre quella, il rimborso integrale |
| T17f | Stesso utente che avvia due ordini in parallelo sullo stesso evento | Il secondo è rifiutato: una sola prenotazione attiva per utente e per evento |
| T17g | Processo di recupero delle prenotazioni scadute non rilasciate | I contatori tornano coerenti con l'invariante I2 senza intervento manuale |
| T18 | Doppia notifica del PSP sullo stesso ordine | Contatori invariati al secondo tentativo |
| T19 | Accredito staff su evento con quote di ruolo | Consuma quota accrediti, capienza sala e quota di ruolo; non consuma la quota di titolo |
| T20 | Vendita alla porta a evento esaurito online | Rifiutata, con lo stesso messaggio mostrato al pubblico |
| T21 | Scioglimento di una coppia su evento che ammette iscrizioni individuali | Nessun movimento sui contatori |
| T22 | Evento senza alcuna quota configurata | Vendita senza limiti, nessun errore |
| T23 | Cinquanta acquisti simultanei su dieci posti residui | Esattamente dieci ammessi, quaranta rifiutati, nessun contatore oltre il limite |

Il caso T23 è quello da automatizzare come test di carico: la finestra di apertura delle
vendite di un evento atteso è precisamente questo scenario.
