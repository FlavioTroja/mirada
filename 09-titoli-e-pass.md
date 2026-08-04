# Mirada Tango — Titoli d'ingresso e pass

**Data** 31 luglio 2026 · Allegato a `04-analisi-funzionale.md` §6.3 · Chiude la sessione rinviata su RF-EVT-7 e RF-EVT-8, e la correzione provvisoria A4

---

## 1. Il problema

Un evento di tango non vende "il biglietto". Vende una combinazione di accessi che cambia
completamente da una tipologia all'altra, e che l'organizzatore compone da sé — coerentemente
con il principio che regge tutta l'analisi.

| Tipologia | Cosa vende in pratica |
|---|---|
| **Marathon / Encuentro** | Un **pass unico** per tutto l'evento, prezzo unico, quote per ruolo strette. Non si vende a serata: la selezione dei partecipanti è il prodotto |
| **Festival** | Pass completo, pass solo workshop, pass solo milonghe, ingresso alla singola serata, singolo seminario, talvolta lo spettacolo separato |
| **Stage / workshop** | Il singolo seminario, oppure un pacchetto di più seminari a prezzo ridotto, spesso con prezzo diverso per chi si iscrive in coppia |
| **Milonga** | Ingresso singolo, eventualmente ridotto per chi ha fatto la lezione che precede |

Il modello deve reggere tutti e quattro senza casi particolari nel codice. La chiave è che il
titolo non è una categoria: è **un insieme di sessioni più un prezzo più delle regole**.

---

## 2. Anatomia di un titolo d'ingresso

| Attributo | Significato |
|---|---|
| `nome`, `descrizione` | Ciò che il partecipante legge. "Full Pass", "Pass Milonghe", "Solo sabato" |
| `sessioni_incluse` | **Elenco esplicito** delle sessioni a cui dà accesso |
| `prezzo` | Con gli scaglioni del §4 |
| `unita_di_vendita` | `per_persona` oppure `per_coppia`: un titolo a coppia è un prezzo unico che vale due posti |
| `vincolo_ruolo` | Nessuno, oppure riservato a leader o a follower |
| `richiede_ruolo` | Se falso, il titolo non consuma quote di ruolo: è il caso dell'accompagnatore non ballerino e dello spettatore dello spettacolo |
| `finestra_di_vendita` | Da quando a quando è acquistabile, con l'eventuale apertura anticipata riservata al piano Premium |
| `visibilita` | Pubblico, oppure riservato e accessibile solo con un codice |
| `quantita_min_max` | Quanti se ne possono comprare in un solo ordine |
| `livello_indicato` | Il livello a cui il titolo si rivolge: **indicazione, non verifica** |
| `ordine_di_esposizione` | Come si presentano nella scheda evento, con l'eventuale evidenza sul titolo consigliato |

Le quote di capienza **non** sono un attributo del titolo: sono entità autonome che possono
riferirsi al titolo, come descritto in `05`. È ciò che consente di limitare 150 Full Pass e
contemporaneamente 30 posti nel workshop avanzato, senza che le due regole si intralcino.

---

## 3. Come si compone: l'elenco esplicito, con aiuti nella composizione

Il titolo conserva **un elenco esplicito** delle sessioni incluse, non una regola. Una regola —
«tutte le sessioni di tipo workshop» — sembra più elegante ma diventa insidiosa: se
l'organizzatore aggiunge un workshop a evento pubblicato, tutti i pass già venduti cambiano
silenziosamente contenuto, e chi ha comprato si trova un diritto diverso da quello acquistato.

La potenza sta quindi **nell'editor, non nel modello**: in fase di composizione l'organizzatore
dispone di selettori rapidi — *tutti i workshop*, *tutto il sabato*, *tutte le milonghe* — che
producono comunque un elenco esplicito e modificabile.

