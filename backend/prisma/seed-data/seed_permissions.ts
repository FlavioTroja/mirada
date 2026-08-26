import { RoleName } from "@prisma/client";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";

/**
 * Concessioni di permesso — backend-brief §3.8, limitate alle entità di FASE A.
 *
 * GOD non ha righe: `hasPermission` lo lascia passare sempre (allow-all implicito).
 * ADMIN e USER non hanno righe: sono residui del template e non appartengono al dominio.
 *
 * ─── Come la matrice del §3.8 diventa righe di PermissionConfig ────────────────
 * Il checker del template (`@utils/adapters/permission`) confronta la terna
 * `ACTION#RESOURCE#SCOPE` della rotta con le terne concesse per **uguaglianza
 * esatta**: non conosce jolly, quindi `EVERYTHING#X#EVERYTHING` non soddisfa una
 * rotta che chiede `CREATE#X#ALL`. Le celle della matrice sono perciò espanse
 * nelle terne che le rotte del dialetto §3.2 dichiarano davvero:
 *
 *   CREATE  → CREATE#RES#ALL        (POST /{plural}/create)
 *   READ    → READ#RES#SINGLE       (GET  /{plural}/:id)
 *             READ#RES#ALL          (POST /{plural}/)
 *   UPDATE  → UPDATE#RES#SINGLE     (PATCH  /{plural}/:id)
 *   DELETE  → DELETE#RES#SINGLE     (DELETE /{plural}/:id)
 *
 * La distinzione `#OWN` vs `#ALL` della matrice NON è quindi trasportata nella
 * terna: è realizzata — come impone il §1.5 e la nota 1 del §3.8 — dal **filtro
 * `organizationId` obbligatorio nei finder di repository**, che il permesso da
 * solo non può garantire. Il campo `ownScope` qui sotto dichiara quale cella
 * della matrice ha prodotto la riga, così la corrispondenza resta verificabile.
 */

/** Insieme di azioni di una cella della matrice. `EVERYTHING` = `∀`. */
const ALL_ACTIONS = [
    PermissionAction.CREATE,
    PermissionAction.READ,
    PermissionAction.UPDATE,
    PermissionAction.DELETE,
];

type Grant = {
    role: RoleName;
    actions: PermissionAction[];
    /** Cella del §3.8: "OWN" = limitato all'organizzazione/alle proprie righe, "ALL" = ogni riga. */
    ownScope: "OWN" | "ALL";
};

type ResourceMatrix = { resource: PermissionResource; grants: Grant[] };

const own = (role: RoleName, actions: PermissionAction[]): Grant => ({ role, actions, ownScope: "OWN" });
const all = (role: RoleName, actions: PermissionAction[]): Grant => ({ role, actions, ownScope: "ALL" });

const READ_ONLY = [PermissionAction.READ];

/**
 * Un file si **carica e si sostituisce**, non si modifica: il riferimento cambia
 * sull'entità (`posterVerticalFileId`, `photoFileId`, `logoFileId`) con il suo
 * `PATCH`. Nessun `UPDATE`/`DELETE` sul file stesso — §3.4.
 */
const CREATE_READ = [PermissionAction.CREATE, PermissionAction.READ];

