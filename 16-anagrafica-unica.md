# Mirada Tango — L'anagrafica unica del ballerino

**Data** 4 settembre 2026 · Estende la fase A (identità) e `15-corsi.md` §3 ·
**Non crea** una tabella nuova: quella globale esiste dal primo giorno, e non era stata collegata

---

## 1. Il problema, che non è quello che sembra

Lo stesso ballerino frequenta il corso della scuola A e a marzo va al festival
dell'organizzazione B. Oggi B lo censisce da capo: ridigita nome, cognome ed email di una
persona che la piattaforma conosce già. A ogni evento, per ogni organizzazione, di nuovo.

La richiesta — «una tabella unica, non per tenant» — sembra domandare una struttura nuova. Non
è così, ed è la ragione per cui questo documento è corto.

### 1.1 Ciò che è già globale

`User`, `Person`, `Contact` e `DancerProfile` **non hanno `organizationId`**. Nessuno dei
quattro. Non è una svista: `backend-brief` §1.5 vincola il filtro di tenancy alle entità **che
discendono da `Organization`**, e il piano di costruzione (§2, passo 3) fa dipendere
`DancerProfile` da `User` e `File`, mai dall'organizzazione.

L'anagrafica del ballerino non è mai stata multi-tenant. L'isolamento vive sull'**iscrizione**:
`Registration` discende dall'evento, quindi dall'organizzazione, e B non vedrà mai le iscrizioni
di A. Ma la persona sotto è — e deve essere — la stessa riga.

> **L'isolamento riguarda ciò che una persona fa presso un'organizzazione, non chi la persona è.**

Questo documento non allarga il perimetro di §1.5. Ci resta dentro.

### 1.2 Il buco vero

Due fatti, entrambi piccoli, che insieme producono il ri-censimento:

1. **`Registration.personUserId` è nullabile**, e vale solo per chi ha un account.
2. **Nessuno risolve l'email verso una persona esistente.** `RegistrationService.save()` accetta
   `personUserId` se glielo passi, ma non lo cerca mai.

Tutte le iscrizioni che non nascono da un acquisto online — la porta, il canale esterno, e
l'`enrol()` dei corsi di `15` §3 — scrivono `holderName`, `holderSurname` e `holderEmail` come
**testo sciolto**, e non agganciano nessuno. Sono quelle che si ripetono.

### 1.3 La forma era già prevista

`Person.user` è `User?` — **opzionale**. Una `Person` può esistere senza account, con la sua
`Contact.email` unica su tutta la piattaforma. L'anagrafica senza account non va inventata: è
già una forma legittima del modello, semplicemente mai usata.

Ciò che manca è il collegamento. `Registration` punta a `User`, non a `Person`, quindi oggi
un'iscrizione **non può** essere agganciata a un'anagrafica priva di account.

> **Non serve una tabella. Serve una chiave esterna.**

---

## 2. La modifica strutturale — `RF-ANA-1`

`Registration.personUserId → User` diventa **`Registration.personId → Person`**.

### 2.1 Perché sostituire, non affiancare

`User.personId` è obbligatorio e unico: da una `Person` si raggiunge l'account se esiste, e da
un account si raggiunge sempre la persona. `personId` **contiene** `personUserId`.

Tenerli entrambi darebbe due modi di dire chi è l'iscritto, che possono divergere e prima o poi
divergeranno. È la stessa ragione per cui `CapacityQuota.consumed` e
`Registration.balanceSettledAmount` hanno una sola strada di scrittura: **una verità
rappresentata due volte è una verità che a un certo punto si contraddice.**

Sono diciassette occorrenze in cinque file — `RegistrationRepository`, `TicketRepository`,
`RegistrationService`, `OrderService`, `TicketService` — e due metodi da rinominare:
`findByPersonUser` e `findByEventAndPerson`.

### 2.2 L'unico diventa più forte — `RB31`

`@@unique([eventId, personUserId])` diventa `@@unique([eventId, personId])`.

I `NULL` distinti di PostgreSQL continuano a valere allo stesso modo — le iscrizioni non
censite non si ostacolano fra loro — ma il vincolo copre un caso che oggi sfugge: **la stessa
persona iscritta due volte allo stesso evento, una volta con account e una volta a mano.** Oggi
le due righe non collidono e nessuno se ne accorge; una consuma capienza due volte.

