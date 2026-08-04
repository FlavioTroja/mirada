# Mirada Tango — Frontend brief

**Perimetro** primo taglio (`13-primo-taglio.md` §4) · **Generato da** `keijo-create` ·
**Consuma** il §3 di questo file, identico a quello di `backend-brief.md`

## Project context

**Cliente.** Overzoom S.r.l. — prodotto proprio, non commessa.

**Dominio.** *Mirada Tango* è un **marketplace multi-organizzatore di eventi di tango
argentino**. Gli organizzatori pubblicano festival, marathon, encuentro e stage; i ballerini
li scoprono, si iscrivono e pagano online; lo staff gestisce l'accesso in sala. Il principio
architetturale che regge l'intera analisi funzionale è: **l'organizzatore configura, la
piattaforma non impone** — tipi di evento, quote di capienza, requisiti di partecipazione e
servizi accessori sono cataloghi estensibili composti in fase di creazione dell'evento, non
enum scritti nel codice.

**Le tre cose che distinguono il prodotto da un ticketing generalista.**

1. **Il ruolo di ballo (leader / follower) è una dimensione di capienza**, non un campo
   descrittivo: un evento può essere pieno per i follower e aperto per i leader. Il ruolo non
   è mai derivato dal genere della persona.
2. **L'iscrizione a coppia** è una transazione a due soggetti su un unico ordine, con ruoli
   complementari e un solo pagamento.
3. **Il motore di capienza multi-dimensionale**, con quote su evento / sessione / titolo /
   servizio, flag `limiting` e cancello di tolleranza sullo sbilancio dei ruoli.

**Personas.**

| Chi | Cosa fa | Dove |
|---|---|---|
| **Ballerino** (`DANCER`) | scopre l'evento, sceglie il titolo e il ruolo, paga, riceve il QR, trasferisce il biglietto | `www` |
| **Owner** dell'organizzazione | dati fiscali, account di incasso, staff, eventi, rimborsi | `app` |
| **Event Manager** | costruisce e pubblica gli eventi, definisce titoli e quote | `app` |
| **Operatore check-in** | scansiona i QR all'ingresso, spesso volontario, spesso senza rete | `app` (PWA) |
| **Super Admin** (`GOD`) | approva le organizzazioni, governa i cataloghi | `app` |

**Flussi principali.**

1. Il Super Admin crea l'organizzazione; l'Owner collega l'account Stripe e dichiara il
   proprio inquadramento fiscale.
2. L'Event Manager crea l'evento: sessioni, cast, titoli d'ingresso con elenco esplicito
   delle sessioni incluse, quote di capienza, requisiti, servizi accessori; poi pubblica.
3. Il ballerino apre la scheda pubblica, sceglie il titolo e il ruolo, avvia l'ordine
   (**prenotazione di 15 minuti con impegno atomico della capienza**), paga con Stripe e
   riceve il biglietto con QR firmato.
4. In sala l'operatore scarica la lista, scansiona i QR **anche senza rete**, e la coda
   locale si sincronizza al ritorno della connessione segnalando gli eventuali conflitti.
5. L'organizzatore guarda il cruscotto: venduto per titolo, iscritti per ruolo, sbilancio
   corrente, presenze in tempo reale.

**Obiettivo di business.** Mettere due o tre organizzatori già clienti in condizione di
**aprire le prenotazioni del prossimo evento reale**, con incasso diretto sul proprio account
Stripe. Non è un MVP dimostrativo: la prima apertura vendite è un collaudo in produzione con
denaro vero.

**Posizionamento dichiarato.** La piattaforma è **uno strumento di vendita, non un
intermediario fiscale**. Emette una *conferma d'ordine con QR di accesso*, mai un titolo
fiscale; gli adempimenti restano dell'organizzatore e si svolgono fuori dalla piattaforma. I
**diritti di prevendita** sono ricavo della piattaforma, pagati dal partecipante ed esposti
come voce separata in checkout.

**Documenti sorgente.** L'analisi funzionale completa è in
`MIRADA-TANGO-contesto-completo.md` (concatenazione di `00`→`13`). I riferimenti `RF-*`,
`RB*`, `AS*`, `R*` e `T*` che compaiono in questo brief puntano lì e sono autoritativi sul
*perché*; questo brief è autoritativo sul *cosa costruire*.

---
## §0 — Come consumare questo brief

Sei un sub-agent **keijo-fe**. Questo file è la tua specifica eseguibile.

1. Leggilo **per intero** prima di scrivere qualunque cosa.
2. **Il §3 è autoritativo.** Ogni chiamata che scrivi deve risolvere in un endpoint del §3.
   Se una feature ha bisogno di un endpoint che lì non c'è, **fermati e chiedi** — non
   inventarlo, non "correggere" il dialetto (elenco e creazione sono `POST`: è deliberato).
3. Lavora **headless**: non chiedere conferme su cose già decise qui. Il §7 contiene le
   decisioni prese e le assunzioni dichiarate: sono risposte, non domande aperte.
4. **Regola del 3+1.** Se incontri un buco o una contraddizione, fermati e proponi
   **tre opzioni concrete più la possibilità che l'utente ne indichi una quarta**. Non
   ri-progettare per conto tuo.
5. Sequenza: `keijo-fe-init` (con §1, §2, §3, §5) → `keijo-fe-feature` per ogni rotta del §4
   → `keijo-fe add-feature` per ogni pagina.
6. A build conclusa **proponi** `keijo-fe-check`. Non eseguirlo in silenzio e non applicare
   fix da solo.

---

## §1 — Identità del progetto

**Dominio.** Vedi il blocco *Project context* in testa a questo file.

**Nomi delle entità: inglese; interfaccia: italiano.** Le entità, le rotte e gli store
usano i nomi inglesi del §3 (`Event`, `Registration`, `TicketType`, `CapacityQuota`…); ogni
etichetta, messaggio, intestazione di colonna e testo visibile è **in italiano**, con
l'inglese come seconda lingua dell'interfaccia (`RF-PUB-9`).

Il vocabolario del tango è **parte dei requisiti**: usarlo correttamente è un fattore di
credibilità verso la community. Tabella di corrispondenza obbligatoria per le etichette:

| Entità (§3) | Etichetta italiana | Nota |
|---|---|---|
| `Event` | Evento | |
| `Session` | Sessione | workshop, milonga, spettacolo |
| `TicketType` | Titolo d'ingresso | mai «biglietto»: quello è l'esemplare venduto |
| `Ticket` | Biglietto | |
| `Registration` | Iscrizione | la **persona** nell'evento, non il titolo economico |
| `CapacityQuota` | Quota di capienza | |
| `Couple` | Coppia | |
| `PassIssuance` | Emissione manuale di pass | |
| `DanceRole` `LEADER` / `FOLLOWER` | Leader / Follower | **mai** «uomo/donna»: nel tango il ruolo è indipendente dal genere (`RB6`) |
| `DeclaredDanceRole` `FLEXIBLE` | Ruolo flessibile | |
| `PresaleRights` | Diritti di prevendita | mai «commissione» o «fee» nei testi rivolti al pubblico |
| `Artist` | Cast | maestri, DJ, orchestre |
| `Venue` | Location | |

**Entità di dominio** (elenco completo e basi REST nel §3.4). Sono **30**, più tre figli posseduti, e non vanno
accorpate: `Ticket` e `Registration` sono due entità distinte perché il biglietto è un titolo
economico trasferibile mentre l'iscrizione è la presenza di una persona con il suo ruolo, i
suoi requisiti e i suoi check-in — accorparle aprirebbe un buco nei controlli al primo
trasferimento.

**Ruoli e gating dell'interfaccia** (matrice completa nel §3.8):

| Ruolo | Cosa vede nella sidebar |
|---|---|
| `GOD` | tutto, più `/platform` |
| `OWNER` | tutto tranne `/platform` |
| `EVENT_MANAGER` | tutto tranne `/platform`, `/organization` e le azioni di rimborso |
| `CHECKIN_OPERATOR` | **solo** `/check-in` e `/registrations` in sola lettura |
| `DANCER` | non entra in questa applicazione: la sua superficie è `www` |

**Documentazione tecnica di riferimento** per `keijo-fe-init.api_docs`: il §3 di questo file.
Non esistono altre fonti; non cercare uno Swagger, non c'è.

---

## §2 — Mappa di navigazione

### 2.1 L'applicazione `app` (questa: keijo-ui, sidebar, signals)

Nessuna rotta di categoria `settings` compare nella sidebar (`KEIJO-SIDEBAR-NO-SETTINGS`).
Le preferenze utente vivono nel menu utente, fuori dalla sidebar.

| # | `path` | `label` | `page_category` | Descrizione | Entità in superficie | Visibile a |
|---|---|---|---|---|---|---|
| 1 | `/dashboard` | Cruscotto | `dashboard` | Venduto per titolo, iscritti per ruolo e **sbilancio corrente**, coppie complete, presenze in tempo reale, requisiti mancanti, andamento vendite | `Event`, `CapacityQuota`, `Registration`, `CheckIn` | `GOD` `OWNER` `EVENT_MANAGER` |
| 2 | `/events` | Eventi | `entity-management` | Il workspace di costruzione dell'evento: dati base, sessioni, cast, titoli d'ingresso, quote, requisiti, servizi, ciclo di vita | `Event`, `Session`, `EventCast`, `TicketType`, `PriceTier`, `CapacityQuota`, `EventRequirement`, `EventService` | `GOD` `OWNER` `EVENT_MANAGER` |
| 3 | `/registrations` | Iscritti | `list+filters` | Elenco iscritti con filtri e ricerca; dettaglio con ordine, requisiti, servizi, check-in, storico | `Registration`, `RequirementOutcome`, `Couple`, `CheckIn` | tutti tranne `DANCER` |
| 4 | `/tickets` | Biglietti | `list+filters` | Biglietti emessi, storico dei trasferimenti, emissione manuale di pass | `Ticket`, `TicketTransfer`, `PassIssuance` | `GOD` `OWNER` `EVENT_MANAGER` |
| 5 | `/orders` | Ordini | `list+filters` | Ordini, pagamenti, prenotazioni attive, rimborsi manuali | `Purchase`, `Order`, `Payment`, `Reservation`, `Refund` | `GOD` `OWNER` `EVENT_MANAGER` (rimborsi solo `OWNER`) |
| 6 | `/check-in` | Check-in | `custom` | Scansione QR, funzionamento **senza connessione**, ricerca manuale, contatore presenze, risoluzione dei conflitti di sincronizzazione | `CheckIn`, `Ticket`, `Registration` | tutti tranne `DANCER` |
| 7 | `/reports` | Report | `dashboard` | Riepilogo economico dell'evento ed esportazioni, compresa quella con dettaglio per sessione | `Order`, `Payment`, `Refund` | `GOD` `OWNER` `EVENT_MANAGER` |
| 8 | `/directory` | Anagrafiche | `entity-management` | Location e cast riutilizzabili tra eventi | `Venue`, `Artist` | `GOD` `OWNER` `EVENT_MANAGER` |
| 9 | `/organization` | Organizzazione | `entity-management` | Anagrafica e dati fiscali, dichiarazione di inquadramento, **stato di abilitazione all'incasso**, membri e ruoli, policy di rimborso | `Organization`, `FiscalDeclaration`, `OrganizationMember`, `RefundPolicy` | `GOD` `OWNER` |
| 10 | `/platform` | Piattaforma | `entity-management` | Cataloghi estensibili (tipi evento, tipi requisito, tipi servizio, preset di rimborso), elenco organizzazioni ed eventi | `EventType`, `RequirementType`, `ServiceType`, `RefundPolicy`, `Organization` | `GOD` |

