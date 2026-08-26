import { Service } from "fastify-decorators";
import {
    DanceRole,
    Event,
    PreferredDanceRole,
    Prisma,
    Ticket,
    TicketStatus,
    User,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { TicketRepository } from "@repositories/TicketRepository";
import { TicketTransferRepository } from "@repositories/TicketTransferRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { UserRepository } from "@repositories/UserRepository";
import { DancerProfileRepository } from "@repositories/DancerProfileRepository";
import { ContactRepository } from "@repositories/ContactRepository";
import { FileRepository } from "@repositories/FileRepository";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { RequirementOutcomeService } from "@services/RequirementOutcomeService";
import { QrImageService } from "@mail/QrImageService";
import { TicketQrService } from "@services/TicketQrService";
import { TicketDocumentService } from "@services/TicketDocumentService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { TicketTransferredPayloadDTO } from "@websocket/dtos/TicketTransferredPayloadDTO";
import { TicketCreateDTO } from "@DTOs/ticket/TicketCreateDTO";
import { TicketUpdateDTO } from "@DTOs/ticket/TicketUpdateDTO";
import { TicketQueryDTO } from "@DTOs/ticket/TicketQueryDTO";
import { TicketPdfResponseDTO } from "@DTOs/ticket/TicketResponseDTO";
import { TicketTransferRequestDTO } from "@DTOs/ticket/TicketTransferDTO";
import { TicketTransferOutcomeDTO } from "@DTOs/ticket_transfer/TicketTransferResponseDTO";
import { MailService } from "@mail/MailService";
import { readI18nText } from "@utils/helpers/i18nText";

/** Ciò che serve a emettere un biglietto: la forma la impone il servizio, non il client. */
export type TicketIssueInput = {
    eventId: number;
    ticketTypeId: number;
    registrationId?: number | null;
    orderLineId?: number | null;
    passIssuanceId?: number | null;
    /** La terza provenienza: la vendita dichiarata da un negozio esterno (fase E). */
    externalSaleId?: number | null;
    holderName: string;
    holderSurname: string;
    holderEmail?: string | null;
    bearer?: boolean;
};

/**
 * `Ticket` — backend-brief §4.12, `09-titoli-e-pass.md` §7.
 *
 * ── La regola strutturale ────────────────────────────────────────────────────
 * **L'utilizzo non è uno stato del biglietto.** Un Full Pass viene scansionato
 * dodici volte in tre giorni e resta `VALID`. In questo servizio non esiste, e
 * non deve esistere, alcuna scrittura che marchi un biglietto come «usato»:
 * l'ingresso è una riga di `CheckIn` sulla coppia biglietto–sessione.
 *
 * ── Il trasferimento (`RB8`, `RF-TCK-5`→`7`) ─────────────────────────────────
 * In **una** transazione: invalida il QR precedente, ne emette uno nuovo, sposta
 * l'iscrizione e **rivaluta i requisiti** sul nuovo titolare. Se il nuovo
 * titolare ha un ruolo diverso, **rilascia il vecchio ruolo e impegna il nuovo
 * nella stessa transazione**: se il nuovo ruolo è saturo il trasferimento è
 * **rifiutato e nulla cambia**.
 */
@Service()
export class TicketService {
    constructor(
        private readonly ticketRepository: TicketRepository,
        private readonly ticketTransferRepository: TicketTransferRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly userRepository: UserRepository,
        private readonly dancerProfileRepository: DancerProfileRepository,
        private readonly contactRepository: ContactRepository,
        private readonly fileRepository: FileRepository,
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly mailService: MailService,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly requirementOutcomeService: RequirementOutcomeService,
        private readonly ticketQrService: TicketQrService,
        private readonly ticketDocumentService: TicketDocumentService,
        private readonly qrImageService: QrImageService,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async save(principalId: number, dto: TicketCreateDTO): Promise<Ticket> {
        await this.assertWritableEvent(principalId, dto.eventId);
        return this.issue({
            eventId: dto.eventId,
            ticketTypeId: dto.ticketTypeId,
            registrationId: dto.registrationId ?? null,
            orderLineId: dto.orderLineId ?? null,
            passIssuanceId: dto.passIssuanceId ?? null,
            holderName: dto.holderName,
            holderSurname: dto.holderSurname,
            holderEmail: dto.holderEmail ?? null,
            bearer: dto.bearer ?? false,
        });
    }

    /**
     * L'emissione vera e propria: **il codice lo genera il server**, sempre.
     *
     * Un biglietto il cui codice arriva da fuori è un biglietto che si può
     * fabbricare, ed è esattamente ciò contro cui esiste la firma del QR.
     */
    public async issue(input: TicketIssueInput, tx?: Prisma.TransactionClient): Promise<Ticket> {
        const bearer = input.bearer ?? false;

        const ticket = await this.ticketRepository.save(
            {
                eventId: input.eventId,
                ticketTypeId: input.ticketTypeId,
                registrationId: input.registrationId ?? null,
                orderLineId: input.orderLineId ?? null,
                passIssuanceId: input.passIssuanceId ?? null,
                externalSaleId: input.externalSaleId ?? null,
                code: this.ticketQrService.generateCode(),
                status: TicketStatus.VALID,
                holderName: input.holderName,
                holderSurname: input.holderSurname,
                // Vincolo di tabella `Ticket_bearer_has_no_email`: un pass al
                // portatore non ha titolare, e quindi non ha un'email a cui
                // scrivere (`RB12`).
                holderEmail: bearer ? null : (input.holderEmail ?? null),
                bearer,
                qrIssuedAt: new Date(),
            },
            tx,
        );

        Log.info(
            `[Ticket Service]: ticket issued (id ${ticket.id}, code ${ticket.code}) on event (id ${input.eventId}) `
            + `for ticket type (id ${input.ticketTypeId})${bearer ? " — BEARER, not transferable" : ""}`,
        );
        return ticket;
    }

    /**
     * Il biglietto visto da chi chiama: lo staff dell'organizzazione **oppure**
     * il titolare. Erano due proprietari e se ne considerava uno solo, e il
     * trasferimento del nominativo ne pagava il prezzo (vedi
     * `TicketRepository.visibilityWhere`).
     */
    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Ticket | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.ticketRepository.findOneVisible(scope, principalId, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: TicketQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Ticket>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.ticketRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: TicketUpdateDTO): Promise<Ticket> {
        const ticket = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, ticket.eventId);

        // Un biglietto annullato o rimborsato non deve più aprire nulla: il QR si
        // invalida qui, nello stesso aggiornamento che cambia lo stato
        // (`RF-RMB-9`). Le presenze già registrate restano: sono fatti accaduti.
        const invalidating = dto.status === TicketStatus.CANCELLED || dto.status === TicketStatus.REFUNDED;

        Log.info(
            `[Ticket Service]: updating ticket (id ${id})`
            + (dto.status ? ` — status ${ticket.status} → ${dto.status}` : ""),
        );

        return this.ticketRepository.update({ id }, {
            ...(dto as Prisma.TicketUpdateInput),
            ...(invalidating && !ticket.qrRevokedAt ? { qrRevokedAt: new Date() } : {}),
        } as Prisma.TicketUpdateInput);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Ticket> {
        const ticket = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, ticket.eventId);
        Log.info(`[Ticket Service]: soft deleting ticket (id ${id}, code ${ticket.code})`);
        return this.ticketRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Il QR e il documento (§4.12, `RF-TCK-11`)
    // ─────────────────────────────────────────────────────────────────────────

    /** Il contenuto del QR: JWS compatto firmato Ed25519 (assunzione `AS-7`). */
    public qrToken(ticket: Ticket): string {
        return this.ticketQrService.issueToken(ticket);
    }

    /**
     * `GET /tickets/:id/qr` → il PNG del QR, pronto da mostrare a schermo.
     *
     * ── Perché un'immagine e non il contenuto ────────────────────────────────
     * Il contenuto del QR è un JWS firmato: è **la chiave d'ingresso**. Servirlo
     * come testo significherebbe farlo passare per la memoria del browser, per
     * la cronologia delle richieste e per qualunque registro intermedio, per poi
     * disegnarlo comunque come immagine. L'immagine si guarda alla porta e
     * finisce lì.
     *
     * ── Perché può non esserci ───────────────────────────────────────────────
     * Un QR revocato — rimborso, annullamento — non viene ridisegnato: mostrarne
     * uno che il lettore rifiuta manderebbe qualcuno alla porta convinto di
     * avere un biglietto valido. Meglio dirlo prima.
     */
    public async qrImage(principalId: number, id: number): Promise<{ png: Buffer; filename: string } | null> {
        const ticket = await this.findByIdOrThrow(principalId, id);

        if (ticket.qrRevokedAt) {
            Log.warn(`[Ticket Service]: QR requested for ticket (id ${id}) but it was revoked on ${ticket.qrRevokedAt.toISOString()}`);
            return null;
        }

        const image = await this.qrImageService.ticketQr(ticket.id, this.qrToken(ticket));
        if (!image) {
            Log.error(`[Ticket Service]: QR rendering failed for ticket (id ${id})`);
            return null;
        }

        Log.info(`[Ticket Service]: QR served for ticket (id ${id}, code ${ticket.code})`);
        return { png: image.content, filename: image.filename };
    }

    /**
     * `GET /tickets/:id/pdf` → `{ fileUrl }`.
     *
     * **Conferma d'ordine con QR di accesso, mai un titolo fiscale**
     * (`RF-TCK-11`): la forma del documento è responsabilità di
     * `TicketDocumentService`, la risposta lo **dichiara** anche nei campi, così
     * nemmeno un consumatore distratto può presentarlo per ciò che non è.
     */
    public async pdf(principalId: number, id: number): Promise<TicketPdfResponseDTO> {
        const ticket = await this.findByIdOrThrow(principalId, id);

        const event = await this.eventRepository.findOne({ id: ticket.eventId, deleted: false });
        const ticketType = await this.ticketTypeRepository.findWithSessions(ticket.ticketTypeId);
        if (!event || !ticketType) {
            Log.error(`[Ticket Service]: cannot build the confirmation of ticket (id ${id}) — event or ticket type missing`);
            throw new httpErrors.NotFound("Biglietto non componibile: evento o titolo mancante.");
        }

        const organization = await this.organizationRepository.findOne({ id: event.organizationId });
        const sessionIds = ticketType.sessions.map(link => link.sessionId);
        const sessions = sessionIds.length
            ? await this.sessionRepository.findMany({ id: { in: sessionIds }, deleted: false }, { orderBy: { startAt: "asc" } })
            : [];

        // Il residuo dell'iscrizione, se ce n'è uno: sul documento che la persona
        // porta alla porta deve essere scritto (`RF-SAL-13`).
        const registration = ticket.registrationId
            ? await this.registrationRepository.findOne({ id: ticket.registrationId, deleted: false })
            : null;

        const document = await this.ticketDocumentService.build({
            ticket,
            event,
            ticketType,
            sessions,
            qrToken: this.qrToken(ticket),
            organizationName: organization?.name ?? "Organizzatore",
            balanceDue: registration
                ? Math.max(0, registration.balanceDueAmount - registration.balanceSettledAmount)
                : 0,
        });

        const file = await this.fileRepository.save({
            name: document.filename,
            path: document.filePath,
            url: document.url,
            mimeType: "application/pdf",
            size: document.size,
        });

        await this.ticketRepository.update({ id }, { pdfFileId: file.id });

        Log.info(`[Ticket Service]: order confirmation ready for ticket (id ${id}) — file (id ${file.id})`);

        return {
            fileUrl: document.url,
            fileId: file.id,
            documentKind: "ORDER_CONFIRMATION",
            fiscalDocument: false,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Il trasferimento (`RB8`, `RF-TCK-5`→`7`)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Trasferisce il nominativo del biglietto.
     *
     * Tutto avviene in **una sola transazione**, e l'ordine non è casuale:
     *
     * 1. **il ruolo si muove per primo** — se il nuovo titolare balla nel ruolo
     *    opposto, si rilascia il vecchio e si impegna il nuovo con le **stesse
     *    verifiche di un acquisto**. Se il nuovo ruolo è saturo, il motore lancia
     *    `SOLD_OUT`, la transazione si annulla e **nulla cambia**: né il codice,
     *    né l'iscrizione, né i contatori, né i requisiti;
     * 2. si emette il **codice nuovo** e si registra il passaggio con il codice
     *    invalidato: da quel momento il QR precedente non risolve più;
     * 3. si **sposta l'iscrizione** sul nuovo titolare;
     * 4. si **rivalutano i requisiti**: una liberatoria firmata da un'altra
     *    persona non vale, e lasciarla valida sarebbe il modo più semplice per
     *    aggirare ogni dichiarazione dell'organizzatore.
     *
     * **La regolazione economica del passaggio è fra i due ballerini, fuori dalla
     * piattaforma** (`RF-TCK-9`): qui non si muove denaro.
     */
    public async transfer(
        principalId: number,
        ticketId: number,
        dto: TicketTransferRequestDTO,
    ): Promise<TicketTransferOutcomeDTO> {
        const ticket = await this.findByIdOrThrow(principalId, ticketId);

        if (ticket.bearer) {
            Log.warn(`[Ticket Service]: transfer refused for ticket (id ${ticketId}) — bearer passes are not transferable`);
            throw new httpErrors.BadRequest("Un pass al portatore non è trasferibile: non ha un titolare da cui trasferirlo.");
        }
        if (ticket.status !== TicketStatus.VALID && ticket.status !== TicketStatus.TRANSFERRED) {
            Log.warn(`[Ticket Service]: transfer refused for ticket (id ${ticketId}) — status is ${ticket.status}`);
            throw new httpErrors.BadRequest("Il biglietto non è più valido e non può essere trasferito.");
        }

        const recipient = await this.resolveRecipient(dto.emailOrNickname);
        const registration = ticket.registrationId
            ? await this.registrationRepository.findOne({ id: ticket.registrationId, deleted: false })
            : null;

        if (registration?.personUserId === recipient.user.id) {
            Log.warn(`[Ticket Service]: transfer refused for ticket (id ${ticketId}) — the recipient already holds it`);
            throw new httpErrors.BadRequest("Il biglietto è già intestato a questa persona.");
        }

        // Una iscrizione per persona per evento (§3.6): se il destinatario è già
        // iscritto a questo evento, spostare l'iscrizione violerebbe la chiave
        // unica e unire le due sarebbe una fusione di consumi, requisiti e
        // biglietti che nessuna regola del brief descrive. Si rifiuta, dicendolo.
        if (registration) {
            const existing = await this.registrationRepository.findByEventAndPerson(ticket.eventId, recipient.user.id);
            if (existing && existing.id !== registration.id) {
                Log.warn(
                    `[Ticket Service]: transfer refused for ticket (id ${ticketId}) — the recipient (id ${recipient.user.id}) `
                    + `already has registration (id ${existing.id}) on event (id ${ticket.eventId})`,
                );
                throw new httpErrors.Conflict(
                    "Il nuovo titolare è già iscritto a questo evento: un trasferimento creerebbe una seconda iscrizione per la stessa persona.",
                );
            }
        }

        const newRole = this.resolveRecipientRole(recipient.preferredRole, registration?.assignedRole ?? null);
        const roleMoves = !!registration && !!newRole && newRole !== registration.assignedRole;

        const outcome = await getPrismaClient().$transaction(async prisma => {
            // 1. Il ruolo per primo: è l'unico passo che può rifiutare.
            if (roleMoves && registration) {
                Log.info(
                    `[Ticket Service]: transfer of ticket (id ${ticketId}) moves registration (id ${registration.id}) `
                    + `from ${registration.assignedRole ?? "none"} to ${newRole}`,
                );
                const context = await this.registrationCapacityContext(registration.id, prisma);
                await this.capacityEngineService.reassignRole(registration.id, newRole!, context, prisma);
            }

            // 2. Codice nuovo, codice vecchio in archivio.
            const previousCode = ticket.code;
            const updated = await this.ticketRepository.update(
                { id: ticketId },
                {
                    code: this.ticketQrService.generateCode(),
                    qrIssuedAt: new Date(),
                    holderName: recipient.name,
                    holderSurname: recipient.surname,
                    holderEmail: recipient.email ?? null,
                },
                undefined,
                undefined,
                prisma,
            );

            const transfer = await this.ticketTransferRepository.save(
                {
                    ticketId,
                    fromUserId: registration?.personUserId ?? null,
                    toUserId: recipient.user.id,
                    fromHolder: {
                        name: ticket.holderName,
                        surname: ticket.holderSurname,
                        email: ticket.holderEmail,
                    } as Prisma.InputJsonValue,
                    toHolder: {
                        name: recipient.name,
                        surname: recipient.surname,
                        email: recipient.email ?? null,
                    } as Prisma.InputJsonValue,
                    previousCode,
                    transferredAt: new Date(),
                },
                prisma,
            );

            // 3. L'iscrizione si sposta: è la persona nell'evento, e la persona è
            //    cambiata.
            let revaluated = 0;
            if (registration) {
                await this.registrationRepository.update(
                    { id: registration.id },
                    {
                        personUserId: recipient.user.id,
                        holderName: recipient.name,
                        holderSurname: recipient.surname,
                        holderEmail: recipient.email ?? registration.holderEmail,
                    },
                    undefined,
                    undefined,
                    prisma,
                );

                // 4. E i requisiti si rivalutano sul nuovo titolare (`RB8`).
                revaluated = (await this.requirementOutcomeService.revaluateForRegistration(registration.id, prisma)).length;
            }

            return { ticket: updated, transfer, roleMoved: roleMoves, requirementsRevaluated: revaluated };
        });

        Log.info(
            `[Ticket Service]: ticket (id ${ticketId}) transferred to '${dto.emailOrNickname}' — new code `
            + `${outcome.ticket.code}, ${outcome.requirementsRevaluated} requirement(s) revaluated`
            + (roleMoves ? `, role moved to ${newRole}` : ", no role movement"),
        );

        // §3.9 — il publish avviene DOPO il commit, mai dentro la transazione.
        await this.publishTransferred(ticket.eventId, ticketId, [
            registration?.personUserId ?? null,
            recipient.user.id,
        ]);

        await this.mailTransfer(ticket, outcome.ticket.code, recipient);

        return outcome;
    }

    /**
     * **L'esito del trasferimento** (`RF-COM-1`), a entrambe le parti e con due
     * testi diversi.
     *
     * Chi riceve deve sapere qual è il codice con cui entra; chi cede deve
     * sapere che il suo **non fa più entrare nessuno**. Mandare a tutti e due lo
     * stesso messaggio lascerebbe uno dei due a presentarsi all'ingresso con un
     * codice morto — e succederebbe la sera dell'evento, davanti alla porta.
     *
     * Dopo il commit e senza lanciare: il trasferimento è già scritto.
     */
    private async mailTransfer(
        previous: Ticket,
        newCode: string,
        recipient: { name: string; surname: string; email?: string | null },
    ): Promise<void> {
        try {
            const event = await this.eventRepository.findOne({ id: previous.eventId, deleted: false });
            if (!event) return;

            const eventTitle = readI18nText(event.title) ?? event.slug;
            const newHolder = `${recipient.name} ${recipient.surname}`.trim();
            const oldHolder = `${previous.holderName ?? ""} ${previous.holderSurname ?? ""}`.trim();

            if (recipient.email) {
                await this.mailService.sendTicketTransferred(recipient.email, {
                    recipient: "new",
                    firstName: recipient.name,
                    eventTitle,
                    eventSlug: event.slug,
                    ticketCode: newCode,
                    otherPartyName: oldHolder || "Un altro ballerino",
                });
            }

            if (previous.holderEmail) {
                await this.mailService.sendTicketTransferred(previous.holderEmail, {
                    recipient: "previous",
                    firstName: previous.holderName ?? "",
                    eventTitle,
                    eventSlug: event.slug,
                    // Chi cede non deve ricevere il codice nuovo: non è più suo.
                    ticketCode: "",
                    otherPartyName: newHolder,
                });
            }
        } catch (err) {
            Log.error(
                `[Ticket Service]: failed to mail transfer outcome for ticket (id ${previous.id}): `
                + `${(err as Error).message}`,
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Il ruolo del nuovo titolare si **legge dal suo profilo**, non si chiede: il
     * corpo del §3.7 è `{ emailOrNickname }` e nulla più.
     *
     * `BOTH` — e l'assenza di profilo — significano «tiene il ruolo che il
     * biglietto già occupa»: nessun movimento di capienza, come prescrive `05` §8
     * per il trasferimento a parità di ruolo.
     */
    private resolveRecipientRole(
        preferred: PreferredDanceRole | null,
        current: DanceRole | null,
    ): DanceRole | null {
        if (preferred === PreferredDanceRole.LEADER) return DanceRole.LEADER;
        if (preferred === PreferredDanceRole.FOLLOWER) return DanceRole.FOLLOWER;
        return current;
    }

    /**
     * Che cosa l'iscrizione occupa: senza il titolo e i servizi, il nuovo impegno
     * ricadrebbe sulle sole quote di evento e le quote di sessione resterebbero
     * libere senza che nessuno le abbia liberate.
     *
     * Si ricostruisce dai `QuotaConsumption` esistenti, che sono il registro
     * esatto di ciò che l'iscrizione occupa oggi (`05` §8).
     */
    private async registrationCapacityContext(
        registrationId: number,
        tx: Prisma.TransactionClient,
    ): Promise<{ ticketTypeId?: number | null; serviceIds?: number[] }> {
        const consumptions = await this.quotaConsumptionRepository.findByRegistration(registrationId, tx);
        if (!consumptions.length) {
            return {};
        }
        const quotas = await this.capacityQuotaRepository.findMany(
            { id: { in: consumptions.map(c => c.capacityQuotaId) } },
            { orderBy: { id: "asc" } },
            tx,
        );
        return {
            ticketTypeId: quotas.find(q => q.scope === "TICKET_TYPE")?.scopeId ?? null,
            serviceIds: quotas.filter(q => q.scope === "SERVICE").map(q => q.scopeId!).filter(Boolean),
        };
    }

    /** Destinatario per **email o nickname**, che è ciò che il §3.7 dichiara nel corpo. */
    private async resolveRecipient(emailOrNickname: string): Promise<{
        user: User;
        name: string;
        surname: string;
        email: string | null;
        preferredRole: PreferredDanceRole | null;
    }> {
        const needle = emailOrNickname.trim();

        const profile = await this.dancerProfileRepository.findByNickname(needle);
        const user = profile
            ? await this.userRepository.findOne({ id: profile.userId, deleted: false }, { populate: "person" })
            : await this.userRepository.findOne(
                { deleted: false, person: { contact: { email: needle.toLowerCase() } } },
                { populate: "person" },
            );

        if (!user) {
            Log.warn(`[Ticket Service]: transfer refused — no user matches '${needle}'`);
            throw new httpErrors.NotFound(
                "Nessun utente corrisponde a questa email o a questo nickname. Il nuovo titolare deve avere un account.",
            );
        }

        const populated = await this.userRepository.findById(user.id, { populate: "person" });
        const person = (populated as unknown as { person?: { name?: string; surname?: string } } | null)?.person;
        const dancerProfile = profile ?? await this.dancerProfileRepository.findByUserId(user.id);

        // L'email del nuovo titolare si legge dal suo contatto, non dal corpo
        // della richiesta: il trasferimento non è il luogo in cui si dichiarano
        // dati altrui.
        const contact = await this.contactRepository.findOne({ person: { user: { id: user.id } } });

        return {
            user,
            name: person?.name ?? user.username,
            surname: person?.surname ?? "",
            email: contact?.email ?? null,
            preferredRole: dancerProfile?.preferredRole ?? null,
        };
    }

    private async publishTransferred(eventId: number, ticketId: number, userIds: (number | null)[]): Promise<void> {
        try {
            const event = await this.eventRepository.findOne({ id: eventId });
            if (!event) {
                return;
            }

            const memberCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            const partyIds = userIds.filter((id): id is number => !!id);
            const parties = partyIds.length
                ? await this.userRepository.findMany({ id: { in: partyIds }, deleted: false })
                : [];
            const partyCodes = parties.map(user => user.wsCode).filter((code): code is string => !!code);

            const wsCodes = [...new Set([...memberCodes, ...partyCodes])];
            if (!wsCodes.length) {
                return;
            }

            const payload: TicketTransferredPayloadDTO = { ticketId, eventId };
            await this.wsPublisher.sendToUsers(wsCodes, Events.TICKET_TRANSFERRED, payload);
        } catch (err) {
            // Il segnale è un trigger di refetch: la sua perdita non può far
            // fallire un trasferimento già scritto.
            Log.error(`[Ticket Service]: failed to publish 'ticket/transferred' for ticket (id ${ticketId}): ${(err as Error).message}`);
        }
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Ticket Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Ticket> {
        const ticket = await this.findById(principalId, id);
        if (!ticket) {
            Log.warn(`[Ticket Service]: ticket (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Biglietto non trovato.");
        }
        return ticket;
    }

    private createQueryFromPayload(payload: TicketQueryDTO): Prisma.TicketWhereInput {
        const query: Prisma.TicketWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.ticketTypeId, { ticketTypeId: payload.ticketTypeId }),
            createObjectWithoutThrow(payload.registrationId, { registrationId: payload.registrationId }),
            createObjectWithoutThrow(payload.passIssuanceId, { passIssuanceId: payload.passIssuanceId }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            payload.bearer === undefined ? {} : { bearer: payload.bearer },
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { code: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderName: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderSurname: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderEmail: { contains: payload.value ?? "", mode: "insensitive" as const } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }

    /** Il presidio del §4.7: *non si rimuove una sessione da un titolo con biglietti emessi*. */
    public async countIssuedByTicketType(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.ticketRepository.countLiveByTicketType(ticketTypeId, tx);
    }

    /** I biglietti nati da una singola emissione manuale — li usa la revoca dell'emissione. */
    public async findByIssuance(passIssuanceId: number, tx?: Prisma.TransactionClient): Promise<Ticket[]> {
        return this.ticketRepository.findMany(
            { passIssuanceId, deleted: false },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    /**
     * Annulla un biglietto e **invalida il suo QR** nella stessa scrittura.
     *
     * Le presenze già registrate restano dove sono: sono fatti accaduti, e un
     * annullamento successivo non li cancella. Ciò che smette di valere è
     * l'ingresso **futuro**.
     */
    public async cancel(ticketId: number, tx?: Prisma.TransactionClient): Promise<Ticket> {
        Log.info(`[Ticket Service]: cancelling ticket (id ${ticketId}) and revoking its QR`);
        return this.ticketRepository.update(
            { id: ticketId },
            { status: TicketStatus.CANCELLED, qrRevokedAt: new Date() },
            undefined,
            undefined,
            tx,
        );
    }
}
