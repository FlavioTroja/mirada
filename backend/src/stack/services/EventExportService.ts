import { Service } from "fastify-decorators";
import { Registration } from "@prisma/client";
import httpErrors from "http-errors";
import fs from "node:fs/promises";
import path from "node:path";
import { Log } from "@utils/adapters/log";
import { generateRandomString } from "@utils/helpers/crypto";
import { EventRepository } from "@repositories/EventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { FileRepository } from "@repositories/FileRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import {
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
    ATTENDANCE: {
        requires: ["Ticket", "CheckIn"],
        reason:
            "L'esportazione delle presenze non è producibile: le presenze sono righe di CheckIn sulla coppia "
            + "biglietto–sessione (RB7), e né Ticket né CheckIn esistono nel perimetro costruito.",
    },
    SALES_BY_SESSION: {
        requires: ["Order", "OrderLine", "Ticket", "TicketTypeSession"],
        reason:
            "L'esportazione del venduto per sessione (RF-BKO-9) non è producibile: attribuire un incasso a una "
            + "sessione richiede la riga d'ordine, il titolo acquistato e il peso di ripartizione delle sessioni "
            + "incluse. Order, OrderLine e Ticket non esistono ancora. RF-BKO-9 è una delle tre condizioni che "
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
}
