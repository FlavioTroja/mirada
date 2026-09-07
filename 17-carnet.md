# Mirada Tango — Il carnet di ingressi

**Data** 7 settembre 2026 · Riapre `06` §B8, chiuso per conseguenza dalla decisione sul
tesseramento · **Non contraddice `09` §7**: la lettura corrente di quell'invariante è più
stretta del suo testo

---

## 1. Il problema

«Dieci serate da usare quando vuoi». `06` §B8 lo chiama, testualmente, *«la forma di vendita
più diffusa dopo il biglietto singolo, e la principale leva di fidelizzazione delle scuole»*.

Oggi non esiste, e il documento che lo dichiarava mancante ne spiegava anche la ragione: *«un
titolo è legato a un evento e a sessioni specifiche»*. Fu chiuso «per conseguenza» quando il
tesseramento uscì dallo scopo e con lui le milonghe ricorrenti. Ora che le scuole rientrano
dalla porta dei corsi, rientra anche il carnet.

---

## 2. Ciò che il carnet **non** contraddice

Questa sezione esiste perché la stima di `06` §B8 — e la mia, tre giorni fa — davano il carnet
per **il più costoso** dei capitoli aperti, sul presupposto che contraddicesse un invariante
fondativo. Leggendo il testo di quell'invariante, il presupposto non regge.

### 2.1 «L'utilizzo non è uno stato del biglietto» resta vero

`09` §7 dice, in via definitiva:

> **L'utilizzo non è uno stato del biglietto**: un Full Pass viene scansionato dodici volte in
> tre giorni e resta valido. […] il check-in è registrato sulla **coppia biglietto–sessione**.

Vieta uno **stato** `USED`. Non vieta un **conteggio**.

E il conteggio c'è già: le righe di `CheckIn` **sono** il registro degli utilizzi, una per
coppia biglietto–sessione, con l'annullamento (`revokedAt`) che le fa uscire dall'indice
parziale. Il residuo di un carnet è quindi

```
residuo  =  ingressi acquistati  −  check-in attivi di quel biglietto
```

cioè una **lettura di righe che il sistema scrive già**, non una colonna di stato nuova.

### 2.2 Ne discende che `USED` non serve, e non va aggiunto

Il carnet non ha bisogno di diventare `USED` a residuo zero: a residuo zero **non passa**, e la
ragione la calcola la verifica alla porta. Il biglietto resta `VALID` finché non è annullato o
rimborsato, esattamente come ogni altro.

> Il carnet non è un titolo che si consuma. È un titolo che **conta quante volte è stato usato**,
> e quel conteggio il sistema lo tiene già.

Vale la stessa disciplina di `CapacityQuota.consumed` e di `Registration.balanceSettledAmount`:
la verità sono le righe, il contatore è una comodità che si muove **solo** attraverso il servizio
che scrive le righe. Se si vorrà un contatore denormalizzato per la verifica offline (§4.3), è
quello il modello da seguire — non un nuovo stato.

---

## 3. Ciò che il carnet contraddice **davvero**

Non un invariante: **tre colonne obbligatorie**.

| # | dove | perché è un ostacolo |
|---|---|---|
| **1** | `TicketType.eventId Int` | Un carnet non è un titolo *di un evento*: è un titolo **dell'organizzazione**, speso su molti eventi |
| **2** | `Ticket.eventId Int` | Idem sull'esemplare venduto: oggi ogni biglietto nasce dentro un evento |
| **3** | `TicketTypeSession`, elenco **esplicito** | `09` §3: *«niente regole, niente inferenze. Se non c'è, non è compresa.»* Un carnet non può elencare le sessioni: quando lo si vende, le milonghe di marzo non esistono ancora |

Il terzo è il più interessante, perché la regola che lo blocca è **giusta** e non va indebolita.
L'elenco esplicito esiste per non far dipendere l'ingresso da un'inferenza. La via d'uscita non è
rendere l'elenco implicito: è **girare la direzione della dichiarazione** (§4.2).