`/organization` **non è una pagina di impostazioni**: è la gestione di un'entità di dominio
con dati fiscali, membri e stato di incasso, e la sua categoria è `entity-management`.

### 2.2 Le altre due superfici — NON le costruisci tu

L'architettura prevede tre applicazioni. **Le skill keijo-fe generano solo `app`.** Le altre
due sono elencate qui perché consumano lo stesso §3 e perché tu non le duplichi per errore
dentro `app`:

| App | Cosa contiene | Perché è fuori da keijo |
|---|---|---|
| **`www`** (Angular SSR) | scheda evento pubblica, checkout, area personale del ballerino | Serve `schema.org/Event`, URL stabile e immagine di condivisione (`RF-PUB-6`): un'app SPA con sidebar non li dà. È anonima e non ha sidebar |
| **`wall`** (pagina autonoma fullscreen) | proiezione in sala, attivata con codice a sei caratteri | Nel primo taglio è **predisposta e vuota**: chat e Live Wall arrivano in fase 1b. Non costruire nulla oltre alla rotta segnaposto |

Se una feature del §4 sembra chiedere una pagina pubblica anonima, **è un errore del brief**:
fermati e segnalalo (regola 3+1).

---
## §3 — Contratto API (condiviso, autoritativo)

> **Questa sezione è identica byte per byte nei due brief.** Il backend la **implementa**, il
> frontend la **consuma**. Nessuna delle due parti può cambiarla da sola: se una feature ha
> bisogno di un endpoint che qui non c'è, si **aggiunge prima qui** (in entrambi i file) e poi
> lo si referenzia. Un `api_endpoints` che non risolve in §3 è un difetto del brief.

### 3.1 Trasporto e autenticazione

- Prefisso globale **`/api`**. Nessun versionamento in URL.
- **JWT Bearer**:
  - `POST /api/auth/login` body `{ usernameOrEmail, password }` → `{ token }`
  - `GET /api/auth/profile` → utente popolato, **comprensivo di `wsCode`**
  - header `Authorization: Bearer <jwt>`
- **Nessun refresh token.** Un `401` significa logout: il frontend cancella il token e
  reindirizza al login.
- Token in `localStorage`, chiave **`Authorization`**, salvato **grezzo**; il prefisso
  `Bearer ` è aggiunto in memoria dall'interceptor.
- **Il payload del token è minimo**: `{ id, username, wsCode, roles }` e nulla più. Il
  template firmava `{ ...user }`, cioè **l'intera riga utente compreso l'hash bcrypt della
  password** — e il payload di un JWT è base64, non cifrato, sta in `localStorage` e viaggia
  a ogni richiesta. Per lo stesso motivo **nessuna risposta API espone mai `password`**, in
  nessun DTO. Difetto di fondazione, corretto nel progetto.
- Fuso orario di riferimento **`Europe/Rome`**, valuta **EUR**. Tutti gli importi sono in
  **centesimi interi** (`Int`), mai in virgola mobile.

### 3.2 Il dialetto REST (per ogni entità, base plurale `/{plural}`)

| Intento | Forma |
|---|---|
| Elenco paginato e filtrato | `POST /{plural}/` body `{ query, options }` |
| Creazione | `POST /{plural}/create` |
| Lettura singola | `GET /{plural}/:id?populate=<relazioni separate da spazio>` |
| Aggiornamento parziale | `PATCH /{plural}/:id` |
| Cancellazione (soft) | `DELETE /{plural}/:id` |
| Modifica di una collezione figlia | **un solo** `PATCH /{plural}/:id/<subs>` con **l'array intero** (`id:-1` = nuovo, `toBeDisconnected:true` = rimosso) |

**Elenco e creazione sono POST.** È deliberato e non va "corretto": `POST /{plural}/` è la
lista, `POST /{plural}/create` è la creazione. Nessun `PUT` se non per upload
binari/multipart.

### 3.3 Buste (envelopes)

- **Successo: nessun wrapper.** Si restituisce l'entità, l'array o l'oggetto di paginazione
  grezzi.
- **Paginazione** `PaginateDatasource<T>`:
  ```ts
  { docs: T[], totalDocs, totalPages, page, limit,
    prevPage, nextPage, hasPrevPage, hasNextPage }
  ```
- **Corpo di query** `{ query, options }`:
  - `query` = `{ value?: string /* full-text */, ...facet }`
  - `options` = `{ page = 1, limit = 10, sort: { campo: "asc" | "desc" }, populate?: string }`
- **Errori** (canonici):
  - Zod → `400 { error: "ZodError", message, issues: [{ path, ... }] }`
  - `HttpError` lanciato → `{ error: "HttpError", code, message }`
  - altro → `500 { error, message }`

**Errori di dominio del motore di capienza.** Sono `HttpError` con `code` stabile, e il
frontend **deve** distinguerli perché hanno significati opposti (`RF-PAY-17`):

| `code` | Significato | Messaggio all'utente |
|---|---|---|
| `SOLD_OUT` | Limite assoluto raggiunto, situazione definitiva | «Posti follower esauriti» |
| `ROLE_ON_HOLD` | Blocco temporaneo per sbilancio, può sbloccarsi | «Iscrizioni leader momentaneamente sospese, in attesa di follower. Puoi iscriverti subito in coppia.» |
| `PARTIAL_AVAILABILITY` | Solo quote di servizio accessorio esaurite | si propone la rimozione delle righe e si richiede conferma (`RB17`) |
| `RESERVATION_EXPIRED` | La prenotazione di 15 minuti è scaduta | ritorno al carrello, nessun addebito |
| `RESERVATION_ALREADY_ACTIVE` | Una prenotazione è già attiva per questo utente su questo evento | `RF-PAY-23` |
| `SALES_CLOSED` | L'evento non è più in vendita online | `RF-EVT-40` |
| `PAYOUT_NOT_ENABLED` | L'organizzazione non è abilitata all'incasso | `RF-ORG-11` |

Il payload di `SOLD_OUT` e `ROLE_ON_HOLD` porta sempre `{ scope, scopeId, scopeLabel, role }`,
perché `RF-PAY-16` richiede di **nominare la sessione e il ruolo** e di proporre i titoli
alternativi.

### 3.4 Le entità e le loro basi REST

Enti della **foundation keijo** — `User`, `Person`, `Contact`, `Address`, `Role`,
`Permission`, `Config`, `Log`, `File` — **già presenti nel template, mai da ricreare**.
`Log` assorbe integralmente `RF-EVT-18` (registro modifiche evento), `RF-BKO-7` (registro
attività staff) e `RF-ADM-9` (audit log immutabile).

**Due eccezioni della foundation da completare**, scoperte costruendo:

- **`Address` espone la base REST piena** `/addresses` con i cinque verbi del dialetto. Il
  template ne spedisce **solo `GET /addresses/cities`**, ma `Venue.addressId` è
  obbligatorio: senza una creazione, una location non è creabile. Permessi come `VENUE`.
  **Unica eccezione al soft delete del §3.2**: `Address` è l'unica entità del dialetto
  **priva della colonna `deleted`** — la foundation non gliela dà, e i suoi lettori
  (`GET /addresses/cities`, il populate `person.addresses`, la sub-risorsa
  `PATCH /people/:id/addresses`) non filtrerebbero comunque su di essa, mostrando righe
  cancellate. `DELETE /addresses/:id` è quindi una **cancellazione reale**, che **rifiuta
  con `400`** l'indirizzo ancora referenziato da una `Venue` o da una `Organization`.
- **`File` espone gli upload** già presenti nel template ma non dichiarati: vedi §3.7.
  `FILE` è un `PermissionResource` a tutti gli effetti e **compare nella matrice §3.8**:
  senza, un `EVENT_MANAGER` non potrebbe caricare una locandina.

| Entità | Base REST | Note |
|---|---|---|
| `Organization` | `/organizations` | |
| `OrganizationMember` | `/organization-members` | |
| `FiscalDeclaration` | `/fiscal-declarations` | versionata, mai aggiornata: si crea una nuova versione |
| `DancerProfile` | `/dancer-profiles` | 1–1 con `User` |
| `EventType` | `/event-types` | catalogo, solo `GOD` |
| `RequirementType` | `/requirement-types` | catalogo, solo `GOD` |
| `ServiceType` | `/service-types` | catalogo, solo `GOD` |
| `RefundPolicy` | `/refund-policies` | preset di piattaforma + varianti per organizzazione |
| `Venue` | `/venues` | |
| `Event` | `/events` | |
| `Session` | `/sessions` | |
| `Artist` | `/artists` | anagrafica di cast, **senza account** |
| `EventCast` | `/event-casts` | |
| `EventRequirement` | `/event-requirements` | |
| `EventService` | `/event-services` | |
| `TicketType` | `/ticket-types` | |
| `CapacityQuota` | `/capacity-quotas` | |
| `QuotaConsumption` | `/quota-consumptions` | **sola lettura** |
| `Purchase` | `/purchases` | raggruppa N `Order`, uno per organizzatore |
| `Order` | `/orders` | |
| `Reservation` | `/reservations` | **sola lettura**; si crea e si rilascia via §3.6 |
| `Payment` | `/payments` | **sola lettura** |
| `Ticket` | `/tickets` | |
| `TicketTransfer` | `/ticket-transfers` | **sola lettura**; si crea via §3.6 |
| `PassIssuance` | `/pass-issuances` | |
| `Registration` | `/registrations` | |
| `Couple` | `/couples` | |
| `RequirementOutcome` | `/requirement-outcomes` | |
| `CheckIn` | `/check-ins` | |
| `Refund` | `/refunds` | |

**Figli posseduti, senza base REST propria** — si modificano con un solo `PATCH` che porta
l'array intero:

| Figlio | Endpoint |
|---|---|
| `TicketTypeSession` (elenco esplicito delle sessioni incluse) | `PATCH /ticket-types/:id/sessions` |
| `PriceTier` (scaglioni di prezzo) | `PATCH /ticket-types/:id/price-tiers` |
| `OrderLine` | `PATCH /orders/:id/lines` |

### 3.5 Enumerazioni

```ts
DanceRole            = "LEADER" | "FOLLOWER"
DeclaredDanceRole    = "LEADER" | "FOLLOWER" | "FLEXIBLE"
PreferredDanceRole   = "LEADER" | "FOLLOWER" | "BOTH"

OrganizationStatus   = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED"
PayoutStatus         = "NOT_CONNECTED" | "PENDING" | "ENABLED" | "DISABLED"
OrgMemberRole        = "OWNER" | "EVENT_MANAGER" | "CHECKIN_OPERATOR"
FiscalDeclarationKind= "ORGANIZATION_FRAMEWORK" | "EVENT_ATTESTATION"

EventStatus          = "DRAFT" | "PUBLISHED" | "SALES_CLOSED" | "RUNNING" | "ENDED" | "ARCHIVED" | "CANCELLED"
SalesCloseCriterion  = "DATE" | "QUOTA_EXHAUSTED" | "MANUAL" | "EVENT_START"
ArtistKind           = "TEACHER" | "DJ" | "ORCHESTRA"

SaleUnit             = "PER_PERSON" | "PER_COUPLE"
TicketTypeVisibility = "PUBLIC" | "CODE_RESTRICTED"
PriceTierKind        = "BY_DATE" | "BY_QUANTITY" | "COMBINED"

QuotaScope           = "EVENT" | "SESSION" | "TICKET_TYPE" | "SERVICE"
QuotaReservedFor     = "COMPLIMENTARY" | "EXTERNAL_CHANNEL"

RequirementKind      = "DECLARATION" | "CUSTOM_FIELD"
RequirementBlocking  = "PURCHASE" | "ENTRY" | "NONE"
RequirementVerification = "AUTOMATIC" | "MANUAL"
RequirementOutcomeStatus = "TO_PROVIDE" | "UNDER_REVIEW" | "VALID" | "REJECTED" | "EXPIRED"

OrderStatus          = "PENDING_PAYMENT" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED"
PaymentProvider      = "STRIPE"
PaymentStatus        = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED"

TicketStatus         = "VALID" | "TRANSFERRED" | "CANCELLED" | "REFUNDED"
RegistrationStatus   = "CONFIRMED" | "TO_CONFIRM" | "DECLINED"
RegistrationChannel  = "ONLINE_SALE" | "DOOR_SALE" | "COMPLIMENTARY" | "EXTERNAL_CHANNEL"
PassIssuanceReason   = "COMPLIMENTARY" | "EXTERNAL_SALE" | "GIFT" | "COURTESY"

CheckInKind          = "OPERATOR" | "MANUAL_SEARCH" | "EXTERNAL_ENTRY"
CheckInResult        = "VALID" | "ALREADY_USED" | "WRONG_EVENT" | "REFUNDED_OR_CANCELLED" | "REQUIREMENT_BLOCKED"

RefundStatus         = "REQUESTED" | "APPROVED" | "REJECTED" | "EXECUTING" | "EXECUTED" | "FAILED"
ReleaseReason        = "EXPIRED" | "ABANDONED" | "PAYMENT_FAILED" | "COMPLETED"
```

