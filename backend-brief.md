# Mirada Tango — Backend brief

**Perimetro** primo taglio (`13-primo-taglio.md` §4) · **Generato da** `keijo-create` ·
**Implementa** il §3 di questo file, identico a quello di `frontend-brief.md`

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

Sei un sub-agent **keijo-be**. Questo file è la tua specifica eseguibile.

1. Leggilo **per intero** prima di scrivere qualunque cosa.
2. **Il §3 è autoritativo.** È l'interfaccia che devi realizzare, non una proposta. Il
   frontend è costruito contro di essa in parallelo: se cambi una forma, rompi l'altra parte.
3. Lavora **headless**. Il §7 contiene le decisioni prese e le assunzioni dichiarate: sono
   risposte, non domande aperte.
4. **Regola del 3+1.** Su un buco o una contraddizione ti fermi e proponi **tre opzioni
   concrete più la possibilità che l'utente ne indichi una quarta**. Non ri-progettare.
5. Sequenza: setup del §1 → `new-resource` per entità **nell'ordine del §2** → gli eventi
   WebSocket del §4. Per ogni entità l'ordine interno è
   `new-prisma-model → new-repository → new-dto → new-service → new-controller`, con la
   migrazione eseguita dall'utente prima del livello DTO.
6. **La densità del §4 non è uniforme, ed è deliberata.** Le entità di catalogo sono CRUD
   puro e hanno una specifica compatta: il comportamento di serie di `new-resource` è
   corretto. Il **motore di capienza**, il **checkout con prenotazione**, il **biglietto** e
   il **check-in offline** hanno specifica estesa perché lì il comportamento di serie **non**
   basta e ogni scostamento è un difetto che si paga in produzione con una persona che ha
   pagato e non entra.

> **Da costruire per primo, e da collaudare prima di avere un'interfaccia**: il motore di
> capienza (§4 · `CapacityQuota` e `QuotaConsumption`) con la sua casistica di test. È il
> fondamento e il componente più delicato del prodotto: sbaglia in silenzio, sbaglia sotto
> carico, e ogni errore si traduce in una persona che ha pagato e non entra.

---

## §1 — Setup una volta sola

### 1.1 Moduli di `@keijo/create-be`

| Modulo | Stato | Perché |
|---|---|---|
| `websocket` | **on** | Il cruscotto, il contatore presenze e la disponibilità si aggiornano in tempo reale (§3.9). Serve anche prima che arrivino chat e Live Wall in fase 1b |
| `mqtt` | **off** | Nessun dispositivo da comandare |
| `tests` | **on** | Il caso **T23** — cinquanta acquisti simultanei su dieci posti — va automatizzato **prima** dell'apertura vendite del primo evento reale, non dopo |

Servizi di appoggio: **PostgreSQL** e **Redis** (fan-out WebSocket multi-istanza, rate
limiting in apertura vendite, TTL). Sviluppo in `docker compose`; `docker/postgres/init/` è
già predisposto.

### 1.2 Fondazione da non ricreare

`User`, `Person`, `Contact`, `Address`, `Role`, `Permission`, `Config`, `Log`, `File`
**arrivano con il template**. In particolare `Log` assorbe integralmente:

- `RF-EVT-18` — registro delle modifiche su evento pubblicato, con autore e momento
- `RF-BKO-7` — registro delle attività dello staff sull'evento
- `RF-ADM-9` — audit log immutabile delle azioni sensibili

Non modellare entità di audit proprie.

### 1.3 Ruoli — richiedono una **modifica di enum e una migrazione**, non solo un seed

`RoleName` è un **enum Prisma**, oggi `GOD | ADMIN | USER`. I ruoli del progetto vanno
aggiunti all'enum in `prisma/schema.prisma`, migrati, e poi seminati nella tabella `Role`
con `label` e `rank`:

```prisma
enum RoleName {
  GOD               // Super Admin di piattaforma — allow-all implicito, mai un ruolo di UI
  OWNER             // Titolare dell'organizzazione
  EVENT_MANAGER     // Costruisce e pubblica gli eventi
  CHECKIN_OPERATOR  // Scansiona i QR all'ingresso
  DANCER            // Utente finale registrato
}
```

`ADMIN` e `USER` del template **non servono al dominio**: se rimuoverli rompe il seed di
serie, lasciali nell'enum e non concedere loro alcun permesso — ma dichiaralo, non lasciarlo
implicito.

Le concessioni vivono in `PermissionConfig(action, entity, scope, roleName)`, non in una
tabella `Permission`: quel modello non esiste nel template.

**I ruoli sono assegnati per organizzazione, mai per singolo evento** (decisione D-F del §7).
L'appartenenza è espressa da `OrganizationMember`.

### 1.4 `PermissionResource` — uno per entità

Da **aggiungere all'enum esistente** `src/stack/enums/PermissionResource.ts`.
**`EVENT` è già presente**: va riusato, non ridefinito.

```
ORGANIZATION · ORGANIZATION_MEMBER · FISCAL_DECLARATION · DANCER_PROFILE
EVENT_TYPE · REQUIREMENT_TYPE · SERVICE_TYPE · REFUND_POLICY
VENUE · ARTIST
EVENT · SESSION · EVENT_CAST · EVENT_REQUIREMENT · EVENT_SERVICE
TICKET_TYPE · CAPACITY_QUOTA · QUOTA_CONSUMPTION
PURCHASE · ORDER · RESERVATION · PAYMENT
TICKET · TICKET_TRANSFER · PASS_ISSUANCE
REGISTRATION · COUPLE · REQUIREMENT_OUTCOME · CHECK_IN · REFUND
```

Le concessioni `ACTION#RESOURCE#SCOPE` per ruolo sono **la matrice del §3.8**, che
**rispecchia esattamente il gating dell'interfaccia** dichiarato nel frontend brief. Non
inventarne altre e non allargarle «per comodità di test».

### 1.5 Isolamento fra organizzazioni — vincolo, non buona pratica

`#OWN` per lo staff significa «delle righe dell'organizzazione di cui sono membro». Il
controllo di permesso in controller **non basta**: ogni finder di repository su un'entità
che discende da `Organization` porta un **filtro `organizationId` obbligatorio**, risolto
dal contesto dell'utente autenticato.

Un `OWNER` non deve poter leggere nemmeno **un conteggio aggregato** di un'altra
organizzazione. Questa è la ragione per cui il §3.9 vieta `broadcastToRoles`.

---

## §2 — Piano di costruzione (ordine di dipendenza)

Le entità con chiavi esterne vengono **dopo** quelle che referenziano. Il grafo è aciclico:
`Couple` non punta alle `Registration`, sono le `Registration` a puntare alla coppia.