### 2.3 Il guadagno, che è il punto di tutto

`findMine()` risolve il `personId` del chiamante invece del suo `id`. Una lettura in più, e in
cambio:

> **Le iscrizioni fatte a mano prima che il ballerino avesse un account compaiono da sole
> in «le mie iscrizioni» il giorno in cui si registra.**

È il ritorno dell'intero lavoro, e non richiede alcuna migrazione di dati: le righe puntavano
già alla persona giusta, semplicemente attraverso una chiave che non c'era.

---

## 3. Il censimento — `RF-ANA-2`

Su `enrol()` e su ogni via manuale, **prima** di creare l'iscrizione:

| passo | azione |
|---|---|
| 1 | normalizza l'email: `trim`, minuscolo. Precedente in casa: `OrganizationInvitation.email` |
| 2 | cerca `Contact.email` → `Person` |
| 3 | **trovata** → collega `personId`, e **non riscrivere l'anagrafica** (§3.1) |
| 4 | **non trovata** → crea `Contact` + `Person`, **senza `User`** |
| 5 | il duplicato sull'evento lo intercetta l'unico di `RB31` |

Il passo 4 è l'anagrafica provvisoria: una persona esiste in piattaforma, con un'email
dimostrata da nessuno, e nessun modo di accedere. Diventa piena quando qualcuno la rivendica
(§4).

### 3.1 Chi è già censito non si riscrive — `RB32`

Il passo 3 collega e basta. La scuola che iscrive Maria Rossi **non** aggiorna il nome, il
cognome o la città di una `Person` che appartiene a tutta la piattaforma.

Non è prudenza eccessiva. Un'anagrafica scrivibile da qualunque organizzazione che ne conosca
l'email è un'anagrafica che, dopo il terzo organizzatore, contiene la versione dell'ultimo che
ha digitato — e l'ultimo può avere sbagliato, o aver scritto «Maria R.» per fare prima. I dati
propri li corregge chi li possiede, dalla sua area personale.

L'unica cosa che il censimento scrive su una persona esistente è **niente**.

---

## 4. La rivendicazione, che è obbligatoria — `RF-ANA-3`

### 4.1 Il difetto che si aprirebbe senza

`SsoService` cerca già l'utenza per email (`services/SsoService.ts:194`):

```ts
{ OR: [{ authentikSub: sub }, { person: { contact: { email } } }] }
```

Cerca però uno **`User`**. Se esiste una `Person` senza account — cioè esattamente ciò che il
§3 comincia a produrre — la query non trova nulla, si prosegue su
`UserService.createFromSso`, e alla riga 249 si esegue:

```ts
const contact = await this.contactRepository.save({ email }, prisma);
```

`Contact.email` è `@unique`. **Violazione del vincolo, al primo ballerino che si registra dopo
essere stato censito da una scuola.**

È della stessa famiglia delle trappole elencate in `CLAUDE.md` — qualcosa che compila, che i
tipi approvano, e che si rompe in esercizio — con un'aggravante: si rompe **sul percorso di
registrazione**, cioè sulla prima cosa che una persona nuova fa. Per questo la rivendicazione
non è una fase successiva: è parte della stessa consegna, ed è il pezzo da scrivere per primo.

### 4.2 Serve l'indirizzo dimostrato — `RB33`

La rivendicazione aggancia il nuovo `User` alla `Person` esistente **solo con l'email
verificata**. Il presidio esiste già e non va costruito: `User.emailVerifiedAt` è nato
precisamente per distinguere «l'indirizzo non è ancora stato dimostrato» dalla sospensione
amministrativa.

Senza quel vincolo, chiunque digiti l'email di un altro ne erediterebbe le iscrizioni passate,
il profilo e lo storico. Con Authentik come unico fornitore di identità la verifica è già nel
percorso, quindi il costo è zero — ma va **dichiarato**, perché è ciò che rende la
rivendicazione un aggancio e non un furto.

### 4.3 Che cosa ritrova chi rivendica

Le iscrizioni che portavano il suo `personId`, che sono tutte quelle fatte a suo nome da
chiunque. Nient'altro cambia: non acquisisce ruoli, non entra in alcuna organizzazione, non
vede nulla che prima non fosse suo.

---

## 5. Il profilo di ballo attraverso le organizzazioni — `RF-ANA-4`