**Testo traducibile.** Ogni campo marcato `I18nText` è un oggetto `{ it: string, en?: string }`.
In assenza della traduzione si mostra il testo originale **con l'indicazione della lingua**,
mai una stringa vuota (`RF-PUB-10`).

### 3.6 Forme delle entità

Ogni entità porta implicitamente `id: number` (`Int @id @default(autoincrement())`, come
tutta la fondazione), `createdAt`, `updatedAt`, `deleted: boolean` (soft delete). Sotto sono
elencati i soli campi propri. `?` = nullable. Ogni `…Id` è quindi un `number`.

**`Organization`** — `name`, `legalName`, `legalForm`, `vatNumber?`, `taxCode?`,
`addressId?`, `contactEmail`, `contactPhone?`, `website?`, `status: OrganizationStatus`,
`stripeAccountId?`, `payoutStatus: PayoutStatus`, `payoutCheckedAt?`, `termsVersion?`,
`termsAcceptedAt?`, `logoFileId?`

**`OrganizationMember`** — `organizationId`, `userId`, `role: OrgMemberRole`, `invitedAt`,
`acceptedAt?`. Unico su `(organizationId, userId, role)`.

**`FiscalDeclaration`** — `organizationId`, `eventId?`, `kind: FiscalDeclarationKind`,
`version: int`, `frameworkLabel`, `statementText`, `declaredAt`, `declaredByUserId`,
`ipAddress`. **Immutabile**: si crea una nuova versione, non si aggiorna (`RF-ORG-8`).

**`DancerProfile`** — `userId` (unico), `nickname` (unico), `preferredRole: PreferredDanceRole`,
`city?`, `languages: string[]`, `birthDate?`, `declaredLevel?`, `avatarFileId?`,
`nicknameChangedAt?`, `nicknameChangeCount: int`, `attributes: Json` (spazio per gli attributi
di ballo estensibili di fase 2).

**`EventType`** — `name: I18nText`, `slug` (unico), `capMultiSession: bool`,
`capRoleQuotas: bool`, `capLevels: bool`, `capCast: bool`, `capCouple: bool`,
`defaultTemplate: Json`, `active: bool`, `sortOrder: int`. Le cinque `cap*` **generano il
wizard** di creazione evento: nessuna sezione è disegnata caso per caso.

**`RequirementType`** — `name: I18nText`, `kind: RequirementKind`, `configSchema: Json`,
`active: bool`

**`ServiceType`** — `name: I18nText`, `attributesSchema: Json`, `active: bool`

**`RefundPolicy`** — `name: I18nText`, `tiers: Json` (`[{ daysBefore, percent }]`),
`transferDeadlineHours: int`, `feeRefundable: bool`, `isPlatformPreset: bool`,
`organizationId?`, `derivedFromPolicyId?`. Quest'ultimo punta al preset di piattaforma da
cui la policy discende ed è **ciò che rende verificabile** la regola «più favorevole al
partecipante, mai più restrittiva»: senza il riferimento, il confronto non ha un termine.

**`Venue`** — `organizationId?`, `name`, `addressId`, `latitude?`, `longitude?`, `capacity?`,
`floorNotes?`, `airConditioning: bool`, `parking: bool`, `accessibility?`, `notes?`

**`Event`** — `organizationId`, `eventTypeId`, `venueId`, `title: I18nText`, `slug` (unico),
`description: I18nText`, `startAt`, `endAt`, `contentLanguage`, `secondLanguage?`,
`tags: string[]`, `posterVerticalFileId?`, `posterHorizontalFileId?`, `posterSquareFileId?`,
`status: EventStatus`, `refundPolicyId?`, `refundPolicyText: I18nText`, `minorsAdmitted: bool`,
`minorsConditions: I18nText?`, `salesCloseAt?`, `salesCloseCriteria: SalesCloseCriterion[]`,
`manageExternalChannels: bool`, `publishedAt?`, `cancelledAt?`, `cancellationReason?`

**`Session`** — `eventId`, `name: I18nText`, `startAt`, `endAt`, `room?`, `level?`,
`allocationWeight: int` (peso di ripartizione, default uniforme — `RF-EVT-36`),
`isImplicit: bool`, `cancelledAt?`, `cancellationReason?`, `sortOrder: int`

**`Artist`** — `organizationId?`, `name`, `kind: ArtistKind`, `bio: I18nText?`,
`photoFileId?`, `website?`

**`EventCast`** — `eventId`, `artistId`, `kind: ArtistKind`, `sortOrder: int`

**`EventRequirement`** — `eventId`, `requirementTypeId`, `label: I18nText`, `text: I18nText`,
`mandatory: bool`, `blocking: RequirementBlocking`, `verification: RequirementVerification`,
`dueAt?`, `config: Json`, `sortOrder: int`

**`EventService`** — `eventId`, `serviceTypeId`, `name: I18nText`, `description: I18nText?`,
`price: int`, `refundCutoffAt?`, `attributesConfig: Json`, `sortOrder: int`

**`TicketType`** — `eventId`, `name: I18nText`, `description: I18nText?`, `basePrice: int`,
`saleUnit: SaleUnit`, `roleConstraint?: DanceRole`, `consumesRoleQuota: bool`,
`saleOpensAt?`, `saleClosesAt?`, `visibility: TicketTypeVisibility`, `accessCode?`,
`minPerOrder: int`, `maxPerOrder: int`, `indicatedLevel?`, `highlighted: bool`,
`sortOrder: int`

**`TicketTypeSession`** *(figlio posseduto)* — `ticketTypeId`, `sessionId`

**`PriceTier`** *(figlio posseduto)* — `ticketTypeId`, `kind: PriceTierKind`, `price: int`,
`validUntil?`, `maxQuantity?`, `soldQuantity: int`, `sortOrder: int`

**`CapacityQuota`** — `eventId`, `scope: QuotaScope`, `scopeId?`, `role?: DanceRole`,
`limit: int`, `consumed: int`, `limiting: bool`, `reservedFor?: QuotaReservedFor`,
`imbalanceTolerance?: int`, `overbookAllowance: int`, `publiclyVisible: bool`
- **Unico su `(eventId, scope, scopeId, role, reservedFor)`**, con semantica
  **`NULLS NOT DISTINCT`**. Due precisazioni che sembrano dettagli e non lo sono:
  - `reservedFor` **fa parte dell'identità**: il contingente accrediti è
    `quota(EVENT, null, reservedFor: COMPLIMENTARY)` e quello dei canali esterni è
    `EXTERNAL_CHANNEL` — senza `reservedFor` nella chiave collidono con la capienza
    della sala e non possono coesistere.
  - Con la semantica PostgreSQL di serie i `NULL` sono **distinti**, quindi due quote di
    capienza della sala (tutte le colonne a `NULL`) non entrerebbero in conflitto e una
    delle due non verrebbe mai applicata: capienza non controllata.
- `scopeId` non nullo per ogni `scope` diverso da `EVENT`.
- `role` valorizzabile **solo** su `scope ∈ {EVENT, SESSION}`.
- `consumed ≤ limit + overbookAllowance` **sempre**, anche in stato transitorio.
- Sulla quota di capienza della sala (`scope=EVENT, role=null`) `overbookAllowance` è
  **forzato a 0 e non modificabile**, e `limiting` è **forzato a `true`**. Lo stesso vale per
  le quote di ruolo di ambito `EVENT`.

**`QuotaConsumption`** — `capacityQuotaId`, `registrationId`, `quantity: int`.
**Unico su `(capacityQuotaId, registrationId)`** — è ciò che rende l'impegno idempotente.

**`Purchase`** — `buyerUserId`, `totalAmount: int`, `totalPresaleRights: int`

**`Order`** — `purchaseId`, `organizationId`, `eventId`, `status: OrderStatus`,
`subtotal: int`, `presaleRights: int`, `total: int`, `priceLockedAt`, `expiresAt?`,
`paidAt?`, `failedAt?`, `cancelledAt?`

**`OrderLine`** *(figlio posseduto)* — `orderId`, `ticketTypeId?`, `eventServiceId?`,
`quantity: int`, `unitPrice: int`, `presaleRightsPerUnit: int`, `lineTotal: int`,
`priceTierId?`, `attendees: Json` (`[{ name, surname, email, declaredRole, serviceAttributes }]`)

**`Reservation`** — `orderId`, `eventId`, `userId`, `expiresAt`, `rearmedAt?`,
`releasedAt?`, `releaseReason?: ReleaseReason`.
**Una sola prenotazione attiva per `(userId, eventId)`** (`RF-PAY-23`).

**`Payment`** — `orderId`, `provider: PaymentProvider`, `providerPaymentId`,
`providerAccountId`, `status: PaymentStatus`, `amount: int`, `applicationFeeAmount: int`,
`idempotencyKey` (unico), `processedEventIds: string[]`

**`Ticket`** — `orderLineId?`, `passIssuanceId?`, `eventId`, `ticketTypeId`,
`registrationId?`, `code` (unico), `status: TicketStatus`, `holderName`, `holderSurname`,
`holderEmail?`, `bearer: bool`, `qrIssuedAt`, `qrRevokedAt?`, `pdfFileId?`

**`TicketTransfer`** — `ticketId`, `fromUserId?`, `toUserId?`, `fromHolder: Json`,
`toHolder: Json`, `previousCode`, `transferredAt`

**`PassIssuance`** — `eventId`, `ticketTypeId`, `issuedByUserId`, `quantity: int`,
`reason: PassIssuanceReason`, `role?: DanceRole`, `nominal: bool`, `note?`, `issuedAt`,
`revokedAt?`

**`Registration`** — `eventId`, `personUserId?`, `holderName`, `holderSurname`,
`holderEmail`, `declaredRole: DeclaredDanceRole`, `assignedRole?: DanceRole`,
`channel: RegistrationChannel`, `status: RegistrationStatus`, `confirmedAt?`,
`declinedAt?`, `coupleId?`, `isMinor: bool`, `guardianUserId?`.
**Unico su `(eventId, personUserId)`** quando `personUserId` non è nullo — *una iscrizione
per persona per evento, con più biglietti collegati*.

**`Couple`** — `eventId`, `dissolvedAt?`. **Non porta riferimenti alle due iscrizioni**: sono
le `Registration` a puntare alla coppia con `coupleId`, così il grafo resta aciclico. Vincolo
di servizio: una `Couple` ha esattamente due `Registration` con ruoli assegnati
complementari.