| Passo | Entità | Dipende da |
|---|---|---|
| **1** | `EventType` · `RequirementType` · `ServiceType` | — (solo foundation) |
| **2** | `Organization` | `Address`, `File` |
| **3** | `DancerProfile` | `User`, `File` |
| **4** | `OrganizationMember` | `Organization`, `User` |
| **5** | `Venue` · `Artist` | `Organization`, `Address`, `File` |
| **6** | `RefundPolicy` | `Organization` |
| **7** | `Event` | `Organization`, `EventType`, `Venue`, `RefundPolicy`, `File` |
| **8** | `FiscalDeclaration` | `Organization`, `Event`, `User` |
| **9** | `Session` | `Event` |
| **10** | `EventCast` · `EventRequirement` · `EventService` | `Event`, `Artist`, `RequirementType`, `ServiceType` |
| **11** | `TicketType` | `Event` |
| **12** | `TicketTypeSession` · `PriceTier` | `TicketType`, `Session` |
| **13** | **`CapacityQuota`** | `Event` |
| **14** | `Couple` | `Event` |
| **15** | `Registration` | `Event`, `User`, `Couple` |
| **16** | **`QuotaConsumption`** | `CapacityQuota`, `Registration` |
| **17** | `RequirementOutcome` | `Registration`, `EventRequirement` |
| **18** | `Purchase` | `User` |
| **19** | `Order` | `Purchase`, `Organization`, `Event` |
| **20** | `OrderLine` | `Order`, `TicketType`, `EventService`, `PriceTier` |
| **21** | `Reservation` | `Order`, `Event`, `User` |
| **22** | `Payment` | `Order` |
| **23** | `PassIssuance` | `Event`, `TicketType`, `User` |
| **24** | `Ticket` | `OrderLine`, `PassIssuance`, `Event`, `TicketType`, `Registration`, `File` |
| **25** | `TicketTransfer` | `Ticket`, `User` |
| **26** | `CheckIn` | `Ticket`, `Session`, `Registration`, `User` |
| **27** | `Refund` | `Order`, `Registration`, `Ticket`, `User` |

**Deroga all'ordine, deliberata.** I passi **13 e 16** (`CapacityQuota` e
`QuotaConsumption`) vanno costruiti e **collaudati con la casistica di test** prima di
proseguire con l'ordine di acquisto, anche se questo significa fermarsi a metà elenco. È il
passo 1 della sequenza di `13` §8: *«si costruisce per primo e si collauda prima di avere
un'interfaccia»*.

**Figli posseduti** — `TicketTypeSession`, `PriceTier`, `OrderLine` sono modelli figli con
`onDelete: Cascade` e **non hanno controller proprio**: si modificano con l'unico `PATCH`
sub-risorsa del §3.4.

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
  Porta inoltre **`region?`**, che **non si digita**: il servizio la deriva dalla sigla di
  provincia con la tabella delle 110 province italiane (`BT` → `Puglia`). È una colonna e
  non un calcolo in lettura perché il filtro geografico della ricerca pubblica dev'essere
  una condizione indicizzata — e perché un campo libero produrrebbe «Puglia», «PUGLIA» e
  «Apulia» come tre regioni diverse.
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
PaymentProvider      = "NONE" | "STRIPE"   // NONE = ordine a importo zero o saldato fuori piattaforma
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
**Unico su `(ticketId, sessionId)` quando `revokedAt IS NULL` *e* `conflictWithId IS NULL`** —
`RB7`: *un QR vale una sola volta per sessione*.

> Il predicato **deve** comprendere `conflictWithId`, altrimenti `RB7` e `RF-CHK-6` si
> escludono a vicenda: la seconda scansione offline ha `revokedAt` nullo per definizione, e
> con il solo `revokedAt IS NULL` il database la **respingerebbe** invece di consegnarla
> allo staff come conflitto da risolvere. Il vincolo così esteso resta un **sovrainsieme**
> di `RB7` — continua a garantire **un solo ingresso ammesso** per biglietto e sessione,
> perché una riga di conflitto è un doppione segnalato, non un secondo ingresso.

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
| `POST /api/public/events/` body `{ query, options }` | **ricerca pubblica paginata** → `PaginateDatasource<PublicEventCard>`. Restituisce **solo** eventi `PUBLISHED` con vendita aperta. `query` = `{ value?, city?, province?, region?, country?, eventTypeId?, from?, to?, role? }`: `value` è full-text su titolo, descrizione, cast e location; `from`/`to` filtrano sulla sovrapposizione con l'intervallo dell'evento, non sul solo `startAt`, altrimenti un festival già iniziato sparirebbe dai risultati; `role` restringe a ciò che ha ancora capienza **per quel ruolo di ballo**, che è la ricerca che un tanghero fa davvero (`RF-PUB-2`) |
| `POST /api/users/register` body `{ username, password, name, surname, email, … }` | **auto-registrazione del ballerino**, senza autenticazione. Crea `Contact`, `Person` e `User` in una sola transazione e assegna il ruolo `DANCER`. Esisteva nel template e non era dichiarata: `AS2` la richiede, perché l'acquisto vuole un account creato contestualmente al checkout |

**Ordine, prenotazione, pagamento:**

| Endpoint | Semantica |
|---|---|
| `POST /api/orders/reserve` body `{ eventId, lines[], attendees[] }` | **crea l'ordine, blocca il prezzo e impegna atomicamente la capienza** per 15 minuti. Restituisce `{ purchase, orders[], expiresAt }` oppure fallisce con uno dei codici di §3.3. Suddivide automaticamente il carrello in un ordine per organizzatore (`RF-PAY-34`) |
| `POST /api/orders/:id/rearm` | riarma la prenotazione ad almeno 10 minuti residui, all'avvio del pagamento (`RF-PAY-22`) |
| `POST /api/orders/:id/abandon` | rilascio immediato dell'impegno (`RF-PAY-24`) |
| `POST /api/orders/:id/checkout` | crea il PaymentIntent Stripe **sull'account connesso** con `application_fee_amount` → `{ clientSecret, publishableKey, connectedAccountId }` |
| `POST /api/orders/:id/confirm-free` | **chiude un ordine senza prestatore di pagamento**: risolve i ruoli flessibili, conferma le `Registration`, emette i `Ticket`, rilascia la `Reservation` con `releaseReason = COMPLETED` e registra un `Payment` con `provider = NONE`. Ammesso **solo** se il totale è zero o se l'organizzatore ha dichiarato l'incasso fuori piattaforma: **non è una scorciatoia per saltare il pagamento**, è il percorso degli ingressi gratuiti e delle iscrizioni raccolte prima che il prestatore sia collegato. Percorre esattamente lo stesso codice di `checkout`, meno l'adapter |
| `POST /api/payments/stripe/webhook` | **nessun JWT**, autenticato dalla firma Stripe. Idempotente su `event.id` (`RF-PAY-10`) |
| `POST /api/orders/:id/confirm-partial` body `{ removeLineIds[] }` | conferma esplicita dopo `PARTIAL_AVAILABILITY`, ricalcola il totale (`RF-PAY-15`, `RB17`) |
| `GET /api/orders/:id/receipt` | → `{ fileUrl }` — ricevuta all'acquirente. Come il PDF del biglietto, **non è un titolo fiscale**: nessuna numerazione progressiva (`RF-PAY-12`, `RF-TCK-11`) |

**Biglietti e check-in:**

