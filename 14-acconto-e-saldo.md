# Mirada Tango — Acconto e saldo

**Data** 24 agosto 2026 · Estende la fase E (canali di vendita esterni) · **Non riapre** la
decisione «acconti aboliti» di `01`: la circoscrive e ne dichiara il confine

---

## 1. Il problema

International Trani Tango vende su Shopify con un codice sconto chiamato `ACCONTO_30`: il
ballerino paga il 30% del pacchetto adesso, e salda il restante 70% al botteghino il giorno del
check-in, quasi sempre in contanti. È una pratica che funziona da anni e che l'organizzatore
non intende abbandonare.

Mirada ingerisce quella vendita e non sa nulla di tutto questo. Registra un incasso di €46,50 su
un pacchetto da €155, emette il biglietto, lo consegna per email. Al botteghino nessuno sa che
ci sono €108,50 da incassare, e l'unica difesa è che qualcuno tenga un foglio a parte — cioè
esattamente la cosa che la piattaforma esiste per eliminare.

Questo documento chiude il buco, e lo chiude in una forma che regge anche l'acconto sulla
**vendita interna** il giorno in cui esisterà.

### 1.1 Perché non contraddice «acconti aboliti»

`01-decisioni-prese.md`, secondo giro: «Acconti: **aboliti**, si paga l'intero importo in fase di
acquisto». Quella decisione riguarda **il checkout di Mirada** e resta intatta: qui non si
costruisce un pagamento rateale, non ci sono solleciti, non ci sono ordini parzialmente pagati.

Ciò che si costruisce è il **riconoscimento di un acconto incassato altrove** e la gestione del
debito che ne consegue. La distinzione va tenuta stretta, perché è ciò che impedisce a questa
funzione di diventare, per accumulo, il pagamento rateale che era stato escluso:

> **Mirada non concede l'acconto. Lo registra.**

Con una avvertenza dichiarata: il modello è disegnato perché il giorno in cui la vendita interna
vorrà l'acconto (fase D2, con Stripe) **non ci sia nulla da rifare a valle**. Cambia chi genera
il residuo, non che cosa il residuo è.

---

## 2. Ciò che Shopify vede non è ciò che sta succedendo

È il fatto da cui discende tutto il resto, e sfugge alla prima lettura.

Con un codice sconto, per Shopify quell'ordine **non è parzialmente pagato: è pagato per
intero, a un prezzo ridotto**. `financial_status` vale `paid`, `total_price` vale €46,50, e da
nessuna parte esiste un residuo. L'unica traccia del fatto che sia un acconto è **il nome del
codice**.

Tre conseguenze, tutte vincolanti:

1. `financial_status`, `partially_paid`, i pagamenti parziali di Shopify: **non servono a
   niente**. Non è quella la strada.
2. Il segnale è il **nome del codice**, quindi è **configurazione** — non una deduzione dai
   numeri, che sarebbe indovinare.
3. Il residuo è un fatto **che esiste solo dentro Mirada**. Nessuna riconciliazione con il
   negozio potrà mai confermarlo, perché il negozio non sa di averlo generato.

---

## 3. Il riconoscimento

### 3.1 I codici sono configurazione del canale — `RF-SAL-1`

Esistono già varianti e ne esisteranno altre: `ACCONTO_50`, codici per edizione, codici per
pacchetto. Un `if (code === "ACCONTO_30")` sarebbe una modifica al software a ogni edizione, e
un giorno la modifica non verrebbe fatta.

I codici di acconto sono quindi **righe di configurazione del canale di vendita**, accanto alle
mappature dei prodotti che già esistono. Ogni riga porta il codice, un'etichetta leggibile e
nulla più.

> **La percentuale non serve al calcolo.** Il codice **marca** la vendita come acconto; a dire
> quanto manca è l'importo scontato, che Shopify ci consegna esatto (§4). Il `30` nel nome è
> un'etichetta per gli umani, e va trattato come tale — il giorno in cui l'organizzatore
> cambierà la percentuale del codice senza rinominarlo, un calcolo fondato sul nome
> sbaglierebbe in silenzio.

