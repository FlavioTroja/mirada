import { Service } from "fastify-decorators";
import { Registration } from "@prisma/client";
import httpErrors from "http-errors";
import fs from "node:fs/promises";
import path from "node:path";
import { Log } from "@utils/adapters/log";
import { readI18nText } from "@utils/helpers/i18nText";
import { generateRandomString } from "@utils/helpers/crypto";
import { EventRepository } from "@repositories/EventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import { FileRepository } from "@repositories/FileRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { BalanceSettlementRepository } from "@repositories/BalanceSettlementRepository";
import { hasPermissionOrThrow } from "@utils/adapters/permission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import {
    AttendanceExportColumn,
    AttendanceExportColumnSchema,
    BalanceExportColumn,
    BalanceExportColumnSchema,
    EventExportRequestDTO,
    EventExportResponseDTO,
    ExportKind,
    RegistrationExportColumn,
    RegistrationExportColumnSchema,
} from "@DTOs/event/EventExportDTO";

/** Cartella servita staticamente da `public/` (D-K: file su disco locale). */
const EXPORTS_DIR = "exports";

/**
 * Perché un `kind` non è producibile, e cosa serve perché lo diventi.
 *
 * Il messaggio è **esplicito e nominativo**: il §3.7 vieta di restituire un file
 * vuoto che sembra un dato, e `RF-BKO-9` fa di `SALES_BY_SESSION` una delle tre
 * condizioni del posizionamento fiscale della piattaforma. Un'esportazione muta
 * su quel tracciato sarebbe un difetto con conseguenze fuori dal software.
 */
const UNAVAILABLE: Partial<Record<ExportKind, { requires: string[]; reason: string }>> = {
    ORDERS: {
        requires: ["Purchase", "Order", "OrderLine", "Payment"],
        reason:
            "L'esportazione degli ordini non è producibile: le entità Purchase, Order, OrderLine e Payment "
            + "non esistono ancora nel perimetro costruito (§2, passi 18→22).",
    },
    REVENUE: {
        requires: ["Order", "Payment", "Refund"],
        reason:
            "L'esportazione dell'incasso non è producibile: senza Order, Payment e Refund non esiste alcun "
            + "importo incassato, alcun diritto di prevendita e alcun rimborso da rendicontare.",
    },
    SALES_BY_SESSION: {
        requires: ["Order", "OrderLine"],
        reason:
            "L'esportazione del venduto per sessione (RF-BKO-9) non è producibile: attribuire un incasso a una "
            + "sessione richiede la riga d'ordine con il prezzo bloccato e lo scaglione applicato. Order e "
            + "OrderLine non esistono ancora (§2, passi 19→20). RF-BKO-9 è una delle tre condizioni che "
            + "reggono il posizionamento fiscale della piattaforma: un tracciato vuoto sarebbe peggio di un errore.",
    },
};

/**
 * `POST /events/:id/exports` body `{ kind, columns[] }` → `{ fileUrl }` (§3.7).
 */
@Service()
export class EventExportService {
    constructor(
        private readonly eventRepository: EventRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly balanceSettlementRepository: BalanceSettlementRepository,
        private readonly checkInRepository: CheckInRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly fileRepository: FileRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async export(
        principalId: number,
        eventId: number,
        dto: EventExportRequestDTO,
    ): Promise<EventExportResponseDTO> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[EventExport Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }

        const unavailable = UNAVAILABLE[dto.kind];
        if (unavailable) {
            Log.warn(
                `[EventExport Service]: export '${dto.kind}' refused on event (id ${eventId}) — `
                + `requires ${unavailable.requires.join(", ")}`,
            );
            throw new httpErrors.NotImplemented(unavailable.reason);
        }

        Log.info(`[EventExport Service]: building '${dto.kind}' export for event '${event.slug}' (id ${eventId})`);

        if (dto.kind === "ATTENDANCE") {
            return this.exportAttendance(event.id, event.slug, dto.columns);
        }
        if (dto.kind === "BALANCES") {
            return this.exportBalances(principalId, event.id, event.slug, dto.columns);
        }

        const columns = this.resolveRegistrationColumns(dto.columns);
        const registrations = await this.registrationRepository.findByEvent(eventId);
        const csv = this.toCsv(
            columns,
            registrations.map(registration => columns.map(column => this.cell(registration, column))),
        );

        const filename = `${event.slug}-registrations-${generateRandomString(8)}.csv`;
        const { url, filePath } = await this.write(filename, csv);

        const file = await this.fileRepository.save({
            name: filename,
            path: filePath,
            url,
            mimeType: "text/csv",
            size: Buffer.byteLength(csv, "utf8"),
        });

        Log.info(
            `[EventExport Service]: export '${dto.kind}' produced for event (id ${eventId}) — `
            + `${registrations.length} row(s), file (id ${file.id}) at ${url}`,
        );

        return {
            fileUrl: url,
            fileId: file.id,
            kind: dto.kind,
            columns,
            rows: registrations.length,
            generatedAt: new Date(),
            basedOn: ["Registration"],
        };
    }