| Endpoint | Semantica |
|---|---|
| `GET /api/tickets/:id/pdf` | → `{ fileUrl }` — conferma d'ordine con QR, **mai un titolo fiscale** (`RF-TCK-11`) |
| `POST /api/tickets/:id/transfer` body `{ emailOrNickname }` | trasferisce il nominativo: invalida il QR precedente, ne emette uno nuovo, sposta l'iscrizione e **rivaluta i requisiti**; rifiuta se le quote del nuovo ruolo non lo permettono (`RF-TCK-5→7`, `RB8`). Tre precisazioni: **(a)** il ruolo del nuovo titolare si legge da `DancerProfile.preferredRole` — `BOTH` o assente significa **nessun movimento di quota**, mai un'assegnazione arbitraria; **(b)** il trasferimento verso una persona **già iscritta all'evento** è rifiutato con `409`, perché `09` §7 impone *una iscrizione per persona per evento* e nessuna regola descrive la fusione di due iscrizioni; **(c)** un pass **al portatore** non è trasferibile (`RF-TCK-18`) |
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
## §4 — Specifica per entità

**Legenda dei blocchi compatti.** Dove una voce non compare, vale il comportamento di serie
di `new-resource`: DTO `Create` dalla forma del §3.6, `Update` = `Partial<Create>` **solo
scalari**, `Query` con `value` full-text sui campi testuali, controller con i cinque endpoint
del dialetto e la terna di permesso della matrice §3.8.

### 4.1 Cataloghi di piattaforma — `EventType` · `RequirementType` · `ServiceType`

- **Prisma** — come §3.6. `slug` unico su `EventType`. `name` è `Json` (`I18nText`).
  `defaultTemplate`, `configSchema`, `attributesSchema` sono `Json`.
- **Repository** — `findBySlug` su `EventType`. `findAllActive` su tutte e tre.
- **DTO** — `Query` con facet `{ active?: boolean }`.
- **Controller** — scrittura riservata a `GOD`
  (`EVERYTHING#EVENT_TYPE#EVERYTHING`); lettura `READ#…#ALL` a tutti i ruoli autenticati.
- **Nota** — non sono configurazione tecnica: **le cinque capacità di `EventType`
  (`capMultiSession`, `capRoleQuotas`, `capLevels`, `capCast`, `capCouple`) generano il
  wizard di creazione evento**. Aggiungere un tipo evento non richiede un rilascio; è il
  principio che regge l'intera analisi.

### 4.2 `Organization`

- **Prisma** — `status`, `payoutStatus` enum. `stripeAccountId` unico e nullable. Indici su
  `status` e `payoutStatus`. Relazione a `Address` (`onDelete: SetNull`) e a `File` per il logo.
- **Repository** — `findByStripeAccountId` (lo usa il webhook Stripe),
  `findByVatNumber`, `findAllWithPayoutEnabled`.
- **DTO** — `Update` **non** consente di scrivere `payoutStatus` né `stripeAccountId`: sono
  **campi calcolati dal server** a partire dalla risposta di Stripe, mai dal client.
- **Service** — `refreshPayoutStatus(orgId)` interroga Stripe e aggiorna `payoutStatus` e
  `payoutCheckedAt`. Chiamato dallo scheduler (§5) e da `GET /organizations/:id/payout-status`.
- **Controller** — `GET /organizations/:id/payout-status` → `READ#ORGANIZATION#OWN`.
  Creazione riservata a `GOD`: nel primo taglio **le organizzazioni sono create a mano**,
  non c'è coda di approvazione (`13` §5).
- **Regola** — la **decadenza dell'abilitazione sospende la vendita** di nuovi biglietti
  (`RF-ORG-11`), ma **i biglietti già emessi restano validi e i rimborsi restano
  eseguibili**. Non implementare invalidazioni a cascata.

### 4.3 `OrganizationMember` · `FiscalDeclaration` · `DancerProfile`

- **`OrganizationMember`** — unico su `(organizationId, userId, role)`. Repository
  `findByUser(userId)` → è **il finder che risolve il contesto di tenancy** di ogni
  richiesta autenticata (§1.5). Indice su `userId`.
- **`FiscalDeclaration`** — **immutabile**. Nessun endpoint `PATCH`, nessun `DELETE`: si crea
  una nuova versione. `version` progressivo per `(organizationId, kind, eventId)`.
  `declaredAt`, `declaredByUserId` e `ipAddress` sono **calcolati dal server**, mai accettati
  dal client. Il DTO `Update` non esiste.
- **`DancerProfile`** — `userId` unico, `nickname` unico. Service `changeNickname` applica il
  **filtro automatico sul nickname** e incrementa `nicknameChangeCount` con finestra
  temporale (`RF-ACC-9`): è l'unico dato dell'autore che finirà proiettato su un maxischermo
  in fase 1b, e il vincolo si costruisce adesso. `attributes: Json` è lo spazio riservato
  agli attributi di ballo estensibili di fase 2 — **previsione dichiarata**, non over-engineering.

### 4.4 `Venue` · `Artist` · `RefundPolicy`

- **`Venue`** — `capacity` nullable. Il servizio la **propone** come default alla creazione
  della quota di capienza della sala, **non la impone**: assenza di quota significa assenza di
  vincolo (`05` §4).
- **`Artist`** — anagrafica **senza account** (`RF-EVT-6`). Nessuna relazione a `User`.
- **`RefundPolicy`** — `tiers: Json`. Validazione di servizio: una policy con
  `organizationId` valorizzato e derivata da un preset di piattaforma può essere **più
  favorevole al partecipante, mai più restrittiva**.

### 4.5 `Event`

- **Prisma** — `slug` **unico globale** (serve a `GET /api/public/events/:slug`).
  `title`, `description`, `refundPolicyText`, `minorsConditions` sono `Json` (`I18nText`).
  `salesCloseCriteria` è `SalesCloseCriterion[]`. Indici su `(organizationId, status)`,
  `startAt`, `slug`. Relazioni: `Organization` (`Restrict`), `EventType` (`Restrict`),
  `Venue` (`Restrict`), `RefundPolicy` (`SetNull`), tre `File` (`SetNull`).