### 3.2 Il confronto è normalizzato — `RF-SAL-2`

Spazi rimossi, tutto a maiuscolo, da entrambe le parti. `ACCONTO_30`, ` acconto_30 ` e
`Acconto_30` sono **lo stesso codice**.

Non è pigrizia. Il difetto che si evita è muto: un codice applicato a mano dal back-office del
negozio con una capitalizzazione diversa **non verrebbe riconosciuto come acconto**. Nessun
errore, nessuna quarantena, nessun segnale — la vendita entra come se fosse a prezzo pieno, il
residuo non nasce, e al botteghino nessuno chiede quei €108,50. Se ne accorge il commercialista
a settembre, ammesso che se ne accorga.

La normalizzazione non toglie nulla: `ACCONTO_30` e `ACCONTO_50` restano distinti.

### 3.3 Un codice sconosciuto è uno sconto, non un errore

Un ordine con un codice che non è configurato come acconto è una **vendita scontata normale**:
early bird, coupon, promozione. Nessun residuo, nessuna quarantena. Mandare in quarantena ogni
sconto significherebbe mandarci mezza campagna vendite, e la quarantena smetterebbe di voler
dire «qualcosa non va» — che è l'unica cosa che deve voler dire.

---

## 4. Il calcolo del residuo

### 4.1 La regola — `RF-SAL-3`

> **Il residuo è ciò che il codice di acconto ha scontato, e nient'altro** — sulle sole righe
> mappate a un titolo d'ingresso.

Non `total_discounts`, non una percentuale del prezzo di listino: la quota attribuita **a quel
codice** e a nessun altro.

### 4.2 Perché non `total_discounts`

Finché l'acconto è l'unico sconto dell'ordine le due formule danno lo stesso numero, ed è per
questo che la differenza non si vede. Divergono appena se ne aggiunge un secondo — pacchetto da
€155, early bird −10%, poi `ACCONTO_30`:

| formula | paga ora | residuo | **totale che avrà pagato** |
|---|---|---|---|
| residuo = `total_discounts` | €41,85 | €113,15 | **€155,00** — l'early bird è evaporato |
| residuo = 70% del prezzo di listino | €41,85 | €108,50 | **€150,35** — un totale che non esiste |
| **residuo = quota del solo codice acconto** | €41,85 | **€97,65** | **€139,50** — l'early bird è onorato |

La prima si riprende di nascosto uno sconto promesso, e il ballerino se ne accorge alla porta —
cioè nel posto peggiore. La seconda non chiude i conti con nessun prezzo.

### 4.3 Il dato c'è, esatto, e non va stimato

Shopify consegna l'attribuzione precisa e non serve alcuna aritmetica inversa:

- `discount_applications[]` elenca gli sconti applicati, ciascuno con il proprio `code`;
- ogni riga d'ordine porta `discount_allocations[]`, e ogni allocazione dice **quanto** quello
  sconto ha tolto **da quella riga**, indicando con `discount_application_index` **quale**
  sconto è stato.

Il residuo di una riga è quindi la somma delle sue allocazioni il cui indice punta a un codice
di acconto configurato. Al centesimo, con la conversione a centesimi interi che l'adapter già
fa cifra per cifra.

Questo risolve anche il fatto che il codice sia applicato **all'intero carrello**: le
allocazioni sono comunque per riga, e il residuo per riga è un dato, non una ripartizione
inventata.

### 4.4 La merce resta fuori — `RF-SAL-4`

Se il carrello contiene un pacchetto e una maglietta, una fetta dell'acconto è scontata **sulla
maglietta**. Quella fetta **non è residuo**: nessuno chiede alla porta il saldo di una maglietta
già consegnata.

La regola è quindi: il residuo si calcola **sulle sole righe mappate a un titolo d'ingresso**.
La quota caduta sulle altre righe si registra sulla vendita e si **segnala** nel back-office —
quasi sempre significa che il codice di acconto, nel negozio, non è limitato ai soli pacchetti,
ed è una cosa che l'organizzatore vuole sapere.