---

## 4. La forma proposta

### 4.1 Il carnet è un titolo dell'organizzazione — `RF-CAR-1`

`TicketType.eventId` diventa nullabile, e un `eventId` nullo significa *titolo di catalogo
dell'organizzazione*. Serve allora una colonna `organizationId` sul titolo, oggi implicita
attraverso l'evento.

⚠️ È lo stesso schema di `Venue` e `Artist`, che già portano `organizationId` nullabile per le
righe di piattaforma — e la cui derivazione è appena stata corretta (`OrganizationScopeService
.resolveOwner`). Il carnet non inventa una forma nuova: usa quella che il modello ha già.

### 4.2 Dove vale: lo dichiara l'evento, non il carnet — `RF-CAR-2`

Il carnet non elenca le sessioni. È la **sessione** ad accettare i carnet.

```
Session.acceptsPasses  Boolean @default(false)
```

La direzione conta. Un carnet che elencasse le sessioni andrebbe aggiornato ogni volta che nasce
una milonga — e chi vende il carnet a settembre non conosce il calendario di marzo. Una sessione
che dichiara «qui i carnet valgono» si compila **quando la sessione si crea**, cioè quando la
decisione è davanti a chi la prende.

E l'invariante di `09` §3 resta intatto: l'ammissione continua a dipendere da una
**dichiarazione esplicita**, non da un'inferenza. Cambia solo chi la scrive.

### 4.3 Il residuo si calcola, il contatore si denormalizza — `RF-CAR-3`

`Ticket.entriesPurchased Int?` — nullo su ogni biglietto che non è un carnet, che sono tutti
quelli di oggi.

Il residuo è `entriesPurchased − count(check-in attivi)`. Per la verifica **offline** — che
`13` §3 dichiara non tagliabile — serve però un numero nel manifesto scaricato: un dispositivo
senza rete non può contare righe che non ha. Il contatore denormalizzato va allora previsto, con
la disciplina del §2.2: mosso solo dal servizio di check-in, mai da un DTO.

⚠️ **Due postazioni scollegate possono spendere lo stesso ultimo ingresso.** È lo stesso problema
del doppio incasso di `14` §6.5 e del doppio ingresso di `RF-CHK-6`, e merita la stessa risposta:
la riga **si crea**, si marca in conflitto, e la si lascia allo staff. Un carnet a −1 è un fatto
spiacevole; una persona respinta alla porta da un contatore che il suo telefono non poteva
aggiornare è peggio.

### 4.4 Alla porta nasce l'iscrizione — `RF-CAR-4`

`CheckIn.registrationId` è obbligatorio, e giustamente: l'iscrizione è la persona nell'evento.
Chi entra con un carnet a una milonga a cui non era iscritto **diventa iscritto in quel
momento**, con una `Registration` creata dalla verifica.

Non è un effetto collaterale da nascondere: è la cosa giusta. Quella persona è in sala, consuma
capienza, e il cruscotto dell'organizzatore deve vederla. L'anagrafica unica di `16` rende il
passaggio corretto anche quando la persona non ha un account.

---

## 5. Le domande a cui il modello non risponde

Sono decisioni di prodotto, e **nessuna di queste è tecnica**.

### 5.1 Un carnet impegna la capienza?

La più importante, e quella senza una risposta ovvia.

Una milonga da 120 posti con trenta carnet in giro: quanti posti sono liberi? Se il carnet
impegna, si vendono 90 biglietti e trenta posti restano vuoti quando i carnet non si presentano.
Se non impegna, si vendono 120 biglietti e alla porta arrivano 150 persone.

Il modello sa già rappresentare entrambe: `CapacityQuota.limiting = false` **conta senza
bloccare** (`05` §3), ed è nato per le milonghe incluse in un pass. Ma la scelta di quale delle
due sia il comportamento predefinito è dell'organizzatore, non nostra.