- **Repository** — `findBySlug`, `findPublishedBySlug` (per l'endpoint pubblico),
  `findByOrganization`, `findRunningWithCheckIn`.
- **DTO** — `Create` **non** accetta `status`, `publishedAt`, `cancelledAt`: sono governati
  dalle transizioni. `Query` con facet `{ status?: EventStatus[], organizationId?, eventTypeId? }`.
- **Service**
  - `publish(eventId, userId)` — verifica **`RB13`**: organizzazione `APPROVED` **e**
    `payoutStatus = ENABLED`. Fallisce con `HttpError(PAYOUT_NOT_ENABLED)` distinguendo i due
    casi nel messaggio. Crea contestualmente la `FiscalDeclaration` di tipo
    `EVENT_ATTESTATION` a nome di chi compie l'atto (`RF-ORG-8`).
  - `closeSales` / `reopenSales` — `RF-EVT-40`: la chiusura scatta per **il primo dei criteri
    configurati che si verifica**; `EVENT_START` è sempre attivo come ultimo. La riapertura è
    possibile finché l'evento non è iniziato e la capienza lo consente. **Chiude la sola
    vendita online**: emissione manuale di pass e vendite esterne restano possibili (`RB20`).
  - `cancel` — rilascia **tutti** i `QuotaConsumption` dell'evento.
  - `duplicate` — clona evento, sessioni, cast, titoli, quote (con `consumed = 0`), requisiti
    e servizi; **azzera vendite e iscrizioni**.
  - `resolveOrphanSessions` — `RF-EVT-24`: restituisce i titoli che non includono la sessione
    aggiunta, **distinguendo i venduti dagli invenduti**. Sui venduti l'aggiunta è ammessa
    **solo come miglioria**: il servizio rifiuta qualunque rimozione di sessione da un titolo
    con biglietti emessi.
- **Controller** — i cinque del dialetto più `publish`, `close-sales`, `reopen-sales`,
  `cancel`, `duplicate`, `dashboard`, `exports`, `checkin-manifest`,
  `orphan-sessions/resolve`, `pass-issuances/bulk`. Tutti `#OWN`. Gli endpoint
  `/api/public/events/*` sono **senza autenticazione** e restituiscono **solo** eventi
  `PUBLISHED` o `SALES_CLOSED`.
- **WebSocket** — nessuno diretto; gli eventi nascono dal motore di capienza.

### 4.6 `Session` · `EventCast` · `EventRequirement` · `EventService`

- **`Session`** — `onDelete: Cascade` da `Event`. `allocationWeight: Int` con **default
  uniforme** calcolato dal servizio sul numero di sessioni incluse (`RF-EVT-36`);
  l'organizzatore può assegnarne di diversi. `isImplicit: Boolean @default(false)` — alla
  creazione di un evento il cui `EventType` ha `capMultiSession = false`, il servizio crea
  **una sessione implicita reale**: il check-in di una milonga singola gira sullo stesso
  codice di quello di un festival.
  `cancelSession(id, reason)` rilascia le quote della sessione e restituisce l'elenco dei
  titoli che la includono con il loro peso, perché il rimborso proporzionale (fase 1b) e la
  comunicazione ai soli titolari interessati si appoggiano lì (`RF-EVT-35`).
- **`EventCast`** — join con significato: porta `kind` e `sortOrder`. `Cascade` da `Event`,
  `Restrict` da `Artist`.
- **`EventRequirement`** — `kind` ereditato dal `RequirementType`. **Nel primo taglio sono
  ammessi solo `DECLARATION` e `CUSTOM_FIELD`**: nessun upload di documenti, nessun dato
  sanitario, mai (`RF-REQ-2`, `RF-REQ-3`). Il servizio rifiuta un `RequirementType` di altro
  genere.
- **`EventService`** — `attributesConfig: Json` dichiara quali attributi si raccolgono
  all'acquisto (taglia, dieta, slot orario). **Diete e allergie sono l'unico dato
  riconducibile alla salute che resta in piattaforma**: accesso ristretto, mai nelle
  esportazioni generiche né nella vista di check-in.

### 4.7 `TicketType` · `TicketTypeSession` · `PriceTier`

- **Prisma** — `TicketType` `Cascade` da `Event`. `basePrice: Int` (centesimi).
  `accessCode` nullable e indicizzato. `TicketTypeSession` unico su
  `(ticketTypeId, sessionId)`, `Cascade` da entrambi. `PriceTier` `Cascade` da `TicketType`.
- **Repository** — `findByEvent`, `findByAccessCode`, `findWithSessions`.
- **DTO** — `Create` **non** accetta le sessioni incluse né gli scaglioni: sono figli
  posseduti, si scrivono con il `PATCH` sub-risorsa. `Update` scalari soltanto.
- **Service**
  - `setSessions(ticketTypeId, sessionIds[])` — sostituisce **l'elenco esplicito**. Rifiuta
    la rimozione di una sessione se esistono biglietti emessi per quel titolo.
  - `resolvePrice(ticketTypeId, at, soldQuantity)` — **server-computed, mai fidarsi del
    client**. Valuta gli scaglioni: `BY_DATE` sul primo `validUntil` non superato,
    `BY_QUANTITY` sul primo `maxQuantity` non esaurito, `COMBINED` sulla congiunzione.
    Restituisce prezzo, criterio di scadenza e residuo a quel prezzo, perché
    **`RF-EVT-26` richiede scarsità dichiarata con dati reali**.
  - Validazioni: `saleUnit = PER_COUPLE` ⇒ non acquistabile da solo (`T5`);
    `consumesRoleQuota = false` è incompatibile con `roleConstraint` valorizzato.
- **Controller** — cinque del dialetto + `PATCH /:id/sessions`, `PATCH /:id/price-tiers`,
  `POST /:id/price-preview`.

### 4.8 `CapacityQuota` — **il componente più delicato del prodotto**

> Va implementato **con i test prima che con il codice**.

- **Prisma**
  ```prisma
  @@unique([eventId, scope, scopeId, role])
  @@index([eventId, scope])
  ```
  `scopeId` è un riferimento **polimorfo senza chiave esterna** (punta a `Session`,
  `TicketType` o `EventService` secondo `scope`): la validazione di coerenza sta nel servizio.
  `consumed: Int @default(0)`, `limiting: Boolean @default(true)`,
  `overbookAllowance: Int @default(0)`, `publiclyVisible: Boolean @default(true)`.
  `Cascade` da `Event`.

- **Vincoli di integrità da far rispettare al servizio**
  - `scopeId` non nullo per ogni `scope ≠ EVENT`.
  - `role` valorizzabile **solo** su `scope ∈ {EVENT, SESSION}`: le quote di titolo e di
    servizio sono per persona, indipendentemente da come balla.
  - `consumed ≤ limit + overbookAllowance` **in ogni istante, anche transitorio**.
  - Sulla quota `(scope=EVENT, role=null)` — la capienza della sala —
    `overbookAllowance` è **forzato a 0 e non modificabile** e `limiting` è **forzato a
    true**. Stessa regola sulle quote di ruolo di ambito `EVENT`. Non è un limite
    commerciale: è un vincolo di sicurezza la cui responsabilità in caso di controllo ricade
    sull'organizzatore.
  - `imbalanceTolerance` coerente fra le due quote di ruolo appaiate dello stesso ambito.

- **Repository** — `findApplicable(eventId, scopeIds[], role)`,
  `lockAndIncrement(quotaId, quantity, tx)` che esegue **l'aggiornamento condizionato**:
  ```sql
  UPDATE "CapacityQuota"
     SET consumed = consumed + :quantity
   WHERE id = :id
     AND consumed + :quantity <= "limit" + "overbookAllowance"
  ```
  Restituisce il numero di righe toccate. **`0` significa esaurito.**

- **Service — `resolveApplicableQuotas(registration, ticketType, services[], role)`**
  ```
  Q ← ∅
  Q ← Q ∪ quota(EVENT, null, role: null)          # capienza della sala, sempre
  Q ← Q ∪ quota(EVENT, null, role: role)          # equilibrio dei ruoli
  se channel ≠ COMPLIMENTARY
      Q ← Q ∪ quota(TICKET_TYPE, ticketType.id, role: null)
  altrimenti
      Q ← Q ∪ quota(EVENT, null, reservedFor: COMPLIMENTARY)
  per ogni sessione inclusa nel titolo
      Q ← Q ∪ quota(SESSION, sessione.id, role: null)
      Q ← Q ∪ quota(SESSION, sessione.id, role: role)
  per ogni servizio acquistato
      Q ← Q ∪ quota(SERVICE, servizio.id, role: null)
  ritorna Q privo dei riferimenti nulli
  ```
  **Assenza di quota significa assenza di vincolo**: un evento senza quote configurate vende
  senza limite. Gli accrediti consumano capienza di sala e quote di ruolo — un ospite non
  pagante occupa comunque spazio in pista — ma **non** le quote di titolo, che sono
  inventario commerciale.

- **Service — `commit(registrations[])` — l'impegno atomico**
  ```
  A. per ogni iscrizione: risolvi il ruolo (FLEXIBLE → risolvi_flessibile) e le quote applicabili
  B. aggrega: mappa quota → unità richieste per l'intero ordine
  C. cancello di tolleranza, valutato SULL'ORDINE INTERO
       t ← imbalanceTolerance dell'ambito EVENT ; se nullo → passa
       L ← consumed(EVENT, LEADER)   + leader richiesti nell'ordine
       F ← consumed(EVENT, FOLLOWER) + follower richiesti nell'ordine
       se |L − F| > t → RIFIUTO(ROLE_ON_HOLD, ruolo, ...)
  D. transazione:
       per ogni quota in richiesta, ORDINATE PER id CRESCENTE
           se non quota.limiting → registra il consumo e continua   # conta, non blocca
           righe ← lockAndIncrement(quota, quantità)
           se righe = 0 → rollback, RIFIUTO(SOLD_OUT, quota)
           registra il consumo                                       # unicità → idempotenza
  ```

  **Le quattro note che non sono dettagli:**
  1. **L'ordinamento per id crescente è l'unica difesa contro i deadlock** quando due ordini
     toccano lo stesso insieme di quote in ordine diverso.
  2. **L'aggiornamento condizionato rende verifica e impegno una sola operazione.** Leggere
     prima e scrivere dopo è la modalità con cui si vendono posti inesistenti. Non
     sostituirlo con un `SELECT` seguito da `UPDATE`, per nessun motivo.
  3. **L'unicità su `QuotaConsumption(capacityQuotaId, registrationId)` rende l'operazione
     ripetibile**: se Stripe notifica due volte lo stesso incasso, il secondo tentativo non
     muove i contatori.
  4. **La tolleranza non estende il limite**: restringe dinamicamente l'accesso al ruolo
     sovrarappresentato. Ne discende una proprietà da preservare — *una coppia aggiunge
     un'unità per parte, non altera lo sbilancio e supera quindi sempre il cancello*. È il
     comportamento reale degli encuentros, e il modello lo riproduce **senza codice
     dedicato**: se ti serve un caso particolare per le coppie, hai sbagliato qualcosa.

- **Service — `resolveFlexible(event, registrations[])`**
  ```
  se le quote di ruolo non esistono → null
  residuoL ← limit(LEADER) − consumed(LEADER) ; residuoF ← idem FOLLOWER
  se residuoL ≠ residuoF     → ruolo con residuo maggiore
  se consumedL ≠ consumedF   → ruolo con consumato minore
  → LEADER                                    # convenzione, per determinismo nei test
  ```
  L'assegnazione avviene **alla conferma del pagamento**, non nel carrello: lo stato può
  cambiare nel frattempo. L'utente è informato del ruolo assegnato nella conferma d'ordine e
  sul biglietto.

- **Service — `release(registrationId, tx)`**
  Legge i `QuotaConsumption` dell'iscrizione, **decrementa esattamente quei contatori** e
  cancella le righe. **Il rilascio non è mai un decremento «a occhio»**: è l'unico modo per
  non accumulare deriva fra contatori e realtà su un evento che vive mesi fra vendite,
  rimborsi e trasferimenti.

  | Operazione | Effetto |
  |---|---|
  | Rimborso di un'iscrizione | rilascio integrale, servizi compresi |
  | Rimborso di un solo componente della coppia | rilascio dei soli consumi di quell'iscrizione |
  | Annullamento dell'evento | rilascio di tutto |
  | Trasferimento, stesso ruolo | **nessun movimento** |
  | Trasferimento con ruolo diverso | rilascio del vecchio e impegno del nuovo **nella stessa transazione**: se il nuovo ruolo è saturo il trasferimento è rifiutato e nulla cambia |
  | Pagamento fallito o prenotazione scaduta | rilascio dell'impegno tecnico |
  | Scioglimento della coppia senza rinuncia | **nessun movimento** |

- **Controller** — CRUD `#OWN`. Nessun endpoint espone `consumed` in scrittura.
- **WebSocket** — al termine di ogni `commit` o `release`, **dopo il commit della
  transazione**, si pubblica `event/availability-changed` con finestra di aggregazione di
  ~1,5 s (§3.9).
- **Test obbligatori prima di procedere** — la casistica di `05` §13, e in particolare
  **T23: cinquanta acquisti simultanei su dieci posti**. Automatizzato **prima**
  dell'apertura vendite del primo evento reale.

### 4.9 `QuotaConsumption`

- **Prisma** — `@@unique([capacityQuotaId, registrationId])`. `Cascade` da entrambi.
- **Controller** — **sola lettura** (`READ#QUOTA_CONSUMPTION#OWN`). Nessun `create`, nessun
  `update`, nessun `delete` esposto: si scrive **solo** attraverso il servizio di capienza.
- **Nota** — è il registro che rende il rilascio *esatto* anziché *ricostruito*.

### 4.10 `Couple` · `Registration` · `RequirementOutcome`

- **`Couple`** — `eventId`, `dissolvedAt`. **Non punta alle iscrizioni**: sono le
  `Registration` a puntare alla coppia, così il grafo resta aciclico. Validazione di servizio:
  esattamente due `Registration` con ruoli assegnati **complementari**.
  `dissolve(coupleId)` **non muove alcun consumo**: le persone restano, cambia solo il legame.
- **`Registration`**
  - **Prisma** — `@@unique([eventId, personUserId])` (parziale, quando `personUserId` non è
    nullo): *una iscrizione per persona per evento, con più biglietti collegati*. Indici su
    `(eventId, assignedRole)` e `(eventId, status)`. `Restrict` da `Event`, `SetNull` da
    `User` e `Couple`.
  - **DTO** — `Update` **non** consente di scrivere `assignedRole` direttamente: la
    riassegnazione passa dal servizio, che rilascia i consumi del vecchio ruolo e impegna
    quelli del nuovo **con le stesse verifiche di un acquisto**.
  - **Service** — `reassignRole`, `confirm`, `decline`. `decline` rende il biglietto **privo
    di titolare e lo restituisce alla disponibilità dell'acquirente** (`RB24`); i dati del
    terzo sono cancellati salvo la traccia contabile obbligatoria.
  - **Regola** — `status = TO_CONFIRM` **non blocca mai l'ingresso** (`RF-CPL-13`): il
    biglietto è valido, restano inattivi il profilo e le comunicazioni non essenziali.
  - **WebSocket** — `registration/created` ai membri dell'organizzazione.
- **`RequirementOutcome`** — `@@unique([registrationId, eventRequirementId])`.
  `acceptedAt`, `acceptedIp`, `acceptedVersion` sono **calcolati dal server** (`RF-REQ-4`).
  Il servizio espone `revaluateForRegistration(registrationId)`, invocato dal trasferimento
  di biglietto: **il trasferimento rivaluta sempre i requisiti sul nuovo titolare** (`RB8`).

### 4.11 `Purchase` · `Order` · `OrderLine` · `Reservation` · `Payment`

> Il checkout è il secondo punto in cui il comportamento di serie non basta.

- **Prisma** — `Order` `Restrict` da `Purchase`, `Organization`, `Event`. `OrderLine`
  `Cascade` da `Order`. `Reservation` con indice unico parziale su `(userId, eventId)`
  quando `releasedAt` è nullo — **una sola prenotazione attiva per utente e per evento**
  (`RF-PAY-23`). `Payment.idempotencyKey` unico.
- **Campi calcolati dal server, mai accettati dal client**: `unitPrice`,
  `presaleRightsPerUnit`, `lineTotal`, `subtotal`, `presaleRights`, `total`, `priceLockedAt`,
  `expiresAt`, `assignedRole`. Un prezzo che arriva dal client è un difetto di sicurezza.
- **Service — `reserve(userId, eventId, lines[], attendees[])`** — in **una** `$transaction`:
  1. verifica che l'evento sia in vendita (`SALES_CLOSED` → `HttpError`) e che
     l'organizzazione sia abilitata all'incasso (`PAYOUT_NOT_ENABLED`);
  2. **suddivide il carrello in un ordine per organizzatore** (`RF-PAY-34`) e calcola i
     **diritti di prevendita per biglietto**, non per ordine — così la suddivisione non
     cambia il totale complessivo (`RF-PAY-35`);
  3. risolve il prezzo con `resolvePrice` e lo **blocca** (`priceLockedAt`): chi entra in
     checkout con lo scaglione disponibile non se lo vede cambiare durante i quindici minuti,
     **anche se nel frattempo lo scaglione si esaurisce** (`RF-EVT-27`);
  4. crea le `Registration` in stato coerente e invoca **`commit`** del motore di capienza;
  5. crea la `Reservation` con `expiresAt = now + 15 min` — **durata parametro di
     piattaforma, non scelta dell'organizzatore**, e **sempre attiva su qualunque evento**
     indipendentemente dalla disponibilità residua (`RF-PAY-25`).

  **Disponibilità parziale** (`RF-PAY-15`, `RB17`): se risultano esaurite **soltanto** quote
  di ambito `SERVICE`, l'ordine **non viene rifiutato**. Si restituisce
  `PARTIAL_AVAILABILITY` con l'elenco delle righe indisponibili; la conferma esplicita arriva
  da `POST /orders/:id/confirm-partial`, che ricalcola il totale. *Un'iscrizione da novanta
  euro non fallisce per un servizio accessorio da venticinque.*

  **Sovrapposizione fra titoli** (`RF-PAY-26`): se una sessione è già inclusa in un titolo
  posseduto dalla stessa persona, si **segnala senza bloccare**, e **la quota di quella
  sessione non viene consumata due volta per la stessa persona**.

- **Service — `rearm(orderId)`** — riporta `expiresAt` ad almeno **10 minuti residui**
  all'avvio del pagamento, per coprire il reindirizzamento verso il prestatore (`RF-PAY-22`).
- **Service — `abandon(orderId)`** — rilascio **immediato** dei consumi (`RF-PAY-24`).
- **Service — `checkout(orderId)`** — crea il PaymentIntent Stripe **sull'account connesso**
  (`stripeAccountId`) con `application_fee_amount` pari ai diritti di prevendita:
  **direct charges**, i fondi non toccano mai il conto della piattaforma.
- **Webhook Stripe** — `POST /api/payments/stripe/webhook`, **senza JWT**, autenticato dalla
  firma. **Idempotente su `event.id`**: `processedEventIds` è la difesa contro la doppia
  notifica e il ritorno tardivo dell'utente (`RF-PAY-10`). Su `payment_intent.succeeded`:
  risolve i ruoli flessibili, conferma le `Registration`, emette i `Ticket`, rilascia la
  `Reservation` con `releaseReason = COMPLETED`, pubblica `payment/succeeded`.
- **Scheduler** — un processo periodico con lock recupera le prenotazioni **scadute e non
  rilasciate** e ne libera i consumi (`RF-PAY-24`). Senza di esso, in apertura vendite i
  posti restano bloccati da ordini abbandonati: è il rischio `R1b`, dichiarato.
- **Controller** — `reserve`, `rearm`, `abandon`, `checkout`, `confirm-partial` con
  `CREATE#ORDER#OWN` per il `DANCER`; `GET /orders/:id/receipt` con `READ#ORDER#OWN`.
  `Payment` e `Reservation` sola lettura.
- **WebSocket** — `order/reservation-expired` e `payment/succeeded` all'acquirente
  (`sendToUser`).

### 4.12 `Ticket` · `TicketTransfer` · `PassIssuance`

- **Prisma** — `Ticket.code` unico e indicizzato. `Restrict` da `Event` e `TicketType`,
  `SetNull` da `Registration`, `OrderLine`, `PassIssuance`. Indice su `(eventId, status)`.
- **Il QR** — payload firmato **Ed25519**, in forma di JWS compatto, contenente almeno
  `{ ticketId, eventId, issuedAt, keyId }`. **La chiave pubblica è distribuita con il
  manifest di check-in** perché la verifica deve funzionare **senza rete**. Un QR non firmato
  è un QR falsificabile con uno screenshot: non esiste una variante «semplificata» di questo
  requisito.
- **Il PDF** — è una **conferma d'ordine con QR di accesso, non un titolo fiscale**
  (`RF-TCK-11`). Denominazione, testi e contenuto lo dichiarano: **nessuna numerazione
  progressiva, nessun sigillo, nessuna dicitura** che possa farlo apparire tale. È una delle
  tre condizioni che reggono il posizionamento fiscale della piattaforma: non è una scelta di
  copywriting.
- **Service — `transfer(ticketId, emailOrNickname)`** — in **una** transazione: invalida il
  QR precedente (`qrRevokedAt`, `previousCode` su `TicketTransfer`), emette il nuovo,
  **sposta l'iscrizione** e **rivaluta i requisiti** sul nuovo titolare. Se il nuovo titolare
  ha un ruolo diverso, **rilascia il vecchio ruolo e impegna il nuovo nella stessa
  transazione**: se il nuovo ruolo è saturo il trasferimento è rifiutato e **nulla cambia**
  (`RF-TCK-7`, `RB8`).
- **Service — `issuePasses(...)`** — l'emissione manuale **non è mai bloccata dalle quote**
  (`RB20`, `RF-TCK-14`): si registra il consumo, si restituisce un **avviso** se si supera la
  capienza della sala, e si procede. Se l'evento usa quote per ruolo il **ruolo è
  obbligatorio** (`RF-TCK-15`). I pass in blocco senza nominativo sono **al portatore**:
  `bearer = true`, non trasferibili.
- **`TicketTransfer`** — sola lettura via API. Storico completo dei passaggi di titolarità.
- **WebSocket** — `ticket/transferred` a entrambe le parti e ai membri dell'organizzazione.

### 4.13 `CheckIn`

- **Prisma** — indice unico parziale su `(ticketId, sessionId)` quando `revokedAt` è nullo:
  **`RB7`, un QR vale una sola volta per sessione**. `Restrict` da `Ticket` e `Session`.
  Indici su `(sessionId, scannedAt)` e `deviceId`.
- **Regola strutturale** — **l'utilizzo non è uno stato del biglietto**: un Full Pass viene
  scansionato dodici volte in tre giorni e resta `VALID`. Il check-in è registrato sulla
  **coppia biglietto–sessione**; per gli eventi senza sessioni si usa la **sessione
  implicita**. Non aggiungere uno stato `USED` a `Ticket` per nessun motivo.
- **`GET /events/:id/checkin-manifest`** — restituisce la lista dell'evento in forma
  **firmata**, più la **chiave pubblica Ed25519** per la verifica offline, più le sessioni e
  i requisiti bloccanti in ingresso. È ciò che l'operatore scarica prima dell'evento
  (`RF-CHK-2`).
- **`POST /check-ins/sync`** — riceve la coda locale e restituisce
  `{ accepted[], conflicts[] }`. **I doppi ingressi rilevati in sincronizzazione sono
  restituiti come conflitti da risolvere, mai risolti in silenzio** (`RF-CHK-6`): il servizio
  crea la seconda riga con `conflictWithId` valorizzato e la lascia allo staff. Nessuna
  libreria lo fa di serie: è codice su misura, ed è deliberato.
- **`POST /tickets/verify`** — restituisce uno dei cinque `CheckInResult`, e su
  `REQUIREMENT_BLOCKED` **nomina il requisito mancante** (`RF-CHK-4`, `RF-REQ-7`). Su
  `ALREADY_USED` restituisce **ora e postazione del primo ingresso**.
- **Il check-in non consuma capienza** (`RB19`): le quote governano l'ammissione, il
  contatore presenze governa la sicurezza. Sono due assi distinti.
- **Minimizzazione** — la risposta di verifica contiene nominativo, **ruolo di ballo**,
  titolo, sessioni incluse e servizi acquistati. **Mai contatti, mai il contenuto dei
  requisiti, mai diete** (`RB12`): il `CHECKIN_OPERATOR` è il ruolo dei volontari e deve
  vedere il minimo indispensabile.
- **WebSocket** — `checkin/registered` ai membri dell'organizzazione, **immediato, non
  aggregato**: è il contatore presenze.

### 4.14 `Refund`

- **Prisma** — `Restrict` da `Order`. `SetNull` da `Registration` e `Ticket`. Indice su
  `(orderId, status)`.
- **Perimetro** — nel primo taglio **non esiste il motore di scaglioni**: il rimborso è
  **registrato a mano ma passa dal sistema** (`13` §5). Nessun rimborso in contanti fuori dal
  sistema, nemmeno alla porta (`RB15`).
- **Service — `execute(refundId)`** — in **una** transazione: esegue il rimborso su Stripe
  **sull'account connesso**, **rilascia le quote** dell'iscrizione e **invalida il QR**
  (`RF-RMB-9`). `presaleRightsRefunded` è un parametro esplicito: **default `0`** quando la
  rinuncia dipende dal partecipante, **pari all'intero** quando la causa è dell'organizzatore
  o della piattaforma (`03` §1 punto 2).
- **Controller** — creazione ed esecuzione riservate a `OWNER`
  (`EVERYTHING#REFUND#OWN`); `EVENT_MANAGER` ha solo `READ#REFUND#OWN`. Il `DANCER` legge i
  propri.

---
## §5 — Convenzioni backend

| Tema | Regola |
|---|---|
| Stratificazione | `Controller → Service → Repository`. Un controller non chiama mai un repository, un repository non conosce mai il contesto HTTP |
| Permessi | verificati **solo nei controller**, con la terna `ACTION#RESOURCE#SCOPE` della matrice §3.8 |
| Tenancy | **filtro `organizationId` obbligatorio nei finder** di ogni entità che discende da `Organization` (§1.5). Il permesso non basta |
| DTO | derivati da `@prisma-gen/zod`. `Create` può includere relazioni annidate creabili; **`Update` è scalare, mai cascading** |
| Campi calcolati dal server | prezzi, totali, diritti di prevendita, `assignedRole`, `payoutStatus`, `acceptedAt`/`acceptedIp`, `consumed`. **Mai accettati dal client**, in nessun DTO |
| Transazioni | ogni scrittura multipla sta in un `$transaction` nel **service**. I metodi di repository accettano un `tx?` opzionale e lo usano se presente |
| Prisma | `@prisma/client` **non compare mai** in un controller |
| Importi | `Int` in centesimi. Nessun `Float`, nessun `Decimal` in virgola mobile |
| Date | `DateTime` in UTC; il fuso di presentazione è `Europe/Rome` |
| `I18nText` | campo `Json` `{ it, en? }`. In assenza della traduzione l'API restituisce comunque l'oggetto: è il frontend a mostrare l'originale con l'indicazione della lingua |
| WebSocket | **solo** attraverso la porta del modulo, **solo** `sendToUser`, **sempre dopo il commit** della transazione (mai dentro) |
| Errori di dominio | `HttpError` con i `code` stabili del §3.3. Non restituire `500` per una condizione prevista come il sold-out |
| Rate limiting | su Redis, sugli endpoint di apertura vendite (`reserve`, `checkout`) e su quelli pubblici anonimi |
| Scheduler | processo periodico con lock distribuito su Redis: recupero delle prenotazioni scadute, controllo periodico dell'abilitazione all'incasso |
| Modelli di business inventati | **nessuno.** Se una regola non è in questo brief o nei documenti citati, si chiede (3+1) |

---

## §6 — Invarianti che questo brief pre-soddisfa

- [x] Ogni entità distinta è modellata separatamente — **30 entità con base REST propria più 3 figli posseduti, nessun accorpamento**.
- [x] Nessuna entità di infrastruttura re-modellata: audit e registri usano `Log` della
      foundation.
- [x] L'ordine di costruzione del §2 rispetta i prerequisiti di chiave esterna; il grafo è
      **aciclico** (`Couple` non punta alle `Registration`).
- [x] I figli posseduti — `TicketTypeSession`, `PriceTier`, `OrderLine` — sono modelli figli
      `onDelete: Cascade` **senza controller proprio**.
- [x] Ogni DTO `Update` è **scalare**, mai cascading.
- [x] I campi calcolati dal server sono elencati e **non compaiono in nessun DTO di
      scrittura**.
- [x] Ogni entità ha un `PermissionResource` e le concessioni per ruolo **rispecchiano
      esattamente** il gating dell'interfaccia dichiarato nel frontend brief.
- [x] Il contratto usa **solo** il dialetto keijo; gli endpoint non-CRUD sono enumerati in
      §3.7 e sono un elenco chiuso.
- [x] §3 identico byte per byte a quello di `frontend-brief.md`.

---

## §7 — Decisioni prese e assunzioni dichiarate

**Nessun `TBD` in questo file.** Quanto segue è deciso: non riaprirlo, segnalalo solo se
scopri che rende una feature impossibile.

### Decisioni del committente (3 agosto 2026)

| # | Decisione | Conseguenza sul backend |
|---|---|---|
| D-A | **Perimetro: primo taglio** (`13` §4) | Fuori: chat e Live Wall, bacheca cerco-partner, PayPal e Satispay, motore di rimborso a scaglioni, contestazioni di addebito, codici promozionali, onboarding self-service con coda di approvazione, calendario/ricerca/mappa pubblici |
| D-B | **Entità in inglese, interfaccia in italiano** | Le basi REST derivate dal plurale sono regolari; nessun plurale irregolare da dichiarare |
| D-C | **Tre applicazioni frontend**: `www` (SSR, pubblico) · `app` (keijo-ui) · `wall` (predisposta e vuota) | Il backend serve tutte e tre; gli endpoint `/api/public/*` sono **senza autenticazione** e restituiscono solo eventi pubblicati |
| D-D | **Rimborsi riservati all'`OWNER`**, mai alla cassa | `EVERYTHING#REFUND#OWN` solo a `OWNER`; `EVENT_MANAGER` ha `READ` |
| D-E | **L'`EVENT_MANAGER` pubblica da solo** | `POST /events/:id/publish` concesso a `EVENT_MANAGER`; la `FiscalDeclaration` di tipo `EVENT_ATTESTATION` è registrata a nome di chi compie l'atto |
| D-F | **Ruoli assegnati per organizzazione, mai per singolo evento** | **Deroga dichiarata a `RF-ORG-7`.** Nessuna tabella di assegnazione per evento; `OrganizationMember` è sufficiente. Conseguenza: il `CHECKIN_OPERATOR` vede tutti gli eventi dell'organizzazione. Con due o tre clienti è accettabile, e l'assegnazione per evento si aggiunge dopo senza rifare i permessi |
| D-G | **Nessun preset di ruolo «Staff» cumulativo** | I ruoli si assegnano uno per uno |
| D-H | **Il pubblico anonimo usa polling a 10–15 s**, non WebSocket | `POST /api/public/events/:id/availability` deve essere **economico e con rate limiting**: è l'endpoint più interrogato in apertura vendite |
| D-I | **Stripe Connect, direct charges + `application_fee_amount`** | I fondi non toccano mai il conto della piattaforma; dispute e penali arrivano all'organizzatore, come deciso in `11` D12. Il passaggio a *destination charges* deve restare confinato al solo service dei pagamenti |
| D-J | **Palette calda e scura ereditata dalla wall** | Nessun impatto sul backend |
| D-K | **File su disco locale del backend** | L'entità `File` della foundation punta al disco. **Rivedibile**: il passaggio a S3 sarà necessario quando servirà più di un'istanza o quando arriverà l'archivio della wall. Tenere l'accesso ai file dietro un'astrazione, non dietro percorsi assoluti sparsi |
| D-L | **Infrastruttura di produzione non decisa**, sviluppo in `docker compose` | Non blocca; ma **lo scheduler deve reggere più istanze**, quindi il lock distribuito su Redis va messo subito, non dopo |
| D-M | **`websocket` on, `mqtt` off, `tests` on** | Il caso T23 va automatizzato prima dell'apertura vendite |
| D-N | **2FA rinviato oltre il primo taglio** | `RF-ACC-6` rientra in fase 1b |

### Assunzioni dichiarate — le cinque domande di `13` §9 sono senza risposta

Il committente non ha ancora le risposte dei clienti. Quanto segue sono **assunzioni, non
ipotesi da verificare in corso d'opera**:

| # | Assunzione | Fondamento | Se cade |
|---|---|---|---|
| AS-1 | **Quote per ruolo e iscrizione a coppia: dentro** | `13` §3 mette il motore di `05` «per intero» tra le cose non tagliabili | Nessun impatto: è il prodotto |
| AS-2 | **Servizi accessori: `ServiceType`, `EventService` e quote di ambito `SERVICE` modellati**; UI di vendita minima | Le quote di ambito `SERVICE` fanno parte del motore | Se il primo evento vende una cena si aggiungono l'UI e le liste operative, **non lo schema** |
| AS-3 | **Vendita alla porta: fuori dal primo taglio** | `13` §5, «da valutare evento per evento» | **È l'unica assunzione che sposta il perimetro.** Rientrerebbero il ruolo `BO`, `RF-CHK-10→12` e la chiusura di cassa. Il modello lo regge già: `RegistrationChannel.DOOR_SALE` è previsto nell'enum |
| AS-4 | **Contingente per canali esterni: dentro** — è `CapacityQuota.reservedFor = EXTERNAL_CHANNEL`, non un'entità; registrazione delle vendite esterne e vista di allineamento: **fuori** | `13` §4 elenca `RF-EVT-32` tra le quote, ma il back-office si ferma a `RF-BKO-1→4, 6, 9` | Rientrerebbero `RF-BKO-10/11` e `RF-CHK-15`, presidio del rischio `R17`. Anche qui il modello regge: `EXTERNAL_CHANNEL` è già nell'enum dei canali |
| AS-5 | **Un solo `Session` implicito** per gli eventi senza sessioni, creato come **riga reale** | `09` §7 | Nessuno: tiene un solo percorso per check-in e quote |
| AS-6 | **Testi traducibili come campo `Json` `{it, en}`** | `RF-PUB-10` chiede di sapere cosa manca, non un modello relazionale delle traduzioni | Si passa a una tabella `Translation` **senza toccare il §3**, che espone comunque `I18nText` |
| AS-7 | **Firma del QR: Ed25519 in JWS compatto**, chiave pubblica distribuita con il manifest di check-in, `keyId` per la rotazione | Vincolo derivato: `RF-TCK-1` richiede verifica **offline**, quindi la chiave deve stare sul dispositivo | Qualunque altro schema deve comunque permettere la verifica senza rete |

### Questioni aperte che **non** bloccano la costruzione

| # | Questione | Serve entro |
|---|---|---|
| Q7 | **Data di apertura vendite del primo evento reale** — `13` §7 la chiama «la vera scadenza del progetto» | pianificazione |
| G3 | Provider delle email transazionali (template IT + EN, `RF-COM-1`, `RF-COM-6`) | prima delle notifiche |
| H5 | Strumento con cui la piattaforma emette il proprio documento sui diritti di prevendita (Q5 dell'analisi) | prima del primo incasso reale |
| — | Infrastruttura di produzione | prima del primo evento |
| Q6 | Tempi di conservazione dei dati | prima del primo evento |

### Precondizioni non tecniche che possono bloccare la partenza

Da `13` §7 — **nessuna è sviluppo, e tutte possono fermare il go-live**:

1. **Account Stripe Connect della piattaforma** e onboarding dei clienti con verifica di
   identità completata. Non è immediato: va avviato per primo.
2. **Condizioni di servizio e informativa privacy** nella versione minima ma reale, comprese
   la dichiarazione dell'organizzatore (`RF-ORG-8`) e l'accordo sul trattamento dei dati dei
   partecipanti.
3. **Testi del documento emesso** conformi a `RF-TCK-11`.
4. **La data del primo evento reale** (Q7).