**Si segnala, non si mette in quarantena**: la vendita è legittima e incassata, e la regola
della fase E vale anche qui — una vendita già incassata non si rifiuta.

### 4.5 La ripartizione fra i posti — `RF-SAL-5`

Una riga può valere più posti (`quantity`, e `seatsPerUnit` per i pacchetti coppia). Il residuo
della riga si divide per il numero di posti, in centesimi interi, **e il resto va ai primi
posti, un centesimo per volta**:

> €108,50 su 3 posti → **36,17 · 36,17 · 36,16**

**L'invariante è che la somma delle quote sia esattamente il residuo della riga.** Non
arrotondamenti «di cortesia» a cifra tonda: un centesimo perso per posto, su ottocento posti,
sono otto euro che non tornano e una serata a cercarli.

### 4.6 Il modello canonico cambia forma — `RF-SAL-6`

Oggi `CanonicalSale` non conosce gli sconti: l'adapter li butta via. Devono entrare, e la forma
giusta li mette **sulla riga**:

```
CanonicalSaleLine.discounts: [{ code: string, amount: number }]   // centesimi, per riga
```

**L'adapter non sa quali codici siano acconti, e non deve saperlo.** Riporta tutti gli sconti
con il loro nome; è il servizio di ingestione — l'unico che conosce la configurazione del
canale — a decidere quali contino. È la stessa ragione per cui la porta esiste: il giorno di
WooCommerce, i coupon hanno un nome e un importo per riga esattamente come qui, e si scrive un
adapter, non un percorso.

Conseguenza da non dimenticare: `ExternalSale.canonicalPayload` cambia forma. Le quarantene
create **prima** di questa funzione non porteranno gli sconti, e la loro rielaborazione dovrà
ricalcolare dal corpo grezzo, che è conservato su `ExternalSaleEvent.payload`. È il motivo per
cui quel corpo grezzo esiste.

---

## 5. Dove vive il residuo

Sta in **due posti**, che rispondono a due domande diverse, ed è la ragione per cui non sono lo
stesso posto.

| dove | che cosa registra | a che domanda risponde |
|---|---|---|
| **`Registration`** | la quota di residuo **di quella persona** e quanto ne è stato saldato | «questo che si presenta alla porta, quanto deve?» |
| **`ExternalSale`** | prezzo di listino, acconto incassato dal negozio, residuo totale, quota caduta sulla merce | «questo ordine torna con Shopify?» |

### 5.1 Il canonico è su `Registration` — `RF-SAL-7`

Tre ragioni, in ordine di importanza:

1. **Al botteghino si presentano persone, non ordini.** L'unità operativa è l'iscrizione.
2. **Regge l'acconto interno di domani.** Un residuo appeso a `ExternalSale` andrebbe rifatto da
   capo quando a generarlo sarà un `Order` con Stripe. Appeso all'iscrizione vale per entrambi i
   mondi, e a valle — check-in, cassa, email, cruscotto — non cambia una riga.
3. **Sopravvive alla rielaborazione della vendita**, che è un'operazione prevista e normale.

### 5.2 Quanto è stato saldato è un campo calcolato dal server

`Registration` porta **quanto è nato** (immutabile) e **quanto è stato saldato**; il residuo
aperto è la differenza. Il secondo campo si muove **solo** attraverso il servizio che registra
gli incassi, mai da un DTO di scrittura — esattamente come `CapacityQuota.consumed`, e per la
stessa ragione: un contatore che si può scrivere dall'esterno è un contatore che prima o poi
racconterà una cosa diversa dalle righe che lo compongono.

### 5.3 Nessuna riga `Payment`

Confermato e vincolante. Il denaro dell'acconto non è mai passato da Mirada, e nemmeno quello
del saldo: scrivere `Payment` significherebbe mettere una bugia nel registro degli incassi
della piattaforma e rompere il significato di `Payment.idempotencyKey`. È la stessa scelta già
presa per la fase E, e vale identica qui.