**`RequirementOutcome`** — `registrationId`, `eventRequirementId`,
`status: RequirementOutcomeStatus`, `value: Json`, `acceptedAt?`, `acceptedIp?`,
`acceptedVersion?`, `reviewedByUserId?`, `reviewedAt?`, `rejectionReason?`

**`CheckIn`** — `ticketId`, `sessionId`, `registrationId`, `operatorUserId`,
`kind: CheckInKind`, `scannedAt`, `syncedAt?`, `deviceId`, `offline: bool`,
`conflictWithId?`, `revokedAt?`.
**Unico su `(ticketId, sessionId)`** quando `revokedAt` è nullo — `RB7`: *un QR vale una sola
volta per sessione*.

**`Refund`** — `orderId`, `registrationId?`, `ticketId?`, `amount: int`,
`presaleRightsRefunded: int`, `reason`, `status: RefundStatus`, `requestedAt`,
`approvedByUserId?`, `approvedAt?`, `executedAt?`, `providerRefundId?`, `failureReason?`,
`manualIban?`

### 3.7 Endpoint non-CRUD (elenco chiuso: non sono inferibili)

**Pubblici, senza autenticazione** — consumati dall'app `www` in SSR e dal polling:

| Endpoint | Restituisce |
|---|---|
| `GET /api/public/events/:slug` | scheda evento completa: sessioni, cast, titoli con disponibilità per ruolo, requisiti, servizi, policy di rimborso, organizzatore (`RF-PUB-5`, `RF-PUB-6`) |
| `POST /api/public/events/:id/availability` | `{ ticketTypes: [{ id, remaining, soldOut, roleOnHold, rolesOnHold: { leader, follower }, activeTier: { price, expiresAt?, remainingAtThisPrice? } }], roles: { leader, follower }, imbalance, imbalanceTolerance }` — **è la sorgente del polling a 10–15 s** (`RF-PUB-8`, `RF-EVT-26`). `roleOnHold` è il booleano di sintesi «questo titolo è bloccato per almeno un ruolo»; `rolesOnHold` dice **quale**, perché un titolo senza vincolo di ruolo può essere bloccato solo per i leader. `remaining` conta le sole quote `publiclyVisible`, ma **`soldOut` guarda tutte le quote limitanti**: nascondere un numero non può produrre un biglietto vendibile che non esiste |
| `POST /api/public/ticket-types/:id/unlock` body `{ accessCode }` | sblocca un titolo `CODE_RESTRICTED` (`RF-EVT-7`) |

**Ordine, prenotazione, pagamento:**

| Endpoint | Semantica |
|---|---|
| `POST /api/orders/reserve` body `{ eventId, lines[], attendees[] }` | **crea l'ordine, blocca il prezzo e impegna atomicamente la capienza** per 15 minuti. Restituisce `{ purchase, orders[], expiresAt }` oppure fallisce con uno dei codici di §3.3. Suddivide automaticamente il carrello in un ordine per organizzatore (`RF-PAY-34`) |
| `POST /api/orders/:id/rearm` | riarma la prenotazione ad almeno 10 minuti residui, all'avvio del pagamento (`RF-PAY-22`) |
| `POST /api/orders/:id/abandon` | rilascio immediato dell'impegno (`RF-PAY-24`) |
| `POST /api/orders/:id/checkout` | crea il PaymentIntent Stripe **sull'account connesso** con `application_fee_amount` → `{ clientSecret, publishableKey, connectedAccountId }` |
| `POST /api/payments/stripe/webhook` | **nessun JWT**, autenticato dalla firma Stripe. Idempotente su `event.id` (`RF-PAY-10`) |
| `POST /api/orders/:id/confirm-partial` body `{ removeLineIds[] }` | conferma esplicita dopo `PARTIAL_AVAILABILITY`, ricalcola il totale (`RF-PAY-15`, `RB17`) |
| `GET /api/orders/:id/receipt` | → `{ fileUrl }` — ricevuta all'acquirente. Come il PDF del biglietto, **non è un titolo fiscale**: nessuna numerazione progressiva (`RF-PAY-12`, `RF-TCK-11`) |

**Biglietti e check-in:**

| Endpoint | Semantica |
|---|---|
| `GET /api/tickets/:id/pdf` | → `{ fileUrl }` — conferma d'ordine con QR, **mai un titolo fiscale** (`RF-TCK-11`) |
| `POST /api/tickets/:id/transfer` body `{ emailOrNickname }` | trasferisce il nominativo: invalida il QR precedente, ne emette uno nuovo, sposta l'iscrizione e **rivaluta i requisiti**; rifiuta se le quote del nuovo ruolo non lo permettono (`RF-TCK-5→7`, `RB8`) |
| `POST /api/tickets/verify` body `{ code, sessionId }` | verifica online → `{ result: CheckInResult, registration, ticketType, sessions[], services[], blockingRequirement? }` |
| `GET /api/events/:id/checkin-manifest` | **lista firmata scaricabile** + chiave pubblica Ed25519 per la verifica offline (`RF-CHK-2`, `RF-CHK-3`) |
| `POST /api/check-ins/sync` body `{ entries[] }` | → `{ accepted[], conflicts[] }` — i doppi ingressi rilevati in sincronizzazione sono **restituiti come conflitti da risolvere, mai risolti in silenzio** (`RF-CHK-6`) |
| `POST /api/check-ins/:id/revoke` | annullamento di un check-in errato (`RF-CHK-9`) |
| `POST /api/events/:id/pass-issuances/bulk` | emissione manuale di pass, **senza vincolo di capienza** (`RF-TCK-14`, `RB20`) |

**Evento, ciclo di vita, back-office:**

