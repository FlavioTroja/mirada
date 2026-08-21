import { Service } from "fastify-decorators";
import { SalesChannelProvider } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { ExternalSaleChannelAdapter } from "@interfaces/ExternalSaleChannelAdapter";
import { ShopifyChannelAdapterService } from "@services/ShopifyChannelAdapterService";

/**
 * Prestatore → adapter — fase E.
 *
 * ── Perché un registro con un solo prestatore ───────────────────────────────
 * Perché è l'**unico** punto del sistema che deve cambiare quando ne arriva un
 * altro. `fastify-decorators` inietta per classe concreta e non sa iniettare
 * un'interfaccia: senza questo passaggio, ogni chiamante finirebbe per dipendere
 * da `ShopifyChannelAdapterService`, e il giorno di WooCommerce ci sarebbe un
 * `if` in ognuno di loro.
 *
 * Aggiungere un prestatore è: una voce nell'enum, una classe che implementa
 * `ExternalSaleChannelAdapter`, una riga qui.
 */
@Service()
export class SalesChannelAdapterRegistryService {
    constructor(private readonly shopify: ShopifyChannelAdapterService) {}

    public resolve(provider: SalesChannelProvider): ExternalSaleChannelAdapter {
        switch (provider) {
            case SalesChannelProvider.SHOPIFY:
                return this.shopify;
            default:
                // Irraggiungibile finché l'enum e questo switch restano allineati.
                // Esiste perché il giorno in cui non lo saranno, il messaggio dica
                // quale prestatore manca invece di lasciare un `undefined` che
                // esplode tre chiamate più in là.
                Log.error(`[SalesChannelAdapterRegistry Service]: no adapter registered for provider '${provider}'`);
                throw new httpErrors.NotImplemented(`Il canale di vendita '${provider}' non è ancora supportato.`);
        }
    }
}