---

## 6. L'incasso del saldo

### 6.1 Ogni incasso è una riga — `RF-SAL-8`

Registrare l'incasso non è opzionale: senza le righe, la chiusura di cassa e i totali
all'organizzatore non hanno da dove uscire, e «chi ha in tasca cosa» a fine serata è
un'opinione.

Ogni riga porta: iscrizione, **importo**, **metodo**, **operatore**, **momento della
riscossione**, postazione, se è arrivata dalla coda offline, e l'eventuale conflitto.

Metodi previsti: **contanti**, POS, Satispay, bonifico, altro. Il metodo è una spunta, non un
prestatore di pagamento: Mirada non incassa nulla, prende nota.

### 6.2 Si registra, non si contabilizza — `RB26`

> **Il saldo incassato al botteghino è un fatto, non un incasso della piattaforma.**

Sta nel registro dei saldi, non fra i `Payment`, non nei rendiconti degli incassi Mirada. Gli
adempimenti fiscali su quel contante — ricevuta, corrispettivi — restano **dell'organizzatore**,
come già oggi per l'incasso su Shopify. Mirada gli dà il registro; non gli fa da cassiere.

### 6.3 Chi può incassare, e chi può vedere quanto — `RF-SAL-9`

Un permesso nuovo per capacità, coerente con la matrice granulare di `02`:

| capacità | chi ce l'ha |
|---|---|
| **vedere l'importo** del residuo | chi tiene la cassa |
| **registrare un incasso** | chi tiene la cassa |
| **vedere che un residuo esiste** | anche l'operatore di check-in |

### 6.4 Si salda anche prima dell'evento — `RF-SAL-10`

Dal back-office, sulla scheda dell'iscrizione: stessa riga, metodo «bonifico», nessuna
postazione. Un bonifico arrivato a maggio deve poter chiudere il residuo, altrimenti la persona
si sente chiedere alla porta soldi che ha già mandato — ed è la lamentela che l'organizzatore
paga più cara.

### 6.5 Offline, e il doppio incasso — `RF-SAL-11`

L'incasso funziona offline, come il check-in. Il che significa che due postazioni scollegate
possono incassare **due volte** lo stesso residuo senza saperlo.

Si tratta esattamente come il doppio ingresso già trattato in `RF-CHK-6`: la seconda riga
**viene creata, marcata come conflitto e lasciata allo staff**. Mai scartata in silenzio — sono
soldi che qualcuno ha realmente preso in mano, e cancellarli perché il server preferisce il
primo arrivato significherebbe far quadrare i conti sul telefono e non nella cassa.

Ogni riga porta un riferimento generato dal dispositivo, unico per postazione: la stessa riga
sincronizzata due volte è una sola riga.

---

## 7. Alla porta

### 7.1 L'esito resta `VALID` — `RB25`

> **Un residuo non blocca mai l'ingresso.**

I cinque esiti della verifica non diventano sei. Il biglietto è valido: la vendita è avvenuta,
il denaro si è mosso, e Mirada non fa il buttafuori per conto dell'organizzatore. È la stessa
regola di `RB20` — si registra, si avvisa, si procede.

L'operatore fa entrare comunque anche se la persona non paga o discute la cifra: il residuo
resta aperto e la questione si risolve fra umani, che è dove va risolta.

### 7.2 L'operatore vede che c'è, non quanto — `RB27`

> **Chi non tiene la cassa vede che un saldo esiste, mai quanto vale.**

La schermata del volontario mostra un avviso ben visibile — *«saldo da versare, manda alla
cassa»* — e nessun importo. L'importo compare solo a chi ha il permesso di lettura, cioè a chi
lo deve incassare.

È una scelta consapevole con un costo organizzativo dichiarato: **due postazioni**, l'ingresso e
la cassa. Chi arriva con un residuo aperto fa un passaggio in più. In cambio, la cifra che una
persona deve non passa sotto gli occhi di ogni volontario di turno.