### 5.2 Il carnet scade?

«Dieci serate da usare quando vuoi» non regge senza un termine: un carnet venduto nel 2026 e
speso nel 2031 è un debito che nessuno ha messo a bilancio. Serve `validUntil`, e serve decidere
**cosa succede al residuo non speso** — che è una domanda contabile prima che informatica.

### 5.3 È trasferibile? È cedibile a metà?

Un biglietto si trasferisce (`RF-TCK`, e `TicketTransfer` esiste). Un carnet con sei ingressi
residui trasferito è sei ingressi che cambiano proprietario. È lecito? E si può cedere **un solo
ingresso** a un amico per una sera — che è ciò che la gente farà comunque?

### 5.4 Che cosa vede l'operatore quando il residuo è zero

`CheckInResult` ha cinque valori e nessuno dice «carnet esaurito». Serve il sesto, e serve
decidere se l'operatore possa **far entrare comunque** — che è ciò che accade in sala quando il
cliente è di casa.

---

## 6. Che cosa cambierebbe, in breve

| dove | cambiamento |
|---|---|
| `TicketType` | `eventId` nullabile + `organizationId`: il titolo di catalogo |
| `Ticket` | `entriesPurchased` nullabile, e il contatore del residuo |
| `Session` | `acceptsPasses`: è la sessione a dichiarare, non il carnet a elencare |
| `CheckInResult` | un valore nuovo per il carnet esaurito |
| Verifica alla porta | risolve il residuo, crea l'iscrizione, marca i conflitti |
| Manifesto offline | il residuo, perché senza rete non si contano righe |
| **`Ticket.status`** | **nessun cambiamento**: `USED` non serve e non si aggiunge (§2.2) |

---

## 7. Fuori da questo taglio

| funzione | perché |
|---|---|
| **Carnet fra organizzazioni diverse** | Un carnet di una scuola speso al festival di un'altra è una compensazione economica fra due soggetti, non una funzione |
| **Ricarica di un carnet esaurito** | È una vendita nuova. Ricaricare significa toccare `entriesPurchased` di una riga già venduta, e con essa la traccia di cosa è stato pagato |
| **Cessione di un singolo ingresso** | §5.3, se il committente la vuole è un progetto suo |
| **Rimborso del residuo** | Dipende da `Refund`, che `13` dichiara non ancora costruita |

---

## 8. Le decisioni da prendere

| # | Decisione | Stato |
|---|---|---|
| K1 | Il carnet contraddice `09` §7 | **No** — vieta uno stato, non un conteggio (§2) |
| K2 | Dove vive il titolo | Proposto: `TicketType` **dell'organizzazione**, `eventId` nullo (§4.1) |
| K3 | Come si dichiara dove vale | Proposto: **la sessione accetta i carnet**, non il carnet elenca le sessioni (§4.2) |
| K4 | Stato `USED` sul biglietto | **No**, e non va aggiunto |
| K5 | Il carnet impegna la capienza | 🟡 **Aperta** (§5.1) — la più importante |
| K6 | Scadenza e residuo non speso | 🟡 **Aperta** (§5.2) |
| K7 | Trasferibilità | 🟡 **Aperta** (§5.3) |
| K8 | Cosa fa l'operatore a residuo zero | 🟡 **Aperta** (§5.4) |

**K5 va decisa per prima**: cambia il motore di capienza, che è la parte del prodotto che `13`
§3 dichiara non tagliabile. Le altre tre cambiano schermate.

---

## 9. La stima, corretta

`06` §B8 e le mie parole di tre giorni fa davano il carnet come **il più costoso** dei capitoli
aperti, perché «contraddice un invariante». Non lo contraddice: contraddice **tre colonne
obbligatorie**, e la direzione di una dichiarazione.

Resta il più grosso dei tre — tocca il check-in, il manifesto offline e forse il motore di
capienza — ma non è un rifacimento. È un titolo che il modello sa quasi già rappresentare.
