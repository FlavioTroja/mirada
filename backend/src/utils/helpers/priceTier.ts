import { PriceTier, PriceTierKind } from "@prisma/client";

/** Esito della valutazione degli scaglioni — `RF-EVT-26`. */
export type ActiveTier = {
    tier: PriceTier | null;
    price: number;
    expiresAt: Date | null;
    /** Residuo **reale** a quel prezzo; `null` quando lo scaglione non è a quantità. */
    remainingAtThisPrice: number | null;
};

/**
 * Selezione dello scaglione attivo — funzione **pura**, senza I/O.
 *
 * Estratta da `TicketTypeService.resolvePrice` perché la stessa valutazione serve
 * anche a `POST /api/public/events/:id/availability`, che è l'endpoint più
 * interrogato del sistema in apertura vendite e non può permettersi due query
 * per titolo. Una sola implementazione, due chiamanti: il prezzo mostrato nella
 * disponibilità e quello bloccato in checkout non possono divergere.
 *
 * Gli scaglioni vanno passati **nell'ordine dichiarato dall'organizzatore**
 * (`sortOrder`): si restituisce il primo applicabile.
 *  - `BY_DATE`     → `validUntil` non ancora superato;
 *  - `BY_QUANTITY` → `maxQuantity` non ancora esaurito;
 *  - `COMBINED`    → la congiunzione delle due.
 */
export function selectActiveTier(
    tiers: PriceTier[],
    basePrice: number,
    at: Date = new Date(),
    soldQuantityOverride?: number,
): ActiveTier {
    for (const tier of tiers) {
        const sold = soldQuantityOverride ?? tier.soldQuantity;
        const dateOk = tier.validUntil !== null && at.getTime() <= tier.validUntil.getTime();
        const quantityOk = tier.maxQuantity !== null && sold < tier.maxQuantity;

        const applicable =
            (tier.kind === PriceTierKind.BY_DATE && dateOk)
            || (tier.kind === PriceTierKind.BY_QUANTITY && quantityOk)
            || (tier.kind === PriceTierKind.COMBINED && dateOk && quantityOk);

        if (!applicable) {
            continue;
        }

        return {
            tier,
            price: tier.price,
            expiresAt: tier.validUntil,
            remainingAtThisPrice: tier.maxQuantity === null ? null : Math.max(0, tier.maxQuantity - sold),
        };
    }

    return { tier: null, price: basePrice, expiresAt: null, remainingAtThisPrice: null };
}