### 7.3 L'avviso segue il residuo, non la sessione — `RF-SAL-12`

Il saldo si chiede al primo ingresso, ma l'avviso **non** è un fatto del primo ingresso: compare
a **ogni** scansione finché il residuo è aperto, e sparisce nel momento in cui è saldato.

Legarlo alla prima sessione avrebbe un effetto perverso: chi non viene intercettato la prima
sera — perché c'era coda, perché la cassa era chiusa, perché il volontario ha lasciato correre —
non verrebbe più intercettato mai.

### 7.4 Il manifesto offline

L'elenco che il dispositivo scarica prima di perdere la rete deve portare **anche** lo stato del
residuo. Il flag per tutti; l'importo **solo** per i dispositivi il cui operatore ha il permesso
di leggerlo: un manifesto che porta le cifre a tutti aggira in un colpo solo la regola del §7.2,
e lo fa in un file che resta sul telefono.

---

## 8. Chi lo vede, e dove

| dove | che cosa | requisito |
|---|---|---|
| **Email dei biglietti** | «Acconto versato €46,50 — **saldo €108,50 da versare al check-in**». Oggi quell'email mostra come totale la sola cifra incassata dal negozio, e quindi mente per omissione | `RF-SAL-13` |
| **PDF del biglietto** | la stessa riga. L'email si perde; il PDF è ciò che la persona ha in mano alla porta | `RF-SAL-13` |
| **Scheda dell'iscrizione** (back-office) | residuo, quanto è stato saldato, l'elenco degli incassi con operatore e momento, il tasto per registrarne uno | `RF-SAL-14` |
| **Area personale** (`www`, quando ci sarà) | il proprio residuo, con la stessa formulazione dell'email | `RF-SAL-15` |
| **Cruscotto dell'evento** | atteso al botteghino · già incassato · ancora aperto | `RF-SAL-16` |
| **Esportazione** | l'elenco di chi deve cosa, per la serata | `RF-SAL-16` |
| **Segnale in tempo reale** | `balance/settled` ai membri dell'organizzazione, nella stessa forma di `external-sale/ingested` | `RF-SAL-17` |

---

## 9. I casi limite, e cosa si fa

| caso | regola |
|---|---|
| Codice di acconto su un ordine **senza righe biglietto** | nessun residuo. La vendita si registra come già oggi, e la cosa si segnala |
| **Rimborso o annullamento** presso il negozio | il residuo si chiude insieme alla vendita. Se un saldo era **già stato incassato**, la riga resta nel registro e la restituzione avviene fuori piattaforma: si segnala, non si inventa un rimborso che Mirada non può eseguire |
| Il negozio incassa **il 70% su Shopify** | **non supportato, e dichiarato tale.** Il residuo si chiude a mano dal back-office |
| **Rielaborazione di una quarantena** | il residuo si ricalcola dal canonico. Per le quarantene anteriori a questa funzione, dal corpo grezzo |
| **Passata di riconciliazione** | stessa strada dell'ingestione, nessuna eccezione: un ordine recuperato dalla riconciliazione genera il suo residuo come se fosse arrivato dal webhook |
| **Storico già ingerito** | ricalcolo facoltativo dal corpo grezzo. Non urgente: le vendite dell'edizione in corso non sono ancora aperte |
| **Chi non si presenta** | il residuo resta aperto e **non si sollecita**. Non è un credito da riscuotere: è una condizione dell'ingresso |
| **Biglietto trasferito** ad altra persona | il residuo resta sull'iscrizione: **il debito è del posto, non del nome** |
| **Un ordine da più posti** | tante quote quante le iscrizioni. La cassa può saldarne più d'una in un gesto solo — restano righe distinte, perché distinti sono i posti |

---

## 10. Che cosa cambia, in breve