| Endpoint | Semantica |
|---|---|
| `POST /api/events/:id/publish` | verifica `RB13` (organizzazione approvata **e abilitata all'incasso**) prima di pubblicare |
| `POST /api/events/:id/close-sales` · `/reopen-sales` · `/cancel` | `RF-EVT-40`, `RF-EVT-41` |
| `POST /api/events/:id/duplicate` | nuova edizione con vendite e iscrizioni azzerate (`RF-EVT-16`) |
| `POST /api/sessions/:id/cancel` body `{ reason }` | **annullamento di una singola sessione** su evento che si svolge regolarmente: rilascia le quote della sessione e restituisce i titoli che la includono con il loro peso di ripartizione, per la comunicazione ai soli interessati (`RF-EVT-35`, `RF-EVT-36`) |
| `GET /api/events/:id/dashboard` | venduto per titolo, incasso netto, **iscritti per ruolo e sbilancio corrente**, coppie complete, servizi venduti, requisiti mancanti, andamento (`RF-BKO-1`, `RF-CPL-11`). **`RB21` è realizzato nella forma, non a parole**: ogni sezione porta `available`, `basedOn` (le entità su cui è calcolata) e, se non calcolabile, `requires` + `reason`; in testa un blocco `perimeter` con `missingEntities`. Ciò che il motore registra è **impegnato**, non venduto né incassato: la sezione si chiama perciò `committedByTicketType`, e `soldByTicketType` esiste **vuota e motivata**, così il frontend non può scambiarle |
| `POST /api/events/:id/exports` body `{ kind, columns[] }` | → `{ fileUrl, fileId, kind, columns[], rows, generatedAt, basedOn[] }`. `kind ∈ { REGISTRATIONS, ORDERS, REVENUE, ATTENDANCE, SALES_BY_SESSION }`. `SALES_BY_SESSION` è `RF-BKO-9`, una delle tre condizioni che reggono il posizionamento fiscale. Le colonne sono un **elenco chiuso** che non contiene contatti oltre l'email del titolare, né contenuto dei requisiti, né diete o allergie (`RB12`); una colonna non ammessa è `400` con l'elenco delle valide. Un `kind` che dipende da entità non ancora costruite risponde **`501` con il motivo esplicito**, mai un tracciato vuoto che sembra un dato |
| `POST /api/ticket-types/:id/price-preview` | scaglione attivo e criterio di scadenza, con dati reali (`RF-EVT-26`) |
| `POST /api/events/:id/orphan-sessions/resolve` | gestisce la sessione aggiunta a evento pubblicato, distinguendo titoli venduti e invenduti (`RF-EVT-24`) |
| `GET /api/organizations/:id/payout-status` | cruscotto dello stato di incasso presso Stripe (`RF-ORG-12`) |
| `POST /api/refunds/:id/execute` | esegue il rimborso, **rilascia le quote e invalida il QR** (`RF-RMB-9`) |

**Iscrizione, ruolo, coppia** — esistono nel backend e ora sono dichiarati:

| Endpoint | Semantica |
|---|---|
| `POST /api/registrations/:id/reassign-role` body `{ role }` | riassegna il ruolo di un'iscrizione flessibile: **rilascia i consumi del vecchio ruolo e impegna quelli del nuovo nella stessa transazione**, con le stesse verifiche di un acquisto. Fallisce con `SOLD_OUT` o `ROLE_ON_HOLD` se il nuovo ruolo non ha capienza. Esiste perché `assignedRole` è **escluso dal `PATCH`**: non è un campo che il client possa scrivere (`RF-CPL-3`, `05` §7) |
| `POST /api/registrations/:id/confirm` · `POST /api/registrations/:id/decline` | conferma o rifiuto della persona iscritta da altri. Il rifiuto rende il biglietto **privo di titolare e lo restituisce alla disponibilità dell'acquirente** (`RF-CPL-13`, `RF-CPL-14`, `RB24`) |
| `POST /api/couples/:id/dissolve` | scioglie la coppia. **Non muove alcun consumo**: le persone restano, cambia solo il legame (`RF-CPL-9`) |
| `GET /api/capacity-quotas/events/:id/invariants` | verifica le invarianti del motore di capienza (`05` §12) su un evento e restituisce le violazioni. Strumento diagnostico dell'organizzatore, non un percorso d'uso |

**Upload binari** — sono l'unica eccezione al «niente `PUT`, niente multipart» del §3.2:

| Endpoint | Semantica |
|---|---|
| `POST /api/files/upload-image` `multipart/form-data` | → entità `File`. Alimenta i **tre ritagli della locandina** (`RF-EVT-3`: verticale per la scheda, orizzontale per la copertina, quadrato per la condivisione), la foto dell'artista e il logo dell'organizzazione. Il riferimento si scrive poi sull'entità con il suo `PATCH` (`posterVerticalFileId`, `photoFileId`, `logoFileId`) |
| `POST /api/files/upload-pdf` `multipart/form-data` | → entità `File`. Nel primo taglio non ha percorsi d'uso lato interfaccia: dichiarato per completezza |

### 3.8 Permessi e ruoli

Ruoli — insieme chiuso. **`GOD` è implicito allow-all e non è mai un ruolo dell'interfaccia.**

| Ruolo | Chi è |
|---|---|
| `GOD` | Super Admin di piattaforma |
| `OWNER` | Titolare dell'organizzazione |
| `EVENT_MANAGER` | Costruisce e **pubblica** gli eventi |
| `CHECKIN_OPERATOR` | Scansiona i QR all'ingresso |
| `DANCER` | Utente finale registrato |

**I ruoli sono assegnati per organizzazione, mai per singolo evento** (decisione dichiarata in
§7). Ogni rotta protetta porta una terna `ACTION#RESOURCE#SCOPE` con
`ACTION ∈ {CREATE, READ, UPDATE, DELETE, ACCEPT, EVERYTHING}` e
`SCOPE ∈ {ALL, SINGLE, OWN, OTHERS, TRASH, EVERYTHING}`.

| `PermissionResource` | `GOD` | `OWNER` | `EVENT_MANAGER` | `CHECKIN_OPERATOR` | `DANCER` |
|---|:-:|:-:|:-:|:-:|:-:|
| `ORGANIZATION` | ∀ | `READ`/`UPDATE#OWN` | `READ#OWN` | `READ#OWN` | – |
| `ORGANIZATION_MEMBER` | ∀ | ∀`#OWN` | `READ#OWN` | – | – |
| `FISCAL_DECLARATION` | ∀ | `CREATE`/`READ#OWN` | `CREATE`/`READ#OWN` | – | – |
| `DANCER_PROFILE` | ∀ | – | – | – | ∀`#OWN` |
| `ADDRESS` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ#ALL` |
| `FILE` | ∀ | `CREATE`/`READ#OWN` | `CREATE`/`READ#OWN` | `READ#OWN` | `CREATE`/`READ#OWN` |
| `EVENT_TYPE` · `REQUIREMENT_TYPE` · `SERVICE_TYPE` | ∀ | `READ#ALL` | `READ#ALL` | – | `READ#ALL` |
| `REFUND_POLICY` | ∀ | ∀`#OWN` | `READ#ALL` | – | `READ#ALL` |
| `VENUE` · `ARTIST` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ#ALL` |
| `EVENT` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ#ALL` |
| `SESSION` · `EVENT_CAST` · `EVENT_REQUIREMENT` · `EVENT_SERVICE` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ#ALL` |
| `TICKET_TYPE` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ#ALL` |
| `CAPACITY_QUOTA` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | – |
| `QUOTA_CONSUMPTION` | ∀ | `READ#OWN` | `READ#OWN` | – | – |
| `PURCHASE` · `ORDER` | ∀ | `READ#OWN` | `READ#OWN` | – | `CREATE`/`READ#OWN` |
| `RESERVATION` | ∀ | `READ#OWN` | `READ#OWN` | – | `CREATE`/`READ`/`DELETE#OWN` |
| `PAYMENT` | ∀ | `READ#OWN` | – | – | `READ#OWN` |
| `TICKET` | ∀ | `READ`/`UPDATE#OWN` | `READ`/`UPDATE#OWN` | `READ#OWN` | `READ`/`UPDATE#OWN` |
| `TICKET_TRANSFER` | ∀ | `READ#OWN` | `READ#OWN` | – | `CREATE`/`READ#OWN` |
| `PASS_ISSUANCE` | ∀ | ∀`#OWN` | ∀`#OWN` | – | – |
| `REGISTRATION` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `READ`/`UPDATE#OWN` |
| `COUPLE` | ∀ | ∀`#OWN` | ∀`#OWN` | – | `READ#OWN` |
| `REQUIREMENT_OUTCOME` | ∀ | ∀`#OWN` | ∀`#OWN` | `READ#OWN` | `CREATE`/`READ`/`UPDATE#OWN` |
| `CHECK_IN` | ∀ | ∀`#OWN` | ∀`#OWN` | `CREATE`/`READ`/`UPDATE#OWN` | – |
| `REFUND` | ∀ | ∀`#OWN` | `READ#OWN` | – | `READ#OWN` |

*Legenda*: `∀` = `EVERYTHING#…#EVERYTHING` · `#OWN` = limitato alle righe dell'organizzazione
di cui l'utente è membro (per lo staff) o alle proprie (per il `DANCER`) · `–` = nessun
accesso.

**Due note che valgono come vincolo, non come commento.**

1. **`#OWN` per lo staff significa "dell'organizzazione di cui sono membro"**, e l'isolamento
   fra organizzazioni si ottiene con un **filtro `organizationId` obbligatorio nel repository**,
   non solo con il controllo di permesso in controller. Un `OWNER` non deve poter leggere
   nemmeno un conteggio aggregato di un'altra organizzazione.
2. **`EVENT_MANAGER` pubblica da solo** (`POST /events/:id/publish` è concesso), ma la
   `FiscalDeclaration` di tipo `EVENT_ATTESTATION` che la pubblicazione richiede è registrata
   a nome dell'utente che compie l'atto.

### 3.9 Eventi WebSocket

Il modulo `websocket` di keijo-be è **attivo**. Il frontend si collega a `WS_URL/<wsCode>`,
dove `wsCode` arriva da `GET /auth/profile`. Ogni frame è un **`EventEnvelope`**:

```ts
{ messageId, timestamp, source?, event, payload }
```

**Semantica: notifica e trigger di refetch, non canale di dati di dominio.** Alla ricezione il
frontend **rifà la chiamata REST** e aggiorna lo store. Il payload porta il minimo necessario a
decidere *se* ricaricare e *cosa*.

| `event` | Payload | Destinatari |
|---|---|---|
| `event/availability-changed` | `{ eventId, organizationId }` | `sendToUser` a ogni membro attivo dell'organizzazione. **Aggregato con finestra di ~1,5 s** |
| `registration/created` | `{ eventId, organizationId, registrationId }` | `sendToUser` ai membri dell'organizzazione |
| `checkin/registered` | `{ eventId, organizationId, sessionId }` | `sendToUser` ai membri dell'organizzazione. **Immediato, non aggregato** |
| `order/reservation-expired` | `{ orderId, eventId }` | `sendToUser` all'acquirente |
| `payment/succeeded` | `{ purchaseId, orderId }` | `sendToUser` all'acquirente |
| `ticket/transferred` | `{ ticketId, eventId }` | `sendToUser` a entrambe le parti e ai membri dell'organizzazione |

**Targeting.** Si usa **solo `sendToUser` per `wsCode`**, mai `broadcastToRoles` né
`broadcastAll`: un broadcast per ruolo farebbe arrivare a ogni `OWNER` della piattaforma i
segnali delle organizzazioni altrui, che è esattamente l'isolamento che il prodotto deve
garantire. Il backend risolve i membri dell'organizzazione e invia a ciascuno.

**Il publish avviene dopo il commit**, mai dentro la transazione di impegno della capienza:
un Redis lento non deve mai rallentare una vendita.

**Il visitatore anonimo non ha WebSocket** — il canale keijo richiede il `wsCode` del profilo.
La scheda evento pubblica usa il **polling a 10–15 secondi** su
`POST /api/public/events/:id/availability`.

### 3.10 Note di aderenza al template `@keijo/create-be@0.2.5`

Verificate sul template scaffoldato in `backend/`. **Leggile prima di scrivere codice**:
tre di esse contraddicono qualcosa che troverai nel progetto.

1. **Il verbo della sub-risorsa è `PATCH`, non `PUT`.** La regola 12 di
   `.claude/rules/controllers.md` prescrive `PUT /<parents>/:id/<children>`, ma
   **l'implementazione di riferimento del template usa `@PATCH("/:id/roles")`**
   (`UserController.ts`), e la skill `new-controller` elenca `PATCH` fra i verbi da
   scaffoldare. **Vale `PATCH`**, come dichiarato in §3.2. `PUT` resta riservato agli
   upload binari/multipart (`@PUT("/:id/logo")`). *Contraddizione interna del template,
   segnalata al committente.*

2. **Gli identificativi sono `Int` autoincrement**, non stringhe né cuid — così è tutta la
   fondazione. Nel percorso arrivano come stringa (`exz.pathId` è `z.string()`) e i
   controller li convertono con `+req.params.id`. Negli array di sub-risorsa
   `id: -1` indica una riga nuova.

3. **`RoleName` è un enum Prisma, non una tabella di ruoli.** Oggi vale
   `GOD | ADMIN | USER`. I cinque ruoli del §3.8 richiedono quindi **una modifica
   dell'enum nello schema e una migrazione**, non solo righe di seed. `Role` è la tabella
   che porta `label` e `rank` e si aggancia all'enum; le concessioni stanno in
   `PermissionConfig(action, entity, scope, roleName)`.

4. **`PermissionResource.EVENT` esiste già** nell'enum del template
   (`src/stack/enums/PermissionResource.ts`): va riusato, non ridefinito. I restanti
   `PermissionResource` del §1.4 vanno aggiunti a quell'enum.

5. **La fondazione presente è**: `User`, `Person`, `Contact`, `Address`, `Role`,
   `RoleToUser`, `PermissionConfig`, `HiddenComponentConfig`, `Log`, `Config`, `File`,
   `PersonFile`. Non esiste un modello `Permission` a sé: è `PermissionConfig`.
   `User.wsCode` è già presente ed è quello del §3.1.

6. **Ogni scrittura multipla — anche sulla stessa entità — sta in un `$transaction`**
   aperto nel service con `getPrismaClient()`, e ogni metodo di repository che scrive
   accetta un `tx?` opzionale. Non è una raccomandazione: è la regola 1 di
   `.claude/rules/transactions.md`, e il motore di capienza ci si appoggia interamente.

7. **`fastify-cron` è già in dipendenza** e il template espone un `CronController` con una
   rotta POST per job: lo scheduler delle prenotazioni scadute (§3.7) si costruisce lì,
   non con un processo esterno.

8. **Il controllo dei permessi è un confronto per stringa esatta, senza jolly.**
   `hasPermission` (`src/utils/adapters/permission.ts`) costruisce
   `ACTION#RESOURCE#SCOPE` e verifica l'appartenenza all'elenco delle concessioni del
   ruolo; l'unica eccezione è `GOD`, in corto circuito. Ne discendono **due
   conseguenze vincolanti**, che valgono anche per il frontend:

   - `EVERYTHING#X#EVERYTHING` **non** soddisfa una rotta che dichiara `CREATE#X#ALL`. Le
     rotte dichiarano le **terne canoniche del dialetto** (`CREATE#ALL`, `READ#SINGLE`,
     `READ#ALL`, `UPDATE#SINGLE`, `DELETE#SINGLE`) e **il seed espande ogni cella della
     matrice §3.8 nelle terne che essa autorizza**.
   - **Lo scope `#OWN` non è realizzato dalla stringa di permesso**, perché una stessa
     rotta non può chiedere scope diversi a ruoli diversi. `#OWN` è realizzato dal
     **filtro `organizationId` obbligatorio nei finder** — che è ciò che la nota 1 del
     §3.8 e il §1.5 già dichiaravano come meccanismo primario. **La matrice §3.8 va quindi
     letta come la dichiarazione di *chi può fare cosa*, non come la stringa letterale
     seminata.**

---
## §4 — Specifiche di feature, una per rotta

> Ogni `api_endpoints` sotto **risolve nel §3**. Le azioni di riga e di testata rispettano
> `KEIJO-ROW-ACTIONS-ORDER`, `KEIJO-ROW-ACTIONS-NO-FILL-GAP`,
> `KEIJO-HEADER-PRIMARY-IS-ENTITY-CRUD` e `KEIJO-HEADER-ONLY-PRIMARY-LABELLED`: qui è
> dichiarato **quali** azioni esistono e quale è la primaria, l'ordinamento e l'etichettatura
> li applica la skill.

### 4.1 `/dashboard` — Cruscotto

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/dashboard` | `dashboard` | selettore evento; venduto per titolo (nome, venduti, residui, incasso); **iscritti per ruolo** (leader, follower, sbilancio corrente, tolleranza configurata); coppie complete; presenze in tempo reale con soglia di capienza; requisiti mancanti; andamento vendite nel tempo; stato di abilitazione all'incasso | primaria di testata: **Crea evento** (→ `/events/new`). Secondarie non etichettate: aggiorna · esporta riepilogo |

**`business_logic`**

- `validations` — nessun input.
- `flows`
  1. All'ingresso si carica l'elenco degli eventi dell'organizzazione in stato
     `PUBLISHED | SALES_CLOSED | RUNNING` e si seleziona il più imminente.
  2. Il cruscotto si sottoscrive agli eventi WebSocket `event/availability-changed`,
     `registration/created` e `checkin/registered` (§3.9). **Alla ricezione rifà la GET**,
     non legge i dati dal frame.
  3. Lo sbilancio è mostrato **con il segno e con la tolleranza a fianco**: `+4 leader
     (tolleranza 5)`. Quando lo sbilancio raggiunge la tolleranza, il ruolo in eccesso è
     marcato «in attesa», mai «esaurito» — sono due stati opposti (`RF-PAY-17`).
  4. **Ogni numero dichiara su quali dati è calcolato** (`RB21`). Se l'evento ha
     `manageExternalChannels = false`, sotto ai conteggi compare la dicitura «solo vendite
     online»: un conteggio parziale presentato come completo è peggio di nessun conteggio.
- `api_endpoints` — `GET /events/:id/dashboard` · `POST /events/` (selettore) ·
  `GET /organizations/:id/payout-status`
- `shared_state` — store `event` (evento selezionato, condiviso con tutte le altre rotte),
  store `dashboard`.

**`cross_dependencies`** — `/events` (selezione evento), `/registrations`, `/check-in`.

---

### 4.2 `/events` — Eventi *(il workspace di costruzione)*

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/events` | `list+filters` | titolo, tipo evento, location, date, stato, venduto/capienza, sbilancio ruoli | primaria: **Crea evento**. Riga: apri · modifica · duplica · pubblica/chiudi vendite · annulla · elimina |
| `/events/:id` | `entity-management` | dati base: titolo, tipo, descrizione, date, location, lingua contenuti + seconda lingua, tag, tre ritagli della locandina, ammissione minori con condizioni, criteri di chiusura vendita, gestione canali esterni | primaria: **Salva**. Secondarie: anteprima pubblica · pubblica · chiudi/riapri vendite · annulla evento · duplica |
| `/events/:id/sessions` | `list+filters` | nome, orario, sala, livello, **peso di ripartizione**, cast, stato (attiva/annullata) | primaria: **Aggiungi sessione**. Riga: modifica · annulla sessione · elimina |
| `/events/:id/cast` | `list+filters` | artista, tipo (maestro/DJ/orchestra), ordine | primaria: **Aggiungi al cast**. Riga: modifica · rimuovi |
| `/events/:id/ticket-types` | `entity-management` | nome, descrizione, prezzo base, **unità di vendita** (per persona / per coppia), vincolo di ruolo, consuma quote di ruolo sì/no, finestra di vendita, visibilità + codice, min/max per ordine, livello indicato, evidenza | primaria: **Crea titolo**. Riga: modifica · **sessioni incluse** · **scaglioni di prezzo** · duplica · elimina |
| `/events/:id/ticket-types/:ttId/sessions` | `custom` | elenco esplicito delle sessioni incluse, con selettori rapidi *tutti i workshop · tutto il sabato · tutte le milonghe* | primaria: **Salva elenco**. Secondarie: applica selettore rapido · svuota |
| `/events/:id/ticket-types/:ttId/price-tiers` | `list+filters` | tipo (a data / a quantità / combinato), prezzo, valido fino a, quantità massima, venduti | primaria: **Aggiungi scaglione**. Riga: modifica · elimina |
| `/events/:id/quotas` | `list+filters` | ambito (evento/sessione/titolo/servizio), oggetto, ruolo, limite, consumato, residuo, **limitante**, riservata a, tolleranza sbilancio, sforamento ammesso, visibile al pubblico | primaria: **Crea quota**. Riga: modifica · elimina |
| `/events/:id/requirements` | `list+filters` | tipo, etichetta, testo, obbligatorio, quando blocca, verifica, scadenza | primaria: **Aggiungi requisito**. Riga: modifica · elimina |
| `/events/:id/services` | `list+filters` | tipo servizio, nome, prezzo, cut-off di rimborso, attributi raccolti | primaria: **Aggiungi servizio**. Riga: modifica · elimina |

**`business_logic`**

- `validations`
  - Le sezioni visibili di `/events/:id` **sono generate dalle cinque capacità del
    `EventType`** (`capMultiSession`, `capRoleQuotas`, `capLevels`, `capCast`, `capCouple`).
    Un tipo evento senza sessioni multiple non mostra la scheda Sessioni. Questo è il
    requisito, non un'ottimizzazione: rischio `R9` dichiarato, mitigato dai modelli
    precompilati.
  - Un `TicketType` con `saleUnit = PER_COUPLE` **non è acquistabile da solo**: l'editor
    avvisa che senza un titolo per persona i ballerini singoli restano fuori (`T5`).
  - `roleConstraint` e `consumesRoleQuota = false` sono incompatibili: un titolo che non
    consuma quote di ruolo (accompagnatore, spettatore) non può essere riservato a un ruolo.
  - Sulla quota di ambito `EVENT` con `role = null` (capienza della sala) i campi
    `overbookAllowance` e `limiting` sono **mostrati e disabilitati**, con la spiegazione:
    è un vincolo di sicurezza, non una scelta commerciale.
  - `imbalanceTolerance` è valorizzabile **solo sulle quote di ruolo appaiate dello stesso
    ambito**, e le due devono essere coerenti.
  - La pubblicazione è rifiutata se l'organizzazione non è `APPROVED` **e**
    `payoutStatus ≠ ENABLED` (`RB13`): il messaggio dice quale dei due manca e come si
    risolve, non «errore».
- `flows`
  1. **Composizione delle sessioni incluse**: i selettori rapidi producono comunque un
     **elenco esplicito e modificabile**, mai una regola. La potenza sta nell'editor, non nel
     modello.
  2. **Sessione orfana** (`RF-EVT-24`): aggiungendo una sessione a evento pubblicato il
     sistema segnala i titoli che non la includono, **distinguendo i venduti dagli
     invenduti**. Sui venduti l'aggiunta è ammessa solo come miglioria, mai come sottrazione:
     l'interfaccia non offre nemmeno l'opzione di togliere.
  3. **Sessione limitante e satura inclusa in un titolo** (`RF-EVT-21`): si propongono tre
     strade — aumentare la quota, dichiarare la sessione non limitante, pubblicare una
     variante di titolo che non la include.
  4. **Abbassamento del totale posti** (`RF-EVT-33`): consentito **anche sotto il venduto**.
     Il dialogo di conferma dice esattamente cosa succede: si chiude la vendita online,
     **nessun biglietto già emesso viene invalidato** (`RB18`).
  5. **Annullamento di una sessione** (`RF-EVT-35`): richiede motivazione, mostra quanti
     titoli la includono e quale peso di ripartizione ha, e rilascia le quote della sessione.
  6. **Anteprima pubblica** prima della pubblicazione (`RF-EVT-14`): apre la scheda come la
     vedrà il pubblico su `www`.
- `api_endpoints` — CRUD §3.4 di `Event`, `Session`, `EventCast`, `TicketType`,
  `CapacityQuota`, `EventRequirement`, `EventService` · `PATCH /ticket-types/:id/sessions` ·
  `PATCH /ticket-types/:id/price-tiers` · `POST /events/:id/publish` ·
  `POST /events/:id/close-sales` · `POST /events/:id/reopen-sales` ·
  `POST /events/:id/cancel` · `POST /events/:id/duplicate` ·
  `POST /events/:id/orphan-sessions/resolve` · `POST /ticket-types/:id/price-preview`
- `shared_state` — store per entità (`event`, `session`, `ticketType`, `capacityQuota`,
  `eventRequirement`, `eventService`), più lo store `event` come contesto corrente.

**`cross_dependencies`** — `/directory` (location e artisti riutilizzabili), `/platform`
(cataloghi), `/dashboard`.

---

### 4.3 `/registrations` — Iscritti

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/registrations` | `list+filters` | nome, cognome, email, **ruolo dichiarato e ruolo assegnato**, canale, stato, coppia, titoli posseduti, esiti dei requisiti, check-in effettuati | primaria: **Aggiungi iscritto** (ingresso da canale esterno, `RF-CHK-15`). Riga: apri · modifica ruolo · sciogli coppia · esporta |
| `/registrations/:id` | `entity-management` | scheda completa: dati anagrafici, ruolo, ordine di provenienza, biglietti, servizi acquistati con attributi, esiti dei requisiti, check-in per sessione, storico | primaria: **Salva**. Secondarie: riassegna ruolo flessibile · approva/rifiuta requisito · apri l'ordine |

**`business_logic`**

- `validations`
  - Il **ruolo dichiarato** e il **ruolo assegnato** sono mostrati **come due colonne
    distinte**, mai fuse: serve a spiegare all'iscritto perché è stato messo tra i follower.
  - La riassegnazione manuale di un flessibile passa dalle **stesse verifiche di un
    acquisto**: rilascia i consumi del vecchio ruolo e impegna quelli del nuovo, e fallisce
    con `SOLD_OUT` o `ROLE_ON_HOLD` se il nuovo ruolo non ha capienza.
- `flows`
  1. Filtri per titolo, ruolo, stato dei requisiti, presenza al check-in, canale.
  2. Lo staff vede **l'esito** del requisito (`VALID` / `REJECTED` / …), non il contenuto
     dei campi custom che non gli servono (`RB12`).
  3. **Diete e allergie** raccolte per i pasti sono mostrate solo nelle liste operative di
     `/reports` e mai nella vista di check-in né nelle esportazioni generiche.
- `api_endpoints` — CRUD di `Registration`, `RequirementOutcome`, `Couple` ·
  `POST /events/:id/exports`
- `shared_state` — store `registration`, `requirementOutcome`, `couple`.

**`cross_dependencies`** — `/events` (quote e titoli), `/tickets`, `/check-in`, `/reports`.

---

### 4.4 `/tickets` — Biglietti

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/tickets` | `list+filters` | codice, titolare, titolo d'ingresso, stato, al portatore sì/no, emesso il, canale | primaria: **Emetti pass manualmente**. Riga: apri · scarica PDF · trasferisci · revoca |
| `/tickets/:id` | `entity-management` | dettaglio, sessioni incluse, servizi, iscrizione collegata, check-in, **storico completo dei passaggi di titolarità** | primaria: **Salva**. Secondarie: scarica PDF · trasferisci · revoca |
| `/tickets/issue` | `form-standalone` | titolo, quantità, causale (accredito / vendita esterna / omaggio / cortesia), **ruolo di ballo**, nominativo o al portatore, nota | primaria: **Emetti**. Secondaria: annulla |

**`business_logic`**

- `validations`
  - L'emissione manuale **non è mai bloccata dalle quote** (`RB20`, `RF-TCK-14`): se il
    numero supera la capienza della sala compare un **avviso ben visibile e nessun blocco**.
    La responsabilità della sala è dell'organizzatore.
  - Se l'evento usa quote per ruolo, il **ruolo di ballo è obbligatorio** all'emissione
    (`RF-TCK-15`): senza quel dato l'equilibrio leader/follower mostrato all'organizzatore
    diventa falso proprio dove serve.
  - I pass emessi in blocco senza nominativo sono **al portatore**: il form lo dichiara al
    momento dell'emissione e ricorda che non sono trasferibili.
- `flows`
  1. Il **trasferimento** invalida il QR precedente, ne emette uno nuovo, sposta
     l'iscrizione e **rivaluta i requisiti** sul nuovo titolare (`RB8`). Se il nuovo titolare
     ha un ruolo diverso, il trasferimento riesce solo se le quote del nuovo ruolo lo
     permettono, e il messaggio di rifiuto lo dice.
  2. L'interfaccia dichiara con chiarezza che **la regolazione economica del trasferimento
     è tra i due ballerini, fuori dalla piattaforma** (`RF-TCK-9`).
- `api_endpoints` — CRUD di `Ticket`, `PassIssuance` · `GET /tickets/:id/pdf` ·
  `POST /tickets/:id/transfer` · `POST /events/:id/pass-issuances/bulk` ·
  elenco di `TicketTransfer`
- `shared_state` — store `ticket`, `passIssuance`, `ticketTransfer`.

**`cross_dependencies`** — `/registrations`, `/orders`, `/check-in`.

---

### 4.5 `/orders` — Ordini

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/orders` | `list+filters` | numero, acquirente, evento, righe, imponibile, **diritti di prevendita**, totale, stato, pagamento, data | primaria: **nessuna creazione** — gli ordini nascono su `www`. Riga: apri · scarica ricevuta · avvia rimborso |
| `/orders/:id` | `entity-management` | righe con titolo/servizio, partecipanti, prezzo bloccato e scaglione applicato, pagamento con riferimento Stripe, biglietti emessi, rimborsi | primaria: **Salva nota**. Secondarie: scarica ricevuta · avvia rimborso · apri su Stripe |
| `/orders/reservations` | `list+filters` | utente, evento, scadenza, riarmata il, rilasciata il, motivo del rilascio | primaria: nessuna. Riga: rilascia manualmente |
| `/orders/refunds` | `list+filters` | ordine, iscrizione, importo, diritti di prevendita rimborsati, motivo, stato, richiesto il, approvato da | primaria: **Registra rimborso**. Riga: apri · approva · esegui · segna come fallito |

**`business_logic`**

- `validations`
  - **Il rimborso è riservato all'`OWNER`** (decisione §7): per `EVENT_MANAGER` le azioni di
    rimborso non compaiono, non compaiono disabilitate.
  - Il form di rimborso espone come parametro **se i diritti di prevendita vengono
    restituiti**: default *no* quando la rinuncia dipende dal partecipante, *sì* quando la
    causa è dell'organizzatore o della piattaforma (`03` §1).
- `flows`
  1. `/orders` è **sola consultazione più rimborso**: nel primo taglio il motore di
     scaglioni non c'è e il rimborso è **registrato a mano**, ma passa comunque dal sistema —
     nessun rimborso in contanti fuori dal sistema (`03` §1 punto 4).
  2. L'esecuzione del rimborso **rilascia le quote e invalida il QR** (`RF-RMB-9`): il
     dialogo di conferma lo dichiara prima, non dopo.
  3. La vista **Prenotazioni** esiste per un motivo operativo preciso: in apertura vendite
     gli ordini abbandonati sottraggono posti fino alla scadenza (`R1b`), e l'organizzatore
     deve poter vedere quanti sono.
- `api_endpoints` — elenco/lettura di `Purchase`, `Order`, `Payment`, `Reservation` · CRUD di
  `Refund` · `GET /orders/:id/receipt` · `POST /refunds/:id/execute` ·
  `POST /orders/:id/abandon`
- `shared_state` — store `order`, `payment`, `reservation`, `refund`.

**`cross_dependencies`** — `/tickets`, `/registrations`, `/reports`.

---

### 4.6 `/check-in` — Check-in *(offline-first)*

> È la superficie più delicata dell'applicazione: funziona in una sala senza rete, in mano a
> un volontario, con una coda alle spalle. NFR: esito entro **1 secondo, anche offline**.

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/check-in` | `custom` | selettore evento e **sessione**, stato della lista scaricata (quanti record, quando), stato rete, elementi in coda da sincronizzare, contatore presenze con soglia | primaria: **Scarica lista**. Secondarie: sincronizza ora · cambia sessione · apri scanner |
| `/check-in/scan` | `custom` | inquadratura fotocamera; a esito: **nominativo, ruolo di ballo, titolo, sessioni incluse, servizi acquistati** | primaria: **Scansiona**. Secondarie: ricerca manuale · annulla ultimo check-in |
| `/check-in/search` | `list+filters` | nome, cognome, email, ruolo, titolo, già entrato per questa sessione | primaria: **Registra ingresso**. Riga: registra ingresso · apri iscrizione |
| `/check-in/conflicts` | `list+filters` | biglietto, sessione, i due ingressi in conflitto con ora e postazione, operatori coinvolti | primaria: nessuna. Riga: mantieni il primo · mantieni il secondo · annulla entrambi |

**`business_logic`**

- `validations`
  - **Cinque esiti distinti e inequivocabili** (`RF-CHK-4`), ciascuno con il proprio colore e
    la propria formulazione: `VALID` · `ALREADY_USED` **per questa sessione** (con ora e
    postazione del primo ingresso) · `WRONG_EVENT` · `REFUNDED_OR_CANCELLED` ·
    `REQUIREMENT_BLOCKED` (**con il nome del requisito che manca**).
  - La verifica offline controlla **la firma Ed25519 del QR** e l'appartenenza alla lista
    locale. Un QR non verificabile non è mai accettato «per sicurezza».
- `flows`
  1. **Prima dell'evento** l'operatore scarica la lista: manifest firmato + chiave pubblica,
     salvati in IndexedDB.
  2. **Senza rete** si verifica la firma, si controlla la lista locale, si accoda l'ingresso
     e si mostra l'esito. La coda **sopravvive alla chiusura del browser e all'esaurimento
     della batteria**: è un NFR, non una gentilezza.
  3. **Al ritorno della rete** si sincronizza. I doppi ingressi rilevati sono **segnalati
     come conflitti da risolvere in `/check-in/conflicts`, mai risolti in silenzio**
     (`RF-CHK-6`). Nessuna libreria lo fa di serie: è codice su misura.
  4. Il **contatore presenze** è un asse distinto dalle quote: il check-in non consuma
     capienza (`RB19`).
  5. `/check-in` è l'unica rotta visibile al `CHECKIN_OPERATOR` insieme a `/registrations`
     in sola lettura: il volontario deve vedere il minimo indispensabile — nome, ruolo,
     titolo — e **mai** contatti o dati dei requisiti (`RB12`, minimizzazione).
- `api_endpoints` — `GET /events/:id/checkin-manifest` · `POST /check-ins/sync` ·
  `POST /tickets/verify` · `POST /check-ins/create` · `POST /check-ins/:id/revoke` ·
  `POST /registrations/create` (ingresso da canale esterno)
- `shared_state` — store `checkIn` con **persistenza IndexedDB** e coda di sincronizzazione;
  store `event` per la sessione corrente.

**`cross_dependencies`** — `/registrations`, `/tickets`, `/dashboard` (contatore presenze).

---

### 4.7 `/reports` — Report

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/reports` | `dashboard` | riepilogo economico dell'evento: incassato per metodo, rimborsato, netto, diritti di prevendita maturati, incasso alla porta | primaria: **Esporta**. Secondarie: cambia evento · aggiorna |
| `/reports/exports` | `form-standalone` | tipo di esportazione (iscritti · ordini · incassi · presenze · **vendite con dettaglio per sessione**), selezione delle colonne, filtri | primaria: **Genera CSV**. Secondaria: annulla |
| `/reports/operational-lists` | `list+filters` | liste stampabili: elenco per ruolo, elenco pasti **con diete**, elenco taglie, elenco slot | primaria: **Stampa**. Riga: stampa · esporta |

**`business_logic`**

- `validations` — nessuna.
- `flows`
  1. L'esportazione **vendite con dettaglio per titolo e per sessione** (`RF-BKO-9`) non è
     una comodità: è **una delle tre condizioni che reggono il posizionamento fiscale** della
     piattaforma. Senza di essa il posizionamento è uno scarico di responsabilità; con essa è
     una divisione di compiti. Non va tagliata né semplificata.
  2. Le liste operative sono **l'unico posto** dove compaiono diete e allergie, con accesso
     ristretto e nessuna comparsa nelle esportazioni generiche.
  3. Ogni report dichiara su quali dati è calcolato (`RB21`).
- `api_endpoints` — `POST /events/:id/exports` · `GET /events/:id/dashboard` ·
  elenco di `Order`, `Payment`, `Refund`
- `shared_state` — store `event`, store `report`.

**`cross_dependencies`** — `/orders`, `/registrations`, `/dashboard`.

---

### 4.8 `/directory` — Anagrafiche

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/directory/venues` | `entity-management` | nome, indirizzo, coordinate, **capienza**, note su pavimento, climatizzazione, parcheggio, accessibilità | primaria: **Crea location**. Riga: apri · modifica · elimina |
| `/directory/artists` | `entity-management` | nome, tipo (maestro / DJ / orchestra), biografia, foto, sito | primaria: **Crea artista**. Riga: apri · modifica · elimina |

**`business_logic`**

- `validations` — la `capacity` della location è **proposta come default** alla creazione
  della quota di capienza della sala, **mai imposta** (`05` §4: assenza di quota significa
  assenza di vincolo).
- `flows` — location e artisti sono riutilizzabili tra eventi; gli artisti **non hanno
  account** (`RF-EVT-6`), sono anagrafica.
- `api_endpoints` — CRUD di `Venue` e `Artist`
- `shared_state` — store `venue`, `artist`.

**`cross_dependencies`** — `/events`.

---

### 4.9 `/organization` — Organizzazione

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/organization` | `entity-management` | denominazione, forma giuridica, partita IVA o codice fiscale, sede, referente, sito, logo, versione e data di accettazione delle condizioni | primaria: **Salva**. Secondarie: collega account di incasso · scarica condizioni accettate |
| `/organization/payout` | `dashboard` | **stato di abilitazione all'incasso**, ultimo controllo, eventuali fondi in attesa presso il prestatore, **azioni richieste** con l'indicazione dell'adempimento mancante | primaria: **Verifica ora**. Secondaria: apri Stripe |
| `/organization/fiscal` | `list+filters` | dichiarazioni di inquadramento: versione, testo, data, autore, evento a cui si riferisce | primaria: **Nuova dichiarazione**. Riga: apri (sola lettura) |
| `/organization/members` | `list+filters` | utente, ruolo, invitato il, accettato il | primaria: **Invita membro**. Riga: cambia ruolo · rimuovi |
| `/organization/refund-policies` | `entity-management` | nome, scaglioni, termine per il trasferimento, diritti di prevendita rimborsabili | primaria: **Crea policy**. Riga: modifica · elimina |

**`business_logic`**

- `validations`
  - La `FiscalDeclaration` è **immutabile**: l'interfaccia non offre modifica, solo nuova
    versione (`RF-ORG-8`).
  - Una policy di rimborso derivata da un preset di piattaforma può essere resa **più
    favorevole al partecipante, mai più restrittiva**: il form valida le percentuali contro
    il preset.
- `flows`
  1. `/organization/payout` è in evidenza perché la decadenza dell'abilitazione **sospende
     la vendita** (`RF-ORG-11`), e l'Owner deve capire in un colpo d'occhio quale
     adempimento manca presso Stripe. **I biglietti già emessi restano validi e i rimborsi
     restano eseguibili**: l'interfaccia lo dice esplicitamente, altrimenti il messaggio
     spaventa più del dovuto.
  2. La pubblicazione del primo evento richiede l'abilitazione piena (`RF-ORG-10`, `RB13`).
- `api_endpoints` — CRUD di `Organization`, `OrganizationMember`, `RefundPolicy` · creazione
  e lettura di `FiscalDeclaration` · `GET /organizations/:id/payout-status`
- `shared_state` — store `organization`, `organizationMember`, `fiscalDeclaration`,
  `refundPolicy`.

**`cross_dependencies`** — `/events` (pubblicazione), `/orders` (rimborsi).

---

### 4.10 `/platform` — Piattaforma *(solo `GOD`)*

**Pagine**

| `path` | `page_category` | `data_model_fields` | `actions` |
|---|---|---|---|
| `/platform/event-types` | `entity-management` | nome, slug, **le cinque capacità**, template di default, attivo, ordine | primaria: **Crea tipo evento**. Riga: modifica · attiva/disattiva · elimina |
| `/platform/requirement-types` | `entity-management` | nome, genere (dichiarazione / campo custom), schema di configurazione, attivo | primaria: **Crea tipo requisito**. Riga: modifica · elimina |
| `/platform/service-types` | `entity-management` | nome, schema degli attributi raccolti, attivo | primaria: **Crea tipo servizio**. Riga: modifica · elimina |
| `/platform/refund-presets` | `entity-management` | nome, scaglioni, termine di trasferimento, diritti rimborsabili | primaria: **Crea preset**. Riga: modifica · elimina |
| `/platform/organizations` | `list+filters` | denominazione, stato, stato di incasso, eventi pubblicati, venduto | primaria: **Crea organizzazione**. Riga: apri · sospendi · riattiva |

**`business_logic`**

- `validations` — creare o modificare un `EventType` significa **cambiare il wizard** che gli
  organizzatori incontrano: l'editor lo dichiara e mostra un'anteprima delle sezioni attivate
  dalle cinque capacità.
- `flows`
  1. Nel primo taglio **le organizzazioni sono create a mano dal Super Admin**: non c'è coda
     di approvazione, non c'è onboarding self-service (`13` §5). `/platform/organizations`
     ha quindi una creazione diretta, non un flusso di approvazione.
  2. I cataloghi sono **estensibili a runtime**: aggiungere un tipo evento non richiede un
     rilascio. È il principio che regge l'intera analisi.
- `api_endpoints` — CRUD di `EventType`, `RequirementType`, `ServiceType`, `RefundPolicy`,
  `Organization`
- `shared_state` — store `eventType`, `requirementType`, `serviceType`, `refundPolicy`,
  `organization`.

**`cross_dependencies`** — tutte le rotte che leggono i cataloghi.

---

## §5 — Convenzioni frontend

| Tema | Regola |
|---|---|
| `state_pattern` | **`signals`** — nativi di Angular 20, nessuna dipendenza aggiuntiva. `AGENTS.md` è la fonte autoritativa (`KEIJO-STATE-CONSISTENCY-WITH-AGENTS-MD`) e dichiara `signals`. **Non introdurre NgRx né subject RxJS**, e non tornare a proprietà di classe mutate |
| `routing_pattern` | **`feature-route`** |
| Versioni — **vincolo del committente** | **Angular 20.3** e **Node 22**, e non si sale. Risolte oggi: `@angular/core` 20.3.27, `@angular/cli` 20.3.32, TypeScript 5.9.3, Node v22.23.2, `@keijo/ui` 3.0.0. Gli intervalli in `package.json` restano `^20.3.0`, che copre le patch della 20.x ma **non** la 21; `.nvmrc` fissa Node a 22.23.2 in radice, `app/` e `backend/`. **Non aggiornare Angular alla 21 né passare a Node 24** senza una decisione esplicita: Angular 20 è anche il minimo che `@keijo/ui@3.0.0` dichiara come peer |
| Store | **uno store per entità**, `@Injectable({ providedIn: 'root' })`, con il nome dell'entità in PascalCase più `Store` (`EventStore`, `TicketTypeStore`, `CapacityQuotaStore`…). `signal()` per collezione, paginazione e flag di caricamento; `computed()` per le viste derivate; metodi `async` che chiamano l'API e poi fanno `set()` / `update()`. Nessuno store «di pagina» |
| Token | `localStorage`, chiave `Authorization`, valore **grezzo**. Il prefisso `Bearer ` lo aggiunge l'interceptor in memoria |
| Interceptor | aggiunge l'header, e su **`401` esegue il logout e reindirizza al login** — non esiste refresh token |
| Errori | l'interceptor riconosce i `code` di dominio del §3.3 (`SOLD_OUT`, `ROLE_ON_HOLD`, `RESERVATION_EXPIRED`…) e li instrada al componente che li sa presentare, invece di mostrare un toast generico |
| WebSocket | connessione a `WS_URL/<wsCode>`; alla ricezione di un `EventEnvelope` si **rifà la chiamata REST** e si aggiorna lo store. Il payload non entra mai direttamente nello store |
| Lingua | interfaccia i18n **IT + EN dal giorno uno**; i testi dell'organizzatore sono `I18nText` e, in assenza di traduzione, si mostra l'originale **con l'indicazione della lingua**, mai una stringa vuota |
| Importi | sempre in centesimi interi lato dati; formattazione `it-IT` / `EUR` solo in presentazione |
| Date | fuso `Europe/Rome` |
| Estetica | **palette calda e scura ereditata dalla wall** (`RF-WALL-31`): nero e bordeaux come superficie, oro e avorio come testo, transizioni fluide. **Contrasto verificato WCAG 2.1 AA** su percorso pubblico e area personale (`04` §8) |
| Accessibilità | WCAG 2.1 AA; nessuna transizione a stacco né lampeggio |
| Dispositivi | mobile-first; `/check-in` ottimizzato per telefono in verticale con una mano; `/events` e `/reports` per tablet e desktop |

---

## §6 — Invarianti che questo brief pre-soddisfa

- [x] Ogni entità distinta è modellata separatamente — **30 entità con base REST propria più 3 figli posseduti, nessun accorpamento**.
      In particolare `Ticket` ≠ `Registration`, `TicketType` ≠ `Ticket`, `Purchase` ≠ `Order`.
- [x] Nessun tetto alle rotte — dieci rotte di sidebar, quante ne chiede la navigazione.
- [x] **Nessuna categoria `settings` nella sidebar** (`KEIJO-SIDEBAR-NO-SETTINGS`).
- [x] Ogni `page_category` è un valore valido dell'enum.
- [x] Ordinamento ed etichettatura delle azioni: dichiarate le azioni e la primaria per ogni
      pagina; l'ordine lo applica la skill.
- [x] `state_pattern: signals`, `routing_pattern: feature-route`, verificati contro `AGENTS.md`.
- [x] Ogni `api_endpoints` risolve in §3.
- [x] Il contratto usa **solo** il dialetto keijo.
- [x] §3 identico byte per byte a quello di `backend-brief.md`.

---

## §7 — Decisioni prese e assunzioni dichiarate

**Nessun `TBD` in questo file.** Quanto segue è deciso: non riaprirlo, segnalalo solo se
scopri che rende una feature impossibile.

### Decisioni del committente (3 agosto 2026)

| # | Decisione | Conseguenza |
|---|---|---|
| D-A | **Perimetro: primo taglio** (`13` §4) | Restano fuori chat e Live Wall, bacheca cerco-partner, PayPal e Satispay, motore di rimborso a scaglioni, contestazioni di addebito, codici promozionali, onboarding self-service, calendario/ricerca/mappa pubblici |
| D-B | **Entità in inglese, interfaccia in italiano** | Le basi REST derivate sono regolari; la tabella di corrispondenza del §1 è vincolante per le etichette |
| D-C | **Tre applicazioni**: `www` (SSR, pubblico) · `app` (keijo-ui) · `wall` (predisposta e vuota) | Le skill keijo-fe costruiscono **solo `app`** |
| D-D | **Rimborsi riservati all'`OWNER`**, mai alla cassa | Le azioni di rimborso non compaiono per `EVENT_MANAGER` |
| D-E | **L'`EVENT_MANAGER` pubblica da solo** | `POST /events/:id/publish` è concesso a `EVENT_MANAGER`; l'attestazione fiscale è registrata a suo nome |
| D-F | **Ruoli assegnati per organizzazione, mai per singolo evento** | **Deroga dichiarata a `RF-ORG-7`.** Conseguenza operativa: il `CHECKIN_OPERATOR` vede tutti gli eventi dell'organizzazione, non solo quello del proprio turno. Con due o tre clienti è accettabile; la tabella di assegnazione per evento si può aggiungere dopo senza rifare i permessi |
| D-G | **Nessun preset di ruolo «Staff» cumulativo** | L'Owner assegna i ruoli uno per uno |
| D-H | **Il pubblico anonimo usa polling a 10–15 s**, non WebSocket | Il canale keijo richiede il `wsCode` del profilo. Nessuna deroga al dialetto |
| D-I | **Stripe Connect, direct charges + `application_fee_amount`** | I fondi non toccano mai il conto della piattaforma; sull'estratto conto del partecipante appare l'organizzatore; dispute e penali arrivano all'organizzatore, come deciso in `11` D12 |
| D-J | **Palette calda e scura ereditata dalla wall su tutte le superfici** | Con verifica di contrasto WCAG 2.1 AA |
| D-K | **File su disco locale del backend** | Rivedibile: il passaggio a S3 sarà necessario quando servirà più di un'istanza o quando arriverà l'archivio della wall |
| D-L | **Infrastruttura di produzione non decisa**, sviluppo in docker compose | Non blocca né il §3 né la costruzione |
| D-M | **`websocket` on, `mqtt` off, `tests` on** | Il caso T23 di `05` §13 va automatizzato prima dell'apertura vendite |
| D-N | **2FA rinviato oltre il primo taglio** | `RF-ACC-6` rientra in fase 1b |

### Assunzioni dichiarate — le cinque domande di `13` §9 sono senza risposta

Il committente non ha ancora le risposte dei clienti. Procedo così, e queste sono
**assunzioni, non ipotesi da verificare in corso d'opera**:

| # | Assunzione | Fondamento | Se cade |
|---|---|---|---|
| AS-1 | **Quote per ruolo e iscrizione a coppia: dentro** | `13` §3 mette il motore di `05` «per intero» tra le cose non tagliabili | Nessun impatto: è il prodotto |
| AS-2 | **Servizi accessori: entità e quote modellate, UI di vendita minima** | Le quote di ambito `SERVICE` fanno parte del motore | Se il primo evento vende una cena, si aggiungono l'UI di vendita e le liste operative — non lo schema |
| AS-3 | **Vendita alla porta: fuori dal primo taglio** | `13` §5, «da valutare evento per evento» | **È l'unica assunzione che sposta il perimetro.** Rientrerebbero il ruolo `BO`, `RF-CHK-10→12` e la chiusura di cassa |
| AS-4 | **Contingente per canali esterni: dentro** (è un valore di `CapacityQuota.reservedFor`); registrazione delle vendite esterne e vista di allineamento: **fuori** | `13` §4 elenca `RF-EVT-32` tra le quote, ma il back-office si ferma a `RF-BKO-1→4, 6, 9` | Se l'organizzatore vende anche altrove rientrano `RF-BKO-10/11` e `RF-CHK-15` — è il presidio del rischio `R17` |
| AS-5 | **Un solo `Session` implicito** per gli eventi senza sessioni, creato come **riga reale** | `09` §7 | Nessuno: tiene un solo percorso per check-in e quote |
| AS-6 | **Testi traducibili come campo JSON `{it, en}`** | `RF-PUB-10` chiede di sapere cosa manca, non un modello relazionale delle traduzioni | Si passa a una tabella `Translation` senza toccare il §3, che espone comunque `I18nText` |

### Questioni aperte che **non** bloccano la costruzione

| # | Questione | Serve entro |
|---|---|---|
| Q7 | **Data di apertura vendite del primo evento reale** — `13` §7 la chiama «la vera scadenza del progetto» | pianificazione |
| G3 | Provider delle email transazionali (template IT + EN) | prima delle `RF-COM-1` |
| H5 | Strumento con cui la piattaforma emette il proprio documento sui diritti di prevendita | prima del primo incasso reale |
| — | Infrastruttura di produzione | prima del primo evento |
| Q6 | Tempi di conservazione dei dati | prima del primo evento |