**Regola conseguente**: aggiungere una sessione a un evento pubblicato **non** la aggiunge
automaticamente ai titoli già venduti. Il sistema segnala la sessione orfana e chiede
all'organizzatore cosa farne, distinguendo i titoli non ancora venduti da quelli già acquistati.
Su questi ultimi l'aggiunta è possibile solo come miglioria — dare di più non lede nessuno —
mai come sottrazione.

---

## 4. Prezzi a scaglioni

**Gli scaglioni sono facoltativi.** Il comportamento predefinito di ogni titolo è il **prezzo
unico**, che non cambia mai da solo. Se l'organizzatore vuole farlo salire, definisce lui stesso
in fase di creazione **come e quando**: nessuna regola è imposta dalla piattaforma, e chi non
vuole occuparsene non incontra la funzione.

Quando l'organizzatore la attiva, dispone di queste forme:

| Tipo di scaglione | Come funziona | Uso tipico |
|---|---|---|
| **A data** | Fino al 31 gennaio 120 €, poi 140 €, dal 1 marzo 160 € | Early bird classico dei festival |
| **A quantità** | I primi 50 pass a 120 €, i successivi a 140 € | Spinge la decisione immediata, e riempie in fretta |
| **Combinato** | I primi 50 pass, e comunque non oltre il 31 gennaio | Il più usato in pratica: mette un tetto a entrambe le dimensioni |

Requisiti che ne discendono:

- Lo scaglione attivo e **quando o come scade** sono sempre visibili al partecipante: «120 € —
  restano 8 posti a questo prezzo» oppure «120 € fino al 31 gennaio». La scarsità dichiarata è
  onesta solo se è quella reale.
- Il prezzo si blocca **alla creazione dell'ordine**, non al pagamento: chi entra in checkout con
  l'early bird disponibile non se lo vede cambiare sotto durante i quindici minuti di
  prenotazione.
- Se lo scaglione a quantità si esaurisce mentre l'ordine è in corso, il prezzo bloccato resta
  valido fino alla scadenza della prenotazione. È il rovescio coerente della prenotazione
  temporanea.
- Il passaggio di scaglione è un evento tracciato, perché è la spiegazione dei picchi di vendita
  nel cruscotto.

---

## 5. Titoli venduti a coppia

Attributo `unita_di_vendita = per_coppia`: un prezzo, due posti, due iscrizioni con ruoli
complementari, un unico ordine. È la forma normale degli stage a coppie e di parte degli
encuentros.

Conseguenze già coperte dal resto dell'analisi: consuma un posto per ciascuna quota di ruolo,
supera sempre il cancello di tolleranza perché non altera lo sbilancio, e chi acquista inserisce
i dati del partner. Resta da fissare una sola regola nuova: il titolo a coppia **non è
acquistabile da solo**. Se una persona vuole partecipare senza partner, l'organizzatore deve
aver previsto anche un titolo per persona; altrimenti la bacheca cerco-partner è l'unica strada,
ed è bene che la scheda evento lo dica esplicitamente.

---

## 6. Sovrapposizioni tra titoli

Se un partecipante ha già il Full Pass e prova a comprare il singolo workshop del sabato, sta
pagando due volte lo stesso accesso.

**Proposta: avvisare, non bloccare.** Il sistema segnala la sovrapposizione con precisione — «il
workshop di sabato alle 15 è già incluso nel tuo Full Pass» — e lascia decidere. Bloccare
sarebbe presuntuoso: capita di comprare un secondo accesso per un amico, o di volerlo comunque.
Il doppio consumo della quota di sessione va però evitato, perché falserebbe i numeri: una
persona occupa un posto in una sessione, non due.

---

## 7. Titolo, iscrizione, biglietto e check-in

Qui si chiude la correzione provvisoria dell'audit A4.

```
Ordine ──► RigaOrdine ──► Biglietto ──┐
                                       ├──► Iscrizione  (una per persona per evento)
Ordine ──► RigaOrdine ──► Biglietto ──┘
                                       └──► CheckIn  (uno per sessione)
```