| dove | cambiamento |
|---|---|
| `SalesChannel` | elenco dei **codici di acconto** configurati |
| Modello canonico | gli sconti entrano sulla **riga**, con il loro nome |
| `ExternalSale` | listino, acconto incassato, residuo totale, quota caduta fuori dai biglietti |
| `Registration` | residuo della persona · quanto ne è stato saldato (calcolato dal server) |
| **nuovo** | il registro dei **saldi incassati** |
| Permessi | una capacità nuova: tenere la cassa |
| Verifica alla porta | un avviso in più — con la cifra solo per chi la deve incassare |
| Manifesto offline | lo stato del residuo, e l'importo solo dove è lecito |
| Email e PDF | la riga dell'acconto e del saldo |
| Cruscotto, esportazioni, WebSocket | i tre numeri e il segnale di incasso |

---

## 11. Regole di business nuove

| # | Regola |
|---|---|
| **RB25** | **Un residuo non blocca mai l'ingresso.** Si avvisa e si procede, come per l'eccedenza di capienza dei canali esterni |
| **RB26** | **Il saldo incassato al botteghino si registra, non si contabilizza.** Non è un incasso della piattaforma e non produce una riga di pagamento |
| **RB27** | **Chi non tiene la cassa vede che un saldo esiste, mai quanto vale** — nella schermata e nel manifesto offline |
| **RB28** | **La somma delle quote per posto è esattamente il residuo della vendita.** Nessun centesimo si crea, nessuno si perde |

---

## 12. Fuori da questo taglio

| funzione | perché rinviarla |
|---|---|
| **Solleciti e scadenze del saldo** | il saldo si versa alla porta: un sollecito presuppone una scadenza, e la scadenza presuppone che il biglietto decada — cioè una politica che oggi non esiste |
| **Chiusura di cassa per operatore e per turno** | le righe ci sono tutte fin da subito, quindi si può costruire quando serve senza migrare nulla |
| **Ricevuta fiscale al botteghino** | è un adempimento dell'organizzatore. Va deciso con `10-briefing-verifica-fiscale.md` alla mano, non qui |
| **Acconto sulla vendita interna** | è la fase D2 con Stripe: lì l'acconto è un pagamento parziale vero, non uno sconto camuffato. Tutto ciò che sta a valle del residuo — cassa, porta, email, cruscotto — è già pronto per riceverlo |
| **Restituzione di un saldo incassato** | oggi Trani non rimborsa. Quando servirà, dipende dalla ricevuta di cui sopra |

---

## 13. Decisioni prese

Tutte chiuse.

| # | Decisione | Esito |
|---|---|---|
| S1 | Come si riconosce un acconto | **Dal nome del codice sconto**, configurato sul canale. Confronto normalizzato |
| S2 | Come si calcola il residuo | **Quota del solo codice di acconto**, sulle sole righe biglietto. Mai `total_discounts`, mai una percentuale del listino |
| S3 | Che fine fa lo sconto caduto sulla merce | **Fuori dal residuo**, registrato e segnalato |
| S4 | Arrotondamenti | **Centesimo esatto**, resto ai primi posti, somma invariante |
| S5 | Dove vive il residuo | **Sull'iscrizione** il canonico, **sulla vendita** la riconciliazione |
| S6 | Riga di pagamento | **No.** Registro dei saldi sì, `Payment` no |
| S7 | Blocco alla porta | **No.** Avviso, e l'operatore fa entrare comunque |
| S8 | L'operatore volontario vede la cifra | **No.** Vede che un saldo esiste; l'importo è di chi tiene la cassa |
| S9 | Incasso offline | **Sì**, con il doppio incasso trattato come il doppio ingresso: riga creata, conflitto segnalato, lo risolve lo staff |
| S10 | Saldo anticipato dal back-office | **Sì**, ed è obbligatorio |
| S11 | Il 70% incassato su Shopify | **Non supportato**, e dichiarato |
| S12 | Solleciti e scadenze | **No.** Si salda alla porta |
| S13 | Prospettiva | Il modello regge l'**acconto interno** della fase D2 senza rifacimenti a valle |
