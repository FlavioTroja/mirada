/**
 * Isolamento fra organizzazioni — backend-brief §1.5 e nota 1 del §3.8.
 *
 * `#OWN` per lo staff significa «delle righe dell'organizzazione di cui sono
 * membro». Il controllo di permesso in controller **non basta**: ogni finder di
 * repository su un'entità che discende da `Organization` porta un filtro
 * `organizationId` obbligatorio, risolto dal contesto dell'utente autenticato.
 *
 * `null` = nessuna restrizione, ed è riservato al solo `GOD` (allow-all implicito).
 * Un array vuoto = utente senza alcuna appartenenza: non vede nulla, nemmeno un
 * conteggio aggregato.
 */
export type OrganizationScope = number[] | null;

/** Righe della sola organizzazione del chiamante (colonna `organizationId` non nullable). */
export function organizationScopeWhere(scope: OrganizationScope): Record<string, unknown> {
    return scope === null ? {} : { organizationId: { in: scope } };
}

/**
 * Righe dell'organizzazione del chiamante **più** quelle di piattaforma
 * (`organizationId = null`): preset di rimborso, sale e artisti condivisi.
 */
export function organizationOrPlatformScopeWhere(scope: OrganizationScope): Record<string, unknown> {
    return scope === null
        ? {}
        : { OR: [{ organizationId: { in: scope } }, { organizationId: null }] };
}

/**
 * Filtro di tenancy per le entità che NON portano una colonna `organizationId` e
 * discendono da `Organization` attraverso una relazione (`Session`, `EventCast`,
 * `EventRequirement`, `EventService`, `TicketType` → `event`). Il §1.5 non ammette
 * eccezioni: anche qui il filtro è obbligatorio, non facoltativo.
 */
export function relationOrganizationScopeWhere(
    scope: OrganizationScope,
    relation: string,
): Record<string, unknown> {
    return scope === null ? {} : { [relation]: { organizationId: { in: scope } } };
}

/** Filtro sulla `Organization` stessa, dove la colonna di tenancy è `id`. */
export function organizationIdScopeWhere(scope: OrganizationScope): Record<string, unknown> {
    return scope === null ? {} : { id: { in: scope } };
}

/** True quando il chiamante può scrivere righe dell'organizzazione indicata. */
export function isWritableOrganization(scope: OrganizationScope, organizationId?: number | null): boolean {
    if (scope === null) {
        return true;
    }
    return !!organizationId && scope.includes(organizationId);
}
