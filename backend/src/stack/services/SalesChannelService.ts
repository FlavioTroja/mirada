import { Service } from "fastify-decorators";
import {
    ExternalSale,
    ExternalSaleStatus,
    Prisma,
    SalesChannel,
    SalesChannelDepositCode,
    SalesChannelMapping,
    SalesChannelStatus,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { seal } from "@utils/adapters/secretBox";
import { generateRandomString } from "@utils/helpers/crypto";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { splitLinkableEntities } from "@utils/helpers/mergeEntities";
import { normalizeDepositCode } from "@utils/helpers/depositCode";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { SalesChannelCreateDTO } from "@DTOs/sales_channel/SalesChannelCreateDTO";
import { SalesChannelUpdateDTO } from "@DTOs/sales_channel/SalesChannelUpdateDTO";
import { SalesChannelQueryDTO } from "@DTOs/sales_channel/SalesChannelQueryDTO";
import { SalesChannelMappingUpdateDTO } from "@DTOs/sales_channel/SalesChannelMappingUpdateDTO";
import { SalesChannelDepositCodeUpdateDTO } from "@DTOs/sales_channel/SalesChannelDepositCodeUpdateDTO";
import { ExternalSaleQueryDTO } from "@DTOs/external_sale/ExternalSaleQueryDTO";
import { SalesChannelRepository } from "@repositories/SalesChannelRepository";
import { SalesChannelMappingRepository } from "@repositories/SalesChannelMappingRepository";
import { SalesChannelDepositCodeRepository } from "@repositories/SalesChannelDepositCodeRepository";
import { ExternalSaleRepository } from "@repositories/ExternalSaleRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { ExternalSaleIngestionService } from "@services/ExternalSaleIngestionService";
import { SalesChannelAdapterRegistryService } from "@services/SalesChannelAdapterRegistryService";

/** Lunghezza del segmento opaco in URL del webhook. */
const PUBLIC_ID_LENGTH = 32;

/**
 * Da quanto indietro riparte la riconciliazione di un canale che non ne ha mai
 * fatta una. Ventiquattro ore: abbastanza da coprire un collegamento fatto ieri
 * sera, poco abbastanza da non rileggere lo storico di un negozio che vende da
 * anni.
 */
const FIRST_RECONCILIATION_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type ReconciliationOutcome = {
    channelsExamined: number;
    salesExamined: number;
    salesIngested: number;
    failures: number;
};

/**
 * # `SalesChannel` — la configurazione dei negozi esterni (fase E)
 *
 * Il lato back-office: collegare un negozio, dirgli quale prodotto è quale
 * titolo, rimediare a una quarantena, e la passata di riconciliazione.
 *
 * L'ingestione vera sta in `ExternalSaleIngestionService`: qui non si registra
 * nessuna vendita, si prepara soltanto il terreno perché quella possa farlo.
 */
@Service()
export class SalesChannelService {
    constructor(
        private readonly salesChannelRepository: SalesChannelRepository,
        private readonly salesChannelMappingRepository: SalesChannelMappingRepository,
        private readonly salesChannelDepositCodeRepository: SalesChannelDepositCodeRepository,
        private readonly externalSaleRepository: ExternalSaleRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly ingestionService: ExternalSaleIngestionService,
        private readonly adapterRegistry: SalesChannelAdapterRegistryService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // CRUD del dialetto (§3.2)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Collega un negozio.
     *
     * I due segreti entrano in chiaro e finiscono in colonna **cifrati**: da qui
     * in poi non esiste una lettura che li restituisca. `publicId` lo genera il
     * server — è il segmento in URL del webhook, e un client che potesse
     * sceglierlo potrebbe rivendicare quello di un'altra organizzazione.
     */
    public async save(principalId: number, dto: SalesChannelCreateDTO): Promise<SalesChannel> {
        const scope = await this.organizationScopeService.resolve(principalId);
        // L'organizzazione la DERIVA il server (§OrganizationScopeService).
        const organizationId = this.organizationScopeService.resolveOwner(scope, dto.organizationId);

        const duplicate = await this.salesChannelRepository.findByShop(dto.provider, dto.externalShopId);
        if (duplicate) {
            // Lo stesso negozio su due organizzazioni farebbe comparire le
            // vendite dell'una nel cruscotto dell'altra — e l'isolamento fra
            // organizzazioni (§1.5) non è negoziabile.
            Log.warn(
                `[SalesChannel Service]: connection refused — shop '${dto.externalShopId}' is already connected to `
                + `sales channel (id ${duplicate.id}) of organization (id ${duplicate.organizationId})`,
            );
            throw new httpErrors.Conflict("Questo negozio è già collegato a un'organizzazione.");
        }

        Log.info(
            `[SalesChannel Service]: connecting ${dto.provider} shop '${dto.externalShopId}' to organization `
            + `(id ${dto.organizationId})`,
        );

        const channel = await this.salesChannelRepository.save({
            ...(dto as Prisma.SalesChannelUncheckedCreateInput),
            organizationId: organizationId as number,
            publicId: generateRandomString(PUBLIC_ID_LENGTH),
            webhookSecret: seal(dto.webhookSecret),
            credentials: dto.credentials ? seal(JSON.stringify({ accessToken: dto.credentials })) : null,
        });

        Log.info(`[SalesChannel Service]: sales channel connected (id ${channel.id}, label '${channel.label}')`);
        return channel;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<SalesChannel | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.salesChannelRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: SalesChannelQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<SalesChannel>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.salesChannelRepository.paginateInScope(scope, this.queryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: SalesChannelUpdateDTO): Promise<SalesChannel> {
        const channel = await this.findByIdOrThrow(principalId, id);

        Log.info(`[SalesChannel Service]: updating sales channel (id ${channel.id})`);

        return this.salesChannelRepository.update({ id: channel.id }, {
            ...(dto as Prisma.SalesChannelUncheckedUpdateInput),
            ...(dto.webhookSecret && { webhookSecret: seal(dto.webhookSecret) }),
            ...(dto.credentials && { credentials: seal(JSON.stringify({ accessToken: dto.credentials })) }),
        });
    }

    /**
     * Scollega il negozio.
     *
     * Cancellazione logica, come ovunque: le vendite già registrate restano
     * agganciate al canale da cui sono arrivate, e una traccia commerciale che
     * sparisce quando si scollega un negozio non è una traccia.
     */
    public async deleteById(principalId: number, id: number): Promise<SalesChannel> {
        const channel = await this.findByIdOrThrow(principalId, id);
        Log.info(`[SalesChannel Service]: disconnecting sales channel (id ${channel.id}, label '${channel.label}')`);
        return this.salesChannelRepository.safeDeleteById(channel.id);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Le associazioni prodotto → titolo (regola 12 di `controllers.md`)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * `PUT /sales-channels/:id/mappings` — l'intera collezione in un colpo solo.
     *
     * Un solo `PUT` che porta lo stato desiderato: `id: -1` crea,
     * `toBeDisconnected` toglie, il resto aggiorna. Tutto dentro **una**
     * transazione, perché una mappatura applicata a metà è peggio di una non
     * applicata: le righe che passano si ingeriscono, quelle che non passano
     * finiscono in quarantena, e l'organizzatore vede un risultato che non
     * corrisponde a ciò che ha salvato.
     */
    public async updateMappings(
        principalId: number,
        salesChannelId: number,
        dto: SalesChannelMappingUpdateDTO,
    ): Promise<SalesChannelMapping[]> {
        const channel = await this.findByIdOrThrow(principalId, salesChannelId);
        await this.assertTicketTypesBelongToOrganization(channel, dto);

        const { toCreate, toUpdate, toDisconnect } = splitLinkableEntities(dto);

        Log.info(
            `[SalesChannel Service]: replacing product mappings of sales channel (id ${channel.id}) — `
            + `${toCreate.length} to create, ${toUpdate.length} to update, ${toDisconnect.length} to remove`,
        );

        await getPrismaClient().$transaction(async prisma => {
            for (const row of toDisconnect) {
                await this.salesChannelMappingRepository.safeDeleteById(row.id!, prisma);
            }
            for (const row of toUpdate) {
                await this.salesChannelMappingRepository.update(
                    { id: row.id! },
                    {
                        externalProductId: row.externalProductId,
                        externalVariantId: row.externalVariantId ?? "",
                        ticketTypeId: row.ticketTypeId ?? null,
                        seatsPerUnit: row.seatsPerUnit ?? 1,
                    },
                    undefined,
                    undefined,
                    prisma,
                );
            }
            for (const row of toCreate) {
                await this.salesChannelMappingRepository.save(
                    {
                        salesChannelId: channel.id,
                        externalProductId: row.externalProductId,
                        externalVariantId: row.externalVariantId ?? "",
                        ticketTypeId: row.ticketTypeId ?? null,
                        seatsPerUnit: row.seatsPerUnit ?? 1,
                    },
                    prisma,
                );
            }
        });

        return this.salesChannelMappingRepository.findByChannel(channel.id);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // I codici di acconto (`14` §3.1, `RF-SAL-1`)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * `PUT /sales-channels/:id/deposit-codes` — l'intera collezione in un colpo
     * solo, come le mappature.
     *
     * ── Che cosa fa davvero questo elenco ───────────────────────────────────
     * Dice quali codici sconto del negozio significano «acconto», e quindi quali
     * vendite lasciano dietro un **saldo da incassare alla porta**. È l'unico
     * segnale disponibile: per il negozio quell'ordine è pagato per intero a un
     * prezzo ridotto, e il residuo esiste solo dentro Mirada (`14` §2).
     *
     * ── Toglierne uno non riscrive il passato ───────────────────────────────
     * I residui già nati restano sulle iscrizioni: sono debiti di persone reali,
     * non una vista sulla configurazione. Cancellare un codice significa «da
     * adesso questo non è più un acconto», non «quelle persone non devono più
     * niente».
     */
    public async updateDepositCodes(
        principalId: number,
        salesChannelId: number,
        dto: SalesChannelDepositCodeUpdateDTO,
    ): Promise<SalesChannelDepositCode[]> {
        const channel = await this.findByIdOrThrow(principalId, salesChannelId);

        const { toCreate, toUpdate, toDisconnect } = splitLinkableEntities(dto);

        // La normalizzazione avviene **qui**, una volta, perché la colonna porti
        // già la forma su cui l'ingestione confronta (`RF-SAL-2`). Un codice che
        // si riduce al nulla — solo spazi — non è un codice: passerebbe il
        // salvataggio e non corrisponderebbe mai a niente, che è il difetto muto
        // che questa funzione esiste per evitare.
        const normalized = new Map<number | undefined, string>();
        const seen = new Set<string>();

        for (const row of [...toCreate, ...toUpdate]) {
            const code = normalizeDepositCode(row.code ?? "");
            if (!code) {
                Log.warn(`[SalesChannel Service]: deposit code refused on sales channel (id ${channel.id}) — empty code`);
                throw new httpErrors.BadRequest("Un codice di acconto non può essere vuoto.");
            }
            if (seen.has(code)) {
                Log.warn(
                    `[SalesChannel Service]: deposit code refused on sales channel (id ${channel.id}) — `
                    + `'${code}' appears twice in the same payload`,
                );
                throw new httpErrors.BadRequest(`Il codice «${code}» compare due volte: i codici sono distinti.`);
            }
            seen.add(code);
            normalized.set(row.id, code);
        }

        Log.info(
            `[SalesChannel Service]: replacing deposit codes of sales channel (id ${channel.id}) — `
            + `${toCreate.length} to create, ${toUpdate.length} to update, ${toDisconnect.length} to remove`,
        );

        await getPrismaClient().$transaction(async prisma => {
            for (const row of toDisconnect) {
                await this.salesChannelDepositCodeRepository.safeDeleteById(row.id!, prisma);
            }
            for (const row of toUpdate) {
                await this.salesChannelDepositCodeRepository.update(
                    { id: row.id! },
                    { code: normalized.get(row.id)!, label: row.label },
                    undefined,
                    undefined,
                    prisma,
                );
            }
            for (const row of toCreate) {
                await this.salesChannelDepositCodeRepository.save(
                    {
                        salesChannelId: channel.id,
                        code: normalized.get(row.id)!,
                        label: row.label,
                    },
                    prisma,
                );
            }
        });

        return this.salesChannelDepositCodeRepository.findByChannel(channel.id);
    }

    /**
     * Un titolo di un'altra organizzazione, mappato sul proprio negozio,
     * venderebbe posti dell'evento di qualcun altro. Il permesso da solo non lo
     * impedisce: lo impedisce questo controllo (§1.5).
     */
    private async assertTicketTypesBelongToOrganization(
        channel: SalesChannel,
        dto: SalesChannelMappingUpdateDTO,
    ): Promise<void> {
        const ticketTypeIds = [...new Set(
            dto.filter(row => !row.toBeDisconnected && row.ticketTypeId)
                .map(row => row.ticketTypeId as number),
        )];

        for (const ticketTypeId of ticketTypeIds) {
            // Lo scope passato è quello del CANALE, non del chiamante: chi è
            // membro di due organizzazioni non deve poter mappare il titolo
            // dell'una sul negozio dell'altra. Il filtro del §1.5 fa il lavoro,
            // e la risposta non distingue «non esiste» da «non è tuo» — un
            // messaggio più preciso sarebbe un modo per sapere quali titoli
            // esistono altrove.
            const ticketType = await this.ticketTypeRepository.findOneInScope(
                [channel.organizationId],
                { id: ticketTypeId, deleted: false },
            );
            if (!ticketType) {
                Log.warn(
                    `[SalesChannel Service]: mapping refused — ticket type (id ${ticketTypeId}) is not a ticket type of `
                    + `organization (id ${channel.organizationId})`,
                );
                throw new httpErrors.BadRequest("Il titolo d'ingresso indicato non è un titolo della tua organizzazione.");
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Le vendite e la quarantena
    // ═════════════════════════════════════════════════════════════════════════

    public async findSaleById(principalId: number, id: number, options?: FindOptions): Promise<ExternalSale | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.externalSaleRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginateSales(
        principalId: number,
        query: ExternalSaleQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<ExternalSale>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.externalSaleRepository.paginateInScope(scope, this.saleQueryFromPayload(query), options);
    }

    /**
     * `POST /external-sales/:id/reingest` — rimedia a una quarantena.
     *
     * Rilegge la vendita **dalla propria riga**, non dal negozio: la forma
     * canonica è già lì, e dipendere dalla risposta del negozio proprio nel
     * momento in cui si sta rimediando a un guasto è il modo di avere due guasti.
     *
     * Non è una scorciatoia per ingerire due volte: `ingest` è idempotente sullo
     * stato `INGESTED`, e ciò che è già entrato resta un no-op.
     */
    public async reingest(principalId: number, id: number): Promise<ExternalSale> {
        const sale = await this.findSaleByIdOrThrow(principalId, id);

        if (sale.status !== ExternalSaleStatus.QUARANTINED && sale.status !== ExternalSaleStatus.FAILED) {
            Log.warn(`[SalesChannel Service]: reingestion refused — external sale (id ${sale.id}) is ${sale.status}`);
            throw new httpErrors.BadRequest(
                "Solo una vendita in quarantena o fallita può essere rielaborata.",
            );
        }

        const channel = await this.salesChannelRepository.findOne({ id: sale.salesChannelId, deleted: false });
        if (!channel) {
            Log.error(`[SalesChannel Service]: external sale (id ${sale.id}) points at a disconnected sales channel`);
            throw new httpErrors.BadRequest("Il canale di vendita di questa vendita è stato scollegato.");
        }

        Log.info(`[SalesChannel Service]: reingesting external sale (id ${sale.id}) of sales channel (id ${channel.id})`);

        // Gli sconti della forma canonica possono mancare — la vendita è finita
        // in quarantena prima che il canonico li conoscesse — e senza di essi il
        // residuo dell'acconto non nascerebbe (`14` §3.6). `hydrateDiscounts` li
        // recupera dal corpo grezzo quando c'è ancora.
        const canonical = await this.ingestionService.hydrateDiscounts(channel, sale);
        return this.ingestionService.ingest(channel, canonical);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La riconciliazione
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Una passata su tutti i canali attivi: chiede al negozio le vendite
     * incassate dopo l'ultima passata e ingerisce quelle che mancano.
     *
     * ── Perché serve, se c'è già il webhook ─────────────────────────────────
     * Perché i webhook si perdono. Il backend fermo dieci minuti per un
     * aggiornamento, una rete che cade, il prestatore che dopo una serie di
     * consegne fallite **smette di notificare**: in tutti e tre i casi quelle
     * vendite non tornano più da sole, e l'unica traccia che qualcosa manca è la
     * persona che si presenta all'ingresso senza biglietto.
     *
     * ── Un canale che fallisce non ferma gli altri ──────────────────────────
     * Ogni canale è isolato nel proprio `try`. Un negozio irraggiungibile — o un
     * token revocato dall'organizzatore senza dirlo — non deve impedire la
     * riconciliazione di tutti gli altri organizzatori della piattaforma.
     *
     * ── `lastReconciledAt` si sposta solo se la passata è riuscita ──────────
     * Spostarlo comunque significherebbe saltare per sempre la finestra in cui
     * la chiamata è fallita: la prossima passata ripartirebbe da dopo le vendite
     * che non siamo riusciti a leggere.
     */
    public async reconcile(): Promise<ReconciliationOutcome> {
        const channels = await this.salesChannelRepository.findActive();
        const outcome: ReconciliationOutcome = {
            channelsExamined: channels.length,
            salesExamined: 0,
            salesIngested: 0,
            failures: 0,
        };

        for (const channel of channels) {
            const since = channel.lastReconciledAt
                ?? new Date(Date.now() - FIRST_RECONCILIATION_LOOKBACK_MS);

            try {
                const adapter = this.adapterRegistry.resolve(channel.provider);
                const sales = await adapter.fetchSalesUpdatedSince(channel, since);
                outcome.salesExamined += sales.length;

                for (const sale of sales) {
                    const known = await this.externalSaleRepository.findByExternalOrder(channel.id, sale.externalOrderId);
                    if (known) {
                        continue;
                    }
                    Log.info(
                        `[SalesChannel Service]: reconciliation found unseen external order ${sale.externalOrderId} `
                        + `on sales channel (id ${channel.id}) — the webhook never arrived`,
                    );
                    await this.ingestionService.ingest(channel, sale);
                    outcome.salesIngested += 1;
                }

                await this.salesChannelRepository.update({ id: channel.id }, { lastReconciledAt: new Date() });
            } catch (err) {
                outcome.failures += 1;
                Log.error(
                    `[SalesChannel Service]: reconciliation of sales channel (id ${channel.id}) failed: `
                    + `${(err as Error).message} — its horizon is left untouched, the next pass retries the same window`,
                );
            }
        }

        Log.info(
            `[SalesChannel Service]: reconciliation pass over ${outcome.channelsExamined} active channel(s) — `
            + `${outcome.salesExamined} paid order(s) examined, ${outcome.salesIngested} ingested, `
            + `${outcome.failures} channel(s) failed`,
        );
        return outcome;
    }

    /**
     * Riprende ciò che è rimasto a metà: vendite registrate e mai elaborate — il
     * canale era in pausa, il processo è caduto fra la scrittura e l'ingestione —
     * e vendite fallite per una ragione tecnica.
     *
     * **La quarantena non è qui dentro**, e la differenza è la ragione per cui
     * esistono due stati: una mappatura che manca non si materializza
     * riprovando, e ritentarla ogni dieci minuti riempirebbe il registro di
     * errori identici nascondendo quelli veri. La quarantena aspetta una persona,
     * e la persona la sblocca con `reingest`.
     */
    public async retryPending(): Promise<{ examined: number; ingested: number; failures: number }> {
        const pending = await this.externalSaleRepository.findRetryable();
        const outcome = { examined: pending.length, ingested: 0, failures: 0 };

        for (const sale of pending) {
            const channel = await this.salesChannelRepository.findOne({ id: sale.salesChannelId, deleted: false });
            if (!channel || channel.status !== SalesChannelStatus.ACTIVE) {
                // Canale in pausa o scollegato: la vendita resta dov'è, e
                // riprenderà quando il canale torna attivo. Non è un fallimento.
                continue;
            }

            try {
                await this.ingestionService.ingest(channel, await this.ingestionService.hydrateDiscounts(channel, sale));
                outcome.ingested += 1;
            } catch (err) {
                outcome.failures += 1;
                Log.error(
                    `[SalesChannel Service]: retry of external sale (id ${sale.id}) failed: ${(err as Error).message}`,
                );
            }
        }

        if (outcome.examined) {
            Log.info(
                `[SalesChannel Service]: retry pass over ${outcome.examined} pending sale(s) — `
                + `${outcome.ingested} ingested, ${outcome.failures} still failing`,
            );
        }
        return outcome;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Interni
    // ═════════════════════════════════════════════════════════════════════════

    private async findByIdOrThrow(principalId: number, id: number): Promise<SalesChannel> {
        const channel = await this.findById(principalId, id);
        if (!channel) {
            Log.warn(`[SalesChannel Service]: sales channel (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Canale di vendita non trovato.");
        }
        return channel;
    }

    private async findSaleByIdOrThrow(principalId: number, id: number): Promise<ExternalSale> {
        const sale = await this.findSaleById(principalId, id);
        if (!sale) {
            Log.warn(`[SalesChannel Service]: external sale (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Vendita esterna non trovata.");
        }
        return sale;
    }

    private queryFromPayload(payload: SalesChannelQueryDTO): Prisma.SalesChannelWhereInput {
        const query: Prisma.SalesChannelWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.provider, { provider: payload.provider }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { label: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { externalShopId: { contains: payload.value ?? "", mode: "insensitive" as const } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }

    private saleQueryFromPayload(payload: ExternalSaleQueryDTO): Prisma.ExternalSaleWhereInput {
        const query: Prisma.ExternalSaleWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.salesChannelId, { salesChannelId: payload.salesChannelId }),
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { buyerName: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { buyerSurname: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { buyerEmail: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { externalOrderNumber: { contains: payload.value ?? "", mode: "insensitive" as const } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