**Decisione presa**: l'organizzazione che iscrive una persona già censita vede l'anagrafica di
base **e** il profilo di ballo — `preferredRole`, `declaredLevel`, `city`.

È la scelta utile: sono i tre campi che alimentano le quote per ruolo di `05`, e precompilarli
riduce l'errore dove costa di più, cioè in una classe o in un evento che si sbilancia. Ha però
un effetto che va contenuto, perché il `DancerProfile` è un dato che il ballerino ha compilato
per sé e non per gli organizzatori.

### 5.1 I tre presidi — `RF-ANA-5`

| presidio | perché |
|---|---|
| **Solo email esatta, mai ricerca parziale** | Nessun «elenca i ballerini di Bari». Senza questo il servizio è un oracolo che enumera chi sta sulla piattaforma e a che livello balla |
| **Solo a chi può creare iscrizioni** in quell'organizzazione | Non è un dato di consultazione: si vede mentre si iscrive qualcuno, non prima |
| **Ogni chiamata scrive una riga di `Log`** | Il registro delle azioni sensibili (`RF-ADM-9`) è già dentro il primo taglio, e questa è una di quelle azioni. È anche l'unico modo di accorgersi che qualcuno sta provando email a tappeto |

Il primo presidio è quello che fa il lavoro. Gli altri due servono quando il primo verrà
aggirato da qualcuno che le email le ha già.

### 5.2 L'interruttore del ballerino — `RF-ANA-7`

Un booleano su `DancerProfile` — *«il mio profilo di ballo è visibile agli organizzatori che mi
iscrivono»* — con **default acceso**.

Avendo deciso di esporre il profilo, dare al ballerino la leva è il contrappeso proporzionato, e
costa una colonna e una spunta. Il default acceso è ciò che impedisce all'interruttore di
svuotare la funzione: chi non lo tocca è visibile, chi ha ragioni per non esserlo ha dove dirlo.

Va deciso **adesso** e non dopo per una ragione banale e concreta: la colonna entra nella
migrazione del §2, che si fa comunque. Rimandarla significa una seconda migrazione per un
booleano.

---

## 6. La coppia che condivide l'email — `RF-ANA-6`

**Decisione presa**: `Contact.email` resta unica. Una email, una persona.

Nel tango la coppia che usa un solo indirizzo è comunissima, quindi il caso si presenta subito e
va saputo **cosa succede davvero** — che non è un blocco.

`Registration.holderEmail` è una `String` normale, non unica. Quindi la seconda persona **si
iscrive lo stesso**, con la stessa email nel proprio `holderEmail`: resta senza `personId`, cioè
fuori dall'anagrafica globale. Degrada esattamente nel comportamento di oggi.

La regola che ne discende, ed è quella da dire alla segreteria:

> **L'anagrafica globale nasce quando c'è un'email propria. Chi non ce l'ha resta
> un'iscrizione sciolta.**

Non è una regressione — è il caso di oggi, lasciato scoperto invece che risolto. Va detto alla
scuola in anticipo, perché lo incontra la prima settimana di corso e non alla decima.

⚠️ Ciò che **non** si deve fare è sintetizzare un indirizzo per riempire il vincolo. Il
precedente in casa esiste (`pass-…@non-nominale.local` per i pass al portatore) ed è corretto
lì, dove non c'è una persona. Qui la persona c'è: un'email finta la censirebbe con un dato che
non le appartiene, e sporcherebbe l'anagrafica globale — cioè l'opposto dell'obiettivo.

---

## 7. Che cosa cambia, in breve

| dove | cambiamento |
|---|---|
| `Registration` | `personId → Person` **al posto di** `personUserId`; unico su `(eventId, personId)` |
| **nuovo** | risoluzione dell'email → anagrafica, con creazione provvisoria |
| `SsoService` · `UserService` | **la rivendicazione**: aggancio alla `Person` esistente, con email verificata |
| **nuovo** | `GET /people/lookup` — ricerca per email esatta, anagrafica e profilo di ballo |
| `RegistrationService` | `enrol()` censisce; `findMine()` passa da `id` a `personId` |
| `DancerProfile` | visibilità del profilo agli organizzatori, default acceso |
| Informativa | il trattamento dei dati di chi è censito senza account, e cosa vede chi lo iscrive |

---

## 8. Regole di business nuove