    // ─────────────────────────────────────────────────────────────────────────

    private resolveRegistrationColumns(requested: string[]): RegistrationExportColumn[] {
        const available = RegistrationExportColumnSchema.options;
        if (!requested.length) {
            return [...available];
        }

        const unknown = requested.filter(c => !(available as readonly string[]).includes(c));
        if (unknown.length) {
            Log.warn(`[EventExport Service]: export refused — unknown column(s): ${unknown.join(", ")}`);
            throw new httpErrors.BadRequest(
                `Colonne non disponibili: ${unknown.join(", ")}. Colonne ammesse: ${available.join(", ")}.`,
            );
        }

        return requested as RegistrationExportColumn[];
    }

    private cell(registration: Registration, column: RegistrationExportColumn): string {
        const value = registration[column];
        if (value === null || value === undefined) {
            return "";
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        return String(value);
    }

    /** CSV RFC 4180: virgolette raddoppiate, campo racchiuso quando serve. */
    private toCsv(header: string[], rows: string[][]): string {
        const escape = (value: string) =>
            /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        return [header, ...rows].map(row => row.map(escape).join(",")).join("\r\n") + "\r\n";
    }

    private async write(filename: string, content: string): Promise<{ url: string; filePath: string }> {
        const directory = path.join("public", EXPORTS_DIR);
        const filePath = path.join(directory, filename);
        try {
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(filePath, content, { mode: 0o644 });
        } catch (err: unknown) {
            Log.error(`[EventExport Service]: failed to write '${filePath}': ${err instanceof Error ? err.message : String(err)}`);
            throw new httpErrors.InternalServerError("Errore durante la scrittura del file di esportazione.");
        }
        return { url: `${process.env.DOMAIN_URL}/${EXPORTS_DIR}/${filename}`, filePath };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `ATTENDANCE` — le presenze (§3.7)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Le presenze sono righe di `CheckIn` sulla **coppia biglietto–sessione**
     * (`RB7`): una riga per ingresso, non una per biglietto. Un Full Pass
     * scansionato in dodici sessioni produce dodici righe, ed è esattamente ciò
     * che l'organizzatore deve poter contare — l'affluenza per sessione, non il
     * venduto.
     *
     * Le righe **revocate e in conflitto restano nel tracciato**, con le loro
     * colonne: un'esportazione che le tacesse mostrerebbe come presenza un
     * ingresso annullato, oppure nasconderebbe un doppio ingresso che nessuno ha
     * ancora dirimito (`RF-CHK-6`, `RF-CHK-9`).
     *
     * `RB12` — nessun contatto, nessun dato dei requisiti, nessuna dieta.
     */
    /**
     * **Chi deve cosa, per la serata** — `RF-SAL-16`.
     *
     * ── Il permesso si chiede QUI, e non è pedanteria ───────────────────────
     * Gli altri tracciati escono con `READ#EVENT`, che il `CHECKIN_OPERATOR` ha.
     * Questo porta gli **importi** dei residui, che `RB27` tiene lontani da chi
     * non tiene la cassa: senza questo controllo, la regola difesa dalla
     * schermata e dal manifesto verrebbe aggirata scaricando un CSV.
     *
     * Solo le iscrizioni con un residuo **nato**: un elenco che comprendesse
     * tutti con una colonna a zero non sarebbe la lista della cassa, sarebbe
     * l'elenco iscritti con due colonne in più.
     */
    private async exportBalances(
        principalId: number,
        eventId: number,
        slug: string,
        requested: string[],
    ): Promise<EventExportResponseDTO> {
        await hasPermissionOrThrow(principalId, {
            action: PermissionAction.READ,
            entity: PermissionResource.BALANCE_SETTLEMENT,
            scope: PermissionScope.ALL,
        });

        const columns = this.resolveBalanceColumns(requested);

        const registrations = (await this.registrationRepository.findByEvent(eventId))
            .filter(registration => registration.balanceDueAmount > 0)
            .sort((a, b) => a.holderSurname.localeCompare(b.holderSurname));

        const settlements = new Map<number, { count: number; last: Date | null }>();
        for (const registration of registrations) {
            const rows = await this.balanceSettlementRepository.findByRegistration(registration.id);
            settlements.set(registration.id, {
                count: rows.length,
                last: rows.length ? rows[rows.length - 1]!.collectedAt : null,
            });
        }

        const rows = registrations.map(registration => columns.map(column => {
            const settlement = settlements.get(registration.id);
            switch (column) {
                case "registrationId": return String(registration.id);
                case "holderName": return registration.holderName;
                case "holderSurname": return registration.holderSurname;
                case "holderEmail": return registration.holderEmail;
                case "status": return registration.status;
                case "dueAmount": return String(registration.balanceDueAmount);
                case "settledAmount": return String(registration.balanceSettledAmount);
                case "openAmount": return String(registration.balanceDueAmount - registration.balanceSettledAmount);
                case "settlementCount": return String(settlement?.count ?? 0);
                case "lastSettlementAt": return settlement?.last?.toISOString() ?? "";
                default: return "";
            }
        }));

        const csv = this.toCsv(columns, rows);
        const filename = `${slug}-balances-${generateRandomString(8)}.csv`;
        const { url, filePath } = await this.write(filename, csv);

        const file = await this.fileRepository.save({
            name: filename,
            path: filePath,
            url,
            mimeType: "text/csv",
            size: Buffer.byteLength(csv, "utf8"),
        });

        Log.info(
            `[EventExport Service]: export 'BALANCES' produced for event (id ${eventId}) — `
            + `${rows.length} open balance(s), file (id ${file.id}) at ${url}`,
        );

        return {
            fileUrl: url,
            fileId: file.id,
            kind: "BALANCES",
            columns,
            rows: rows.length,
            generatedAt: new Date(),
            basedOn: ["Registration", "BalanceSettlement"],
        };
    }

    private resolveBalanceColumns(requested: string[]): BalanceExportColumn[] {
        const available = BalanceExportColumnSchema.options;
        if (!requested.length) {
            return [...available];
        }

        const unknown = requested.filter(c => !(available as readonly string[]).includes(c));
        if (unknown.length) {
            Log.warn(`[EventExport Service]: balances export refused — unknown column(s): ${unknown.join(", ")}`);
            throw new httpErrors.BadRequest(
                `Colonne non disponibili: ${unknown.join(", ")}. Colonne ammesse: ${available.join(", ")}.`,
            );
        }

        return requested as BalanceExportColumn[];
    }

    private async exportAttendance(
        eventId: number,
        slug: string,
        requested: string[],
    ): Promise<EventExportResponseDTO> {
        const columns = this.resolveAttendanceColumns(requested);

        const sessions = await this.sessionRepository.findByEvent(eventId);
        const sessionsById = new Map(sessions.map(session => [session.id, session]));

        const entries = [] as Awaited<ReturnType<CheckInRepository["findBySession"]>>;
        for (const session of sessions) {
            entries.push(...await this.checkInRepository.findBySession(session.id));
        }

        const tickets = await this.ticketRepository.findByEvent(eventId);
        const ticketsById = new Map(tickets.map(ticket => [ticket.id, ticket]));
        const registrations = await this.registrationRepository.findByEvent(eventId);
        const registrationsById = new Map(registrations.map(registration => [registration.id, registration]));

        const rows = entries.map(entry => columns.map(column => {
            const ticket = ticketsById.get(entry.ticketId);
            const registration = registrationsById.get(entry.registrationId);
            switch (column) {
                case "checkInId": return String(entry.id);
                case "sessionId": return String(entry.sessionId);
                case "sessionName": return readI18nText(sessionsById.get(entry.sessionId)?.name, "") ?? "";
                case "ticketId": return String(entry.ticketId);
                case "ticketCode": return ticket?.code ?? "";
                case "holderName": return ticket?.holderName ?? "";
                case "holderSurname": return ticket?.holderSurname ?? "";
                case "role": return registration?.assignedRole ?? "";
                case "kind": return entry.kind;
                case "scannedAt": return entry.scannedAt.toISOString();
                case "deviceId": return entry.deviceId;
                case "offline": return String(entry.offline);
                case "syncedAt": return entry.syncedAt?.toISOString() ?? "";
                case "revokedAt": return entry.revokedAt?.toISOString() ?? "";
                case "conflictWithId": return entry.conflictWithId ? String(entry.conflictWithId) : "";
                default: return "";
            }
        }));

        const csv = this.toCsv(columns, rows);
        const filename = `${slug}-attendance-${generateRandomString(8)}.csv`;
        const { url, filePath } = await this.write(filename, csv);

        const file = await this.fileRepository.save({
            name: filename,
            path: filePath,
            url,
            mimeType: "text/csv",
            size: Buffer.byteLength(csv, "utf8"),
        });

        Log.info(
            `[EventExport Service]: export 'ATTENDANCE' produced for event (id ${eventId}) — `
            + `${rows.length} entr(y|ies) across ${sessions.length} session(s), file (id ${file.id}) at ${url}`,
        );

        return {
            fileUrl: url,
            fileId: file.id,
            kind: "ATTENDANCE",
            columns,
            rows: rows.length,
            generatedAt: new Date(),
            basedOn: ["CheckIn", "Session", "Ticket", "Registration"],
        };
    }

    private resolveAttendanceColumns(requested: string[]): AttendanceExportColumn[] {
        const available = AttendanceExportColumnSchema.options;
        if (!requested.length) {
            return [...available];
        }

        const unknown = requested.filter(c => !(available as readonly string[]).includes(c));
        if (unknown.length) {
            Log.warn(`[EventExport Service]: attendance export refused — unknown column(s): ${unknown.join(", ")}`);
            throw new httpErrors.BadRequest(
                `Colonne non disponibili: ${unknown.join(", ")}. Colonne ammesse: ${available.join(", ")}.`,
            );
        }

        return requested as AttendanceExportColumn[];
    }
}