- Il **titolo** è il prodotto in vendita.
- Il **biglietto** è l'esemplare acquistato, nominale, trasferibile, con il suo QR.
- L'**iscrizione** è la persona nell'evento: ruolo di ballo, requisiti, consumi di capienza.
  Una sola per persona, anche con più biglietti.
- Il **check-in** è l'accesso a una singola sessione, e si registra sulla coppia
  biglietto-sessione.

Ne consegue, in via definitiva, che **l'utilizzo non è uno stato del biglietto**: un Full Pass
viene scansionato dodici volte in tre giorni e resta valido. Per gli eventi senza sessioni si usa
una sessione implicita, così il modello resta unico e il check-in di una milonga singola funziona
con lo stesso codice di quello di un festival.

Il QR è **uno solo per biglietto**, non uno per sessione: all'ingresso di ogni sessione
l'operatore scansiona lo stesso codice e il sistema determina se quella sessione è inclusa, se
è già stata usata e se il titolo è ancora valido. È anche l'unica soluzione praticabile in sala,
dove nessuno cerca il QR giusto tra dodici.

---

## 8. Catalogo di riferimento

Non è una configurazione obbligata, ma la base dei modelli precompilati che l'organizzatore
trova quando crea l'evento, così da non partire da un foglio bianco.

| Evento | Titoli proposti dal modello |
|---|---|
| **Marathon / Encuentro** | Pass unico per persona · Pass unico a coppia · Pass parziale per chi arriva il sabato |
| **Festival** | Full Pass · Pass Workshop · Pass Milonghe · Day Pass per ciascuna giornata · Ingresso singola milonga · Singolo workshop · Ingresso spettacolo senza ruolo |
| **Stage** | Singolo seminario per persona · Singolo seminario a coppia · Pacchetto di tutti i seminari con sconto |
| **Milonga** | Ingresso · Ingresso ridotto per chi frequenta il corso · Ingresso con lezione inclusa |

---

## 9. Fuori dal primo rilascio

| Funzione | Perché rinviarla |
|---|---|
| **Upgrade di titolo** (dal Pass Milonghe al Full Pass pagando la differenza) | È molto richiesta nei festival, ma tocca ordini già chiusi, documenti già emessi, quote di due titoli e rimborsi parziali. Merita di essere fatta bene, non in fretta |
| **Titolo a composizione libera** ("scegli 4 workshop tra 12") | Richiede un passaggio di scelta dentro il checkout, con le quote di sessione verificate su una selezione che l'utente sta ancora componendo. È la funzione più costosa dell'intero capitolo |
| **Titoli con prerequisito di livello verificato** | Il livello diventa un dato affidabile solo con lo storico, cioè con il Premium di fase 2. Fino ad allora il livello è un'indicazione e l'organizzatore rifiuta in sala, come fa oggi |
| **Abbonamento a ingressi multipli** (carnet) | Legato alle milonghe ricorrenti, che sono fuori dal segmento del primo rilascio dopo la decisione sul tesseramento |

---

## 10. Decisioni da prendere

Tutte chiuse.

| # | Decisione | Esito |
|---|---|---|
| T1 | Scaglioni di prezzo | **A data e a quantità, combinabili, e interamente facoltativi.** L'organizzatore definisce in fase di creazione come e quando il prezzo sale, se lo vuole; il default è prezzo unico che non cambia mai |
| T2 | Titolo a composizione libera nel primo rilascio | **No, fase 2**: è la funzione più costosa del capitolo |
| T3 | Upgrade di titolo nel primo rilascio | **No, fase 2** |
| T4 | Sovrapposizione tra titoli | **Avvisare senza bloccare**, ma senza doppio consumo delle quote di sessione |
| T5 | Titolo a coppia non acquistabile da solo | **Sì**, con avviso esplicito sulla scheda evento |