| # | Regola |
|---|---|
| **RB31** | **Una iscrizione per anagrafica per evento**, con o senza account. Il vincolo si sposta dall'utenza alla persona e copre il caso misto |
| **RB32** | **Il censimento collega, non riscrive.** Nessuna organizzazione modifica l'anagrafica di una persona che appartiene alla piattaforma |
| **RB33** | **Una persona si rivendica solo con l'indirizzo dimostrato.** Senza `emailVerifiedAt`, l'aggancio non avviene |

---

## 9. Fuori da questo taglio

| funzione | perché resta fuori |
|---|---|
| **Fusione di anagrafiche duplicate** | Con l'email come chiave i duplicati nascono solo da indirizzi diversi della stessa persona. Serve uno strumento di fusione, ma prima serve sapere quanti casi esistono davvero |
| **Storico delle partecipazioni fra organizzazioni** | Scartato in decisione: darebbe a un organizzatore la vista sui partecipanti dei concorrenti. È l'unico punto in cui questo documento avrebbe davvero incrinato `backend-brief` §1.5 |
| **Ricerca libera dell'anagrafica** | §5.1, primo presidio. Non è un elenco consultabile |
| **Email condivisa fra due anagrafiche** | §6, decisione presa. Rientra il giorno in cui la segreteria porta i casi contati |
| **Cancellazione e portabilità sull'anagrafica provvisoria** | Chi non ha un account non ha un'area personale da cui esercitare i propri diritti. Va risolto con l'informativa e una via di contatto, non con una funzione — ma va risolto |

---

## 10. Decisioni

| # | Decisione | Esito |
|---|---|---|
| A1 | Serve una tabella nuova | **No.** `User`, `Person`, `Contact` e `DancerProfile` sono già globali |
| A2 | Il legame dell'iscrizione | **`personId → Person`**, che sostituisce `personUserId` |
| A3 | Chi crea l'anagrafica di chi non si è mai registrato | **La segreteria**, in forma provvisoria: `Person` senza `User` |
| A4 | Il censimento aggiorna i dati esistenti | **No** (`RB32`) |
| A5 | La rivendicazione | **Obbligatoria e prioritaria**: senza, la registrazione via SSO si rompe (§4.1) |
| A6 | Condizione della rivendicazione | **Email dimostrata** (`RB33`) |
| A7 | Cosa vede l'organizzazione che iscrive | **Anagrafica di base e profilo di ballo**, con i tre presidi del §5.1 |
| A8 | Storico delle partecipazioni altrui | **No** |
| A9 | Email condivisa da due persone | **No.** Una email, una persona; il secondo resta iscrizione sciolta (§6) |
| A10 | Interruttore di visibilità sul `DancerProfile` | **Sì**, con default acceso. Entra nella migrazione del §2 (§5.2) |

---

## 11. Il lavoro, in ordine

L'ordine non è negoziabile sul primo punto: è l'unico che, se manca, rompe qualcosa che oggi
funziona.

| # | cosa | dove | stato |
|---|---|---|---|
| **1** | **La rivendicazione** — si cerca la `Person` senza account e la si aggancia invece di creare un `Contact` | `services/UserService.ts` | ✅ |
| 2 | Migrazione: `Registration.personId`, unico su `(eventId, personId)`, riempimento da `personUserId` | `prisma/migrations/` | ✅ |
| 3 | Risoluzione dell'anagrafica: normalizza, cerca, **crea la provvisoria** | `services/PersonResolutionService.ts` | ✅ |
| 4 | Ricerca per email esatta, con permesso e riga di `Log` | `controllers/PersonController.ts` | ✅ |
| 5 | `enrol()` chiama il punto 3; `findMine()` e i due finder passano a `personId` | `services/RegistrationService.ts` | ✅ per `16`; `enrol()` resta al `15` |
| 6 | La spunta di visibilità sul profilo — colonna nella migrazione del punto 2 | `DancerProfile` · area personale | ✅ |

### Cosa è emerso realizzando i punti 1 e 2

- **La rivendicazione serviva in due posti, non in uno**, e il secondo era peggiore. Oltre a
  `createFromSso`, l'autoregistrazione del ballerino (`UserService.register`) rifiutava con
  `EMAIL_ALREADY_REGISTERED` chiunque fosse già censito: «questo indirizzo ha già un account,
  accedi». La frase è **falsa** e manda ad accedere a qualcosa che non esiste. Non falliva —
  *rispondeva* — ed era un vicolo cieco da cui non si esce da soli. Lì `RB33` vale per un'altra
  strada: quel percorso non valorizza `emailVerifiedAt`, quindi l'utenza nasce incapace di
  accedere finché non si preme il collegamento nella casella.
