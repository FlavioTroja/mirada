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

/** Matrice §3.8 — entità delle fasi A (passi 1→6), B (7→12) e C (13→16) del §2. */
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
];

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

export const seed_permissions = expand(MATRIX);
