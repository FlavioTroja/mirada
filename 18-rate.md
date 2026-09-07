# Mirada Tango — Il pagamento a rate

**Data** 7 settembre 2026 · Richiesta del committente · Estende `14-acconto-e-saldo.md` ·
**Non riapre** «acconti aboliti» di `01`: la decisione riguarda il checkout, e il checkout non
si tocca

---

## 1. Il problema, e quanto ne è già risolto

Chi frequenta un corso trimestrale, e chi va a un festival da trecento euro, chiede di pagare
in più volte. È la richiesta.

Metà è già in esercizio, e vale la pena dirlo prima di progettare il resto:

| | stato |
|---|---|
| Un'iscrizione può portare un **importo dovuto** | ✅ `Registration.balanceDueAmount` |
| Si può versare in **più volte** | ✅ `BalanceSettlement`, una riga per versamento |
| Ogni versamento porta data, importo, metodo, operatore | ✅ |
| Vale anche sui **festival** | ✅ `enrol()` non guarda la famiglia dell'evento |
| Il residuo si chiude da solo | ✅ `dovuto − versato` |

Ciò che manca non è la capacità di incassare a rate: è **sapere quando le rate erano attese**.
Oggi il residuo è aperto e basta, e alla domanda «chi è indietro?» non risponde nessuno.

### 1.1 Perché non riapre «acconti aboliti»

`01-decisioni-prese.md`: «Acconti: **aboliti**, si paga l'intero importo in fase di acquisto.
Nessun saldo, nessun sollecito, nessun ordine parzialmente pagato.»

Quella decisione riguarda **il checkout di Mirada**, e resta intatta: chi compra online paga
tutto, come oggi. Qui si costruisce il piano delle rate per le iscrizioni **registrate dalla
segreteria** — la stessa distinzione che `14` §1.1 aveva già tracciato per l'acconto sul negozio.

> **Mirada non concede la rateizzazione. Registra il piano che la scuola ha concordato.**

## 2. Le tre decisioni del committente

| # | Domanda | Risposta |
|---|---|---|
| R1 | Chi incassa le rate | **Solo la segreteria** — contante, bonifico, POS. Nessun addebito online |
| R2 | Le rate hanno scadenze | **Sì, un piano deciso alla vendita**: «tre rate da 60 €, il 1° di ottobre, novembre e dicembre» |
| R3 | Chi salta una rata cosa perde | **Niente in automatico.** Il sistema mostra chi è indietro; decide l'organizzatore |

R3 è la risposta che rende il resto realizzabile. `14` §12 aveva rinviato i solleciti con la
ragione giusta — *«un sollecito presuppone una scadenza, e la scadenza presuppone che il
biglietto decada, cioè una politica che oggi non esiste»* — e la politica continua a non
esistere. Mostrare senza agire non ne ha bisogno.

---

## 3. La forma: il piano è una previsione, i versamenti sono i fatti

È la decisione strutturale, e discende da R3.

Una rata **non ha uno stato «pagata»**. Il piano dice *quanto sarebbe dovuto essere versato entro
una certa data*; le righe di `BalanceSettlement` dicono *quanto è stato versato davvero*. Chi è
in ritardo si ottiene confrontando i due, non leggendo una spunta.

```
in ritardo  =  somma delle rate già scadute  −  totale versato   (se positivo)
```

### 3.1 Perché non una spunta «pagata» su ogni rata — `RB34`

Perché sarebbe un terzo posto in cui vive la stessa verità, e prima o poi direbbe una cosa
diversa dagli altri due. È lo stesso ragionamento che in questo progetto ha già prodotto tre
decisioni identiche:

- `09` §7 — l'utilizzo di un biglietto **non è uno stato**: è una riga di `CheckIn`;
- `14` §5.2 — `balanceSettledAmount` **è la somma delle righe**, e si muove solo attraverso il
  servizio che le scrive;
- `05` — `CapacityQuota.consumed` idem, con `QuotaConsumption` a fare da registro.

Una spunta su una rata inviterebbe inoltre a una domanda senza risposta: se un allievo versa 50 €
su una rata da 60, quella rata è pagata? Con il confronto la domanda non si pone — mancano dieci
euro alla data di quella rata, e questo è tutto ciò che serve sapere.

### 3.2 La somma delle rate è il dovuto — `RB35`

Un piano le cui rate non sommano a `balanceDueAmount` è un piano che mente: o promette meno di
quanto è dovuto, o pretende più del prezzo. Il servizio lo rifiuta.

⚠️ Ne discende che il piano si scrive **dopo** che il dovuto esiste, e va riscritto se il dovuto
cambia. Non è un vincolo del database — `Registration` non conosce le sue rate — ma del servizio,
perché è lì che le due grandezze si vedono insieme.

### 3.3 Un versamento non «paga una rata»

Non c'è chiave esterna fra `BalanceSettlement` e la rata. Chi versa versa denaro, e il denaro
copre il piano nell'ordine delle scadenze. Legarli significherebbe chiedere all'operatore, con i
soldi in mano, **a quale rata** attribuire i 50 € che sta ricevendo — una domanda che non ha
una risposta giusta e che rallenta uno sportello.

---

## 4. Che cosa cambia

| dove | cambiamento |
|---|---|
| **nuovo** | `PaymentInstalment` — importo e scadenza, una riga per rata |
| Sotto-risorsa | `PATCH /registrations/:id/instalments` con **l'array intero**, come le sessioni di un titolo (regola 12 di `controllers.md`) |
| `RegistrationBalance` | le rate, quanto è **scaduto e non coperto**, e la prossima scadenza |
| Scheda dell'iscrizione | il piano accanto al residuo, con la riga in ritardo evidenziata |
| Elenco iscritti | un filtro «in ritardo con le rate» |
| `BalanceSettlement` | **nessun cambiamento**: incassare resta ciò che era |

---

## 5. Fuori da questo taglio

| funzione | perché |
|---|---|
| **Rate online con la carta** | R1. Serve Stripe con addebiti differiti, e riaprirebbe `01` |
| **Solleciti automatici** | R3: il sistema mostra, non agisce. Un sollecito è una comunicazione, e va deciso chi la firma |
| **Decadenza dell'iscrizione** | R3, e dipende da `Refund`, che `13` dichiara non costruita: chi decade ha già versato, e quei soldi vanno restituiti |
| **Blocco alla porta di chi è indietro** | `RB25` — un residuo **non blocca mai** l'ingresso. Resta vero anche con le rate |
| **Interessi, more, sconti per pagamento anticipato** | Nessuno li ha chiesti, e ognuno è una politica commerciale, non una funzione |

---

## 6. Regole di business nuove

| # | Regola |
|---|---|
| **RB34** | **Una rata non ha uno stato «pagata».** Il piano è una previsione, i versamenti sono i fatti, e il ritardo è il confronto fra i due |
| **RB35** | **La somma delle rate è esattamente il dovuto dell'iscrizione.** Un piano che non torna viene rifiutato, non corretto in silenzio |