- **`OrderService` cercava i partecipanti fra le sole utenze.** Ora cerca fra le anagrafiche,
  così una vendita online aggancia chi una scuola ha censito. È una lettura, non un censimento.
- **Il travaso è stato verificato riga per riga**, non soltanto contato: su tutte e quattro le
  iscrizioni interessate l'`holderEmail` coincide con l'email dell'anagrafica agganciata.
- **`AnagraficaUnica.test.ts`** prova le due facce — che la rivendicazione avvenga, e che
  restituisca il passato.

### Cosa è emerso realizzando i punti 3 e 4

- **La vendita esterna non deve censire, e per poco non lo faceva.** È una via non-online come
  quelle che censiscono, ma su `ExternalSale` l'`holderEmail` è **dell'acquirente anche sui posti
  intestati ad altri** — è l'unico indirizzo che il negozio ha visto. Censire lì darebbe lo
  stesso `personId` a tre iscrizioni dello stesso evento, e la seconda violerebbe `RB31`: una
  vendita **già incassata** verrebbe rifiutata, che è la sola cosa che l'ingestione non deve mai
  fare. Il percorso resta senza anagrafica, e ora porta scritto perché.
- **Il checkout invece è sicuro**, e non per fortuna: `OrderService` deduplica già i partecipanti
  per indirizzo, quindi una email produce un partecipante e un'iscrizione. È la stessa decisione
  A9 vista dall'altro lato.
- **La rotta è `/people/lookup`, non `/persons/lookup`**: il controller esiste già con quel
  prefisso. Il §11 diceva l'altro nome, e il codice ha ragione.
- **Il permesso della ricerca è `CREATE REGISTRATION`, non `READ PERSON`.** Il secondo è il
  permesso amministrativo di piattaforma: aprirebbe la rotta a chi non deve iscrivere nessuno, e
  il §5.1 chiede l'opposto — si guarda **mentre** si iscrive qualcuno.
- **Un profilo nascosto e un profilo inesistente escono identici.** Distinguerli direbbe «esiste
  ma non te lo dico», che è comunque un'informazione su chi ha chiesto di non darla.

Suite completa verde: **21 suite, 213 prove**.

### Cosa è emerso realizzando il punto 6

- **Il backend non è stato toccato.** `DancerProfileUpdateSchema` deriva da
  `DancerProfilePartialSchema`, generato dallo schema Prisma: la colonna del punto 2 era già
  accettata in scrittura, e nessuno schema di risposta la filtrava in lettura. L'interruttore era
  davvero solo interfaccia.
- **La prova che serviva non era quella che c'era.** Esisteva già un test che spegneva la colonna
  **scrivendo in banca dati** e verificava che la ricerca la rispettasse. Non copriva il tratto
  che il ballerino usa davvero: la `PATCH` dalla propria area. Senza, sarebbe rimasto possibile
  un interruttore che si muove e non fa niente — che è il modo più silenzioso di rompere questa
  funzione. Ora il giro è provato per intero, dalla spunta alla ricerca.
- **Il testo accanto alla spunta dice cosa NON succede.** Spegnere non ritira ciò che si è già
  comunicato iscrivendosi a un evento: quel dato è dell'organizzatore da prima. Prometterlo
  sarebbe una promessa che il sistema non può mantenere.

Il documento `16` è **completo**: tutti e sei i passi sono realizzati e provati.

Suite finale: **21 suite, 214 prove**.

Il punto 2 non ha rischio di perdita: ogni `personUserId` valorizzato ha un `User`, e ogni
`User` ha un `personId` obbligatorio. Il riempimento è una `UPDATE` con una sola giunzione, e
le righe che oggi hanno `personUserId` nullo restano nulle — sono le iscrizioni sciolte, che il
§3 comincerà a censire da lì in avanti ma che **non** si tenta di riconciliare all'indietro.
Riconoscere retroattivamente le persone da un'email di testo è un'operazione che sbaglia in
silenzio, e non vale il rischio su dati già in esercizio.