/** Matrice §3.8 — entità delle fasi A (passi 1→6), B (7→12), C (13→16) e D1 (17, 23→26) del §2. */
const MATRIX: ResourceMatrix[] = [
    {
        // | ORGANIZATION | ∀ | READ/UPDATE#OWN | READ#OWN | READ#OWN | – |
        resource: PermissionResource.ORGANIZATION,
        grants: [
            own(RoleName.OWNER, [PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
        ],
    },
    {
        // | ORGANIZATION_MEMBER | ∀ | ∀#OWN | READ#OWN | – | – |
        resource: PermissionResource.ORGANIZATION_MEMBER,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
        ],
    },
    {
        // | DANCER_PROFILE | ∀ | – | – | – | ∀#OWN |
        resource: PermissionResource.DANCER_PROFILE,
        grants: [own(RoleName.DANCER, ALL_ACTIONS)],
    },
    {
        // | EVENT_TYPE · REQUIREMENT_TYPE · SERVICE_TYPE | ∀ | READ#ALL | READ#ALL | – | READ#ALL |
        resource: PermissionResource.EVENT_TYPE,
        grants: [
            all(RoleName.OWNER, READ_ONLY),
            all(RoleName.EVENT_MANAGER, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        resource: PermissionResource.REQUIREMENT_TYPE,
        grants: [
            all(RoleName.OWNER, READ_ONLY),
            all(RoleName.EVENT_MANAGER, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        resource: PermissionResource.SERVICE_TYPE,
        grants: [
            all(RoleName.OWNER, READ_ONLY),
            all(RoleName.EVENT_MANAGER, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // | REFUND_POLICY | ∀ | ∀#OWN | READ#ALL | – | READ#ALL |
        resource: PermissionResource.REFUND_POLICY,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            all(RoleName.EVENT_MANAGER, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // | VENUE · ARTIST | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ#ALL |
        resource: PermissionResource.VENUE,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // FILE — **eccezione della foundation dichiarata** (§3.4). Il §3.7 espone
        // `POST /files/upload-image`, che alimenta i tre ritagli della locandina
        // (RF-EVT-3), la foto dell'artista e il logo dell'organizzazione: senza
        // questa cella un EVENT_MANAGER non potrebbe caricare una locandina.
        //
        // | FILE | ∀ | CREATE/READ#OWN | CREATE/READ#OWN | READ#OWN | CREATE/READ#OWN |
        //
        // Niente UPDATE né DELETE: un file si sostituisce cambiando il riferimento
        // sull'entità, non si modifica. Conseguenza dichiarata: i file orfani non
        // sono ripulibili se non dal GOD — accettabile finché lo storage è il disco
        // locale del backend (decisione D-K), da rivedere con il passaggio a S3.
        resource: PermissionResource.FILE,
        grants: [
            own(RoleName.OWNER, CREATE_READ),
            own(RoleName.EVENT_MANAGER, CREATE_READ),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            own(RoleName.DANCER, CREATE_READ),
        ],
    },
    {
        resource: PermissionResource.ARTIST,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // ADDRESS — **eccezione della foundation completata** (§3.4): il template
        // spediva il solo `GET /addresses/cities`, ma `Venue.addressId` è
        // obbligatorio e senza creazione una location non è creabile. Il §3.4
        // prescrive «permessi come `VENUE`», quindi la cella è copiata da lì:
        // | ADDRESS | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ#ALL |
        //
        // Nota di effetto collaterale, dichiarata: la rotta preesistente
        // `PATCH /people/:id/addresses` dichiara già `UPDATE#ADDRESS#SINGLE`.
        // Concedendo `UPDATE` ad `OWNER` ed `EVENT_MANAGER` quella rotta diventa
        // raggiungibile anche da loro — ma `PersonService.updatePersonAddresses`
        // richiede comunque `UPDATE#PERSON#OWN` sulla propria persona o
        // `UPDATE#PERSON#ALL` su quella altrui, e nessuno dei due ruoli ha
        // concessioni su `PERSON`: l'accesso resta chiuso.
        resource: PermissionResource.ADDRESS,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },

    // ─── Fase B — passi 7→12 del §2 ──────────────────────────────────────────
    {
        // | FISCAL_DECLARATION | ∀ | CREATE/READ#OWN | CREATE/READ#OWN | – | – |
        // Nessun UPDATE e nessun DELETE per nessuno: la dichiarazione è immutabile
        // (§4.3), si crea una nuova versione. La matrice e le rotte concordano.
        resource: PermissionResource.FISCAL_DECLARATION,
        grants: [
            own(RoleName.OWNER, [PermissionAction.CREATE, PermissionAction.READ]),
            own(RoleName.EVENT_MANAGER, [PermissionAction.CREATE, PermissionAction.READ]),
        ],
    },
    {
        // | EVENT | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ#ALL |
        // `EVENT_MANAGER` pubblica da solo (nota 2 del §3.8): `publish` dichiara
        // UPDATE#EVENT#SINGLE, che la cella ∀#OWN già autorizza.
        resource: PermissionResource.EVENT,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // | SESSION · EVENT_CAST · EVENT_REQUIREMENT · EVENT_SERVICE | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ#ALL |
        resource: PermissionResource.SESSION,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        resource: PermissionResource.EVENT_CAST,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        resource: PermissionResource.EVENT_REQUIREMENT,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        resource: PermissionResource.EVENT_SERVICE,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },
    {
        // | TICKET_TYPE | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ#ALL |
        // Le due sub-risorse (`sessions`, `price-tiers`) e `price-preview` non
        // hanno un PermissionResource proprio: sono figli posseduti del titolo e
        // dichiarano le terne di TICKET_TYPE.
        resource: PermissionResource.TICKET_TYPE,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            all(RoleName.DANCER, READ_ONLY),
        ],
    },

    // ─── Fase C — il motore di capienza (passi 13→16) ────────────────────────
    {
        // | CAPACITY_QUOTA | ∀ | ∀#OWN | ∀#OWN | READ#OWN | – |
        // Il DANCER non ha alcun accesso: la configurazione di capienza è
        // dell'organizzatore. Al pubblico la disponibilità arriva dalla
        // proiezione di `POST /api/public/events/:id/availability`, che è
        // senza autenticazione e non espone né limiti né consumi grezzi.
        resource: PermissionResource.CAPACITY_QUOTA,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
        ],
    },
    {
        // | QUOTA_CONSUMPTION | ∀ | READ#OWN | READ#OWN | – | – |
        // SOLA LETTURA anche nella matrice: non esiste alcuna concessione di
        // scrittura, perché non esiste alcun endpoint di scrittura (§4.9).
        resource: PermissionResource.QUOTA_CONSUMPTION,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
        ],
    },
    {
        // | REGISTRATION | ∀ | ∀#OWN | ∀#OWN | READ#OWN | READ/UPDATE#OWN |
        resource: PermissionResource.REGISTRATION,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            own(RoleName.DANCER, [PermissionAction.READ, PermissionAction.UPDATE]),
        ],
    },
    {
        // | COUPLE | ∀ | ∀#OWN | ∀#OWN | – | READ#OWN |
        resource: PermissionResource.COUPLE,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.DANCER, READ_ONLY),
        ],
    },

    // ─── Fase D1 — requisiti, biglietti, pass e check-in (passi 17, 23→26) ───
    {
        // | REQUIREMENT_OUTCOME | ∀ | ∀#OWN | ∀#OWN | READ#OWN | CREATE/READ/UPDATE#OWN |
        // Il DANCER dichiara e corregge il proprio esito, non lo cancella: una
        // dichiarazione ritirata in silenzio è una dichiarazione mai data.
        resource: PermissionResource.REQUIREMENT_OUTCOME,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            own(RoleName.DANCER, [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE]),
        ],
    },
    {
        // | TICKET | ∀ | READ/UPDATE#OWN | READ/UPDATE#OWN | READ#OWN | READ/UPDATE#OWN |
        //
        // Nessun ruolo dell'interfaccia ha CREATE né DELETE, ed è coerente: i
        // biglietti nascono da una riga d'ordine pagata (fase D2) o da
        // un'emissione manuale di pass, mai da una creazione a mano. Le rotte del
        // dialetto restano dichiarate e sono di fatto riservate a GOD.
        //
        // `UPDATE` è anche la terna di `POST /tickets/:id/transfer`: il
        // trasferimento È un aggiornamento del titolare, e la riga di
        // `TicketTransfer` ne è lo storico. Vedi la nota nel controller.
        resource: PermissionResource.TICKET,
        grants: [
            own(RoleName.OWNER, [PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.EVENT_MANAGER, [PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.CHECKIN_OPERATOR, READ_ONLY),
            own(RoleName.DANCER, [PermissionAction.READ, PermissionAction.UPDATE]),
        ],
    },
    {
        // | TICKET_TRANSFER | ∀ | READ#OWN | READ#OWN | – | CREATE/READ#OWN |
        // SOLA LETTURA via API (§3.4): le righe nascono solo dentro la
        // transazione di `POST /tickets/:id/transfer`. La cella `CREATE` del
        // DANCER è seminata perché la matrice la dichiara, ma nessuna rotta
        // dichiara quella terna: uno storico che si può scrivere da fuori non è
        // uno storico.
        resource: PermissionResource.TICKET_TRANSFER,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
            own(RoleName.DANCER, [PermissionAction.CREATE, PermissionAction.READ]),
        ],
    },
    {
        // | PASS_ISSUANCE | ∀ | ∀#OWN | ∀#OWN | – | – |
        // Il CHECKIN_OPERATOR non emette pass: emettere è un atto commerciale,
        // scansionare è un atto di porta, e il volontario fa il secondo.
        resource: PermissionResource.PASS_ISSUANCE,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
        ],
    },
    {
        // | CHECK_IN | ∀ | ∀#OWN | ∀#OWN | CREATE/READ/UPDATE#OWN | – |
        // Il DANCER non ha alcun accesso: le presenze in sala non sono un dato
        // del partecipante. `READ#CHECK_IN#ALL` è anche la terna del manifest
        // firmato, ed è ciò che impedisce a un DANCER — che ha `READ#EVENT#ALL` —
        // di scaricare la lista degli iscritti di un evento qualunque.
        resource: PermissionResource.CHECK_IN,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, ALL_ACTIONS),
            own(RoleName.CHECKIN_OPERATOR, [
                PermissionAction.CREATE,
                PermissionAction.READ,
                PermissionAction.UPDATE,
            ]),
        ],
    },

    // ─── Fase D2 — il checkout (passi 18→22) ─────────────────────────────────
    {
        // | PURCHASE · ORDER | ∀ | READ#OWN | READ#OWN | – | CREATE/READ#OWN |
        //
        // Il `CREATE` del DANCER è la terna delle **cinque rotte d'azione** di
        // `OrderController` — `reserve`, `rearm`, `abandon`, `confirm-partial`,
        // `confirm-free` — che il §4.11 dichiara letteralmente come
        // `CREATE#ORDER#OWN`. Non è un `POST /orders/create`: quello non esiste,
        // perché un ordine impegna capienza e nasce solo da `reserve`, che è
        // atomico per costruzione.
        //
        // Lo staff ha la sola lettura: un `OWNER` legge gli ordini che incassa e
        // non può abbandonare quello di un partecipante — abbandonare è liberare
        // un posto altrui.
        resource: PermissionResource.PURCHASE,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
            own(RoleName.DANCER, CREATE_READ),
        ],
    },
    {
        resource: PermissionResource.ORDER,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
            own(RoleName.DANCER, CREATE_READ),
        ],
    },
    {
        // | RESERVATION | ∀ | READ#OWN | READ#OWN | – | CREATE/READ/DELETE#OWN |
        //
        // SOLA LETTURA via API (§3.4): la prenotazione nasce dentro `reserve` e
        // muore con `abandon`, con la conferma o con lo scheduler. Le celle
        // `CREATE` e `DELETE` del DANCER sono seminate perché la matrice §3.8 le
        // dichiara, ma **nessuna rotta dichiara quelle terne**: una prenotazione
        // creabile da fuori sarebbe un modo per togliere posti dalla sala senza
        // comprare nulla, e una cancellabile da fuori lascerebbe i consumi
        // orfani. L'abbandono passa da `POST /orders/:id/abandon`, che rilascia
        // la capienza nella stessa transazione.
        resource: PermissionResource.RESERVATION,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
            own(RoleName.DANCER, [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.DELETE]),
        ],
    },
    {
        // | PAYMENT | ∀ | READ#OWN | – | – | READ#OWN |
        //
        // L'`EVENT_MANAGER` non vede gli incassi: costruisce e pubblica eventi,
        // non amministra il denaro dell'organizzazione. SOLA LETTURA per tutti:
        // le righe nascono dentro la chiusura di un ordine, e `idempotencyKey`
        // unica non sarebbe una difesa se un pagamento si potesse scrivere con
        // una `POST`.
        resource: PermissionResource.PAYMENT,
        grants: [
            own(RoleName.OWNER, READ_ONLY),
            own(RoleName.DANCER, READ_ONLY),
        ],
    },

    // ─── Fase E — i canali di vendita esterni ────────────────────────────────
    {
        // | SALES_CHANNEL | ∀ | ∀#OWN | READ#OWN | – | – |
        //
        // Collegare un negozio è un atto **dell'intestatario**: si incolla un
        // token che legge ordini e anagrafiche di tutto il negozio, e si decide
        // quali titoli quel negozio può vendere. L'`EVENT_MANAGER` legge la
        // configurazione — gli serve per capire da dove arrivano gli iscritti che
        // vede — e non la cambia.
        //
        // Il `DANCER` non compare: un canale di vendita non è un dato del
        // partecipante, nemmeno in lettura.
        resource: PermissionResource.SALES_CHANNEL,
        grants: [
            own(RoleName.OWNER, ALL_ACTIONS),
            own(RoleName.EVENT_MANAGER, READ_ONLY),
        ],
    },
    {
        // | EXTERNAL_SALE | ∀ | READ/UPDATE#OWN | READ/UPDATE#OWN | – | – |
        //
        // SOLA LETTURA come entità (§3.4): le righe nascono dall'ingestione, mai
        // da una `POST`. Una vendita esterna scrivibile da fuori sarebbe un modo
        // per emettere biglietti senza che nessuno abbia pagato nulla.
        //
        // L'`UPDATE` è la terna di `POST /external-sales/:id/reingest`, e
        // l'`EVENT_MANAGER` ce l'ha: sbloccare una quarantena è lavoro d'evento —
        // qualcuno ha pagato e aspetta il biglietto — e farlo dipendere dalla
        // presenza dell'intestatario significherebbe farlo aspettare fino a
        // quando quello legge le notifiche.
        resource: PermissionResource.EXTERNAL_SALE,
        grants: [
            own(RoleName.OWNER, [PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.EVENT_MANAGER, [PermissionAction.READ, PermissionAction.UPDATE]),
        ],
    },

    // ─── L'acconto e il saldo (`14` §6.3, `RF-SAL-9`) ─────────────────────────
    {
        // | BALANCE_SETTLEMENT | ∀ | ∀#OWN | ∀#OWN | CREATE/READ#OWN | – | – |
        //
        // ── Il CHECKIN_OPERATOR non compare, ed è il punto ────────────────────
        // `RB27`: chi non tiene la cassa vede **che** un saldo esiste, mai quanto
        // vale. Il flag della verifica alla porta non passa da qui — è un dato
        // dell'iscrizione — mentre l'importo e le righe di incasso sì. Il
        // volontario che scansiona legge «saldo da versare, manda alla cassa» e
        // nient'altro, e non perché la schermata lo nasconda: perché il permesso
        // che serve per leggere la cifra non ce l'ha.
        //
        // ── Il DELETE non c'è per nessuno ─────────────────────────────────────
        // Una riga di incasso è un fatto: qualcuno ha preso in mano dei soldi.
        // Si corregge con una riga che la contraddice, non facendola sparire —
        // altrimenti la cassa quadra sullo schermo e non nel cassetto.
        resource: PermissionResource.BALANCE_SETTLEMENT,
        grants: [
            own(RoleName.OWNER, [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.EVENT_MANAGER, [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE]),
            own(RoleName.BOX_OFFICE, [PermissionAction.CREATE, PermissionAction.READ]),
        ],
    },
];

/**
 * **La cassa vede la porta, più il registro dei saldi.**
 *
 * `BOX_OFFICE` eredita ogni concessione del `CHECKIN_OPERATOR` invece di
 * riscriverle una per una, e la ragione non è la brevità: sono diciassette righe
 * sparse su quindici risorse, e il giorno in cui la porta guadagnasse un
 * permesso, la copia scritta a mano resterebbe indietro **in silenzio** — la
 * cassa smetterebbe di poter fare a una postazione ciò che fa all'altra, e il
 * difetto si scoprirebbe la sera dell'evento.
 *
 * Il verso conta: la cassa è la porta **più** qualcosa, mai meno. Ciò che il
 * `BOX_OFFICE` ha in proprio — il registro dei saldi qui sopra — è dichiarato
 * nella matrice e questa funzione non lo tocca.
 */
function withBoxOffice(matrix: ResourceMatrix[]): ResourceMatrix[] {
    return matrix.map(entry => {
        const doorGrant = entry.grants.find(grant => grant.role === RoleName.CHECKIN_OPERATOR);
        const already = entry.grants.some(grant => grant.role === RoleName.BOX_OFFICE);
        if (!doorGrant || already) {
            return entry;
        }
        return { ...entry, grants: [...entry.grants, { ...doorGrant, role: RoleName.BOX_OFFICE }] };
    });
}

/** Terne di rotta prodotte da una singola azione della matrice. */
const ROUTE_SCOPES: Record<string, PermissionScope[]> = {
    [PermissionAction.CREATE]: [PermissionScope.ALL],
    [PermissionAction.READ]: [PermissionScope.SINGLE, PermissionScope.ALL],
    [PermissionAction.UPDATE]: [PermissionScope.SINGLE],
    [PermissionAction.DELETE]: [PermissionScope.SINGLE],
};

function expand(matrix: ResourceMatrix[]) {
    const rows: { roleName: RoleName; action: string; entity: string; scope: string }[] = [];
    const seen = new Set<string>();

    for (const { resource, grants } of matrix) {
        for (const grant of grants) {
            for (const action of grant.actions) {
                // Terne del dialetto CRUD (§3.2) + la terna letterale della cella,
                // che alcune rotte non-CRUD del §3.7 dichiarano esplicitamente
                // (es. `GET /organizations/:id/payout-status` → READ#ORGANIZATION#OWN, §4.2).
                const scopes = [
                    ...(ROUTE_SCOPES[action] ?? []),
                    grant.ownScope === "OWN" ? PermissionScope.OWN : PermissionScope.ALL,
                ];

                for (const scope of scopes) {
                    const key = `${grant.role}#${action}#${resource}#${scope}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    rows.push({ roleName: grant.role, action, entity: resource, scope });
                }
            }
        }
    }

    return rows;
}

export const seed_permissions = expand(withBoxOffice(MATRIX));
