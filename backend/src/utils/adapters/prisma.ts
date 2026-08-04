import { PrismaClient } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import * as process from "process";
import { PaginateOptions } from "@utils/helpers/exz";
import _ from "lodash";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { LOGGER } from "@utils/adapters/winston";
import { PrismaPg } from "@prisma/adapter-pg";

let db: PrismaClient;

/**
 * `User.password` è omesso **a livello di client** — backend-brief §3.1:
 * *«nessuna risposta API espone mai `password`, in nessun DTO»*.
 *
 * La correzione sta qui e non su un endpoint perché la riga utente esce dall'API
 * da molte porte: `POST /users/`, `GET /users/:id`, `GET /auth/profile`, e ogni
 * `populate` che attraversi una relazione verso `User` (`OrganizationMember.user`,
 * `Registration.personUser`, `Log.actionBy`, …). Togliere il campo su un
 * controller ne lascerebbe scoperti tutti gli altri; toglierlo qui lo rende
 * **strutturalmente irraggiungibile**.
 *
 * L'unico percorso che ha bisogno dell'hash è il confronto bcrypt del login, che
 * lo riaccende esplicitamente con `omit: { password: false }`
 * (`UserRepository.findOneForAuthentication`). Le scritture non sono toccate:
 * `omit` agisce sul risultato, non sull'input.
 */
export const PRISMA_CLIENT_OMIT = {
    user: { password: true },
} as const;

export async function initializePrismaClient() {
    // Drop any previous client first so its connection pool doesn't leak
    // (e.g. tests re-initialize before each file, leaving orphan pools open).
    if (db) await db.$disconnect();
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    db = new PrismaClient({
        log: ['info', 'error'],
        errorFormat: "pretty",
        adapter,
        omit: PRISMA_CLIENT_OMIT,
    }) as unknown as PrismaClient;
    try {
        await db.$connect();
        Log.info("Start connection on DB!");
    } catch (err: unknown) {
        Log.error(`Couldn't start server: ${(err as Error).message} ${(err as Error).stack}`);
        process.exit(0);
    }
    return db;
}

export function getPrismaClient() {
    return db;
}

type DriverAdapterError = {
    name?: string;
    cause?: {
        kind?: string;
        constraint?: { fields?: string[]; index?: string };
        originalCode?: string;
        originalMessage?: string;
    };
};

function fieldsOf(dae: DriverAdapterError): string {
    const c = dae.cause?.constraint;
    return c?.fields?.length
        ? c.fields.join(", ")
        : c?.index ?? "campo sconosciuto";
}

// https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
export function mapPrismaErrorToHttpError(err: PrismaClientKnownRequestError) {
    const dae = (err.meta as { driverAdapterError?: DriverAdapterError } | undefined)?.driverAdapterError;

    switch (err.code) {
        case "P2002": {
            const target = err.meta?.target;
            const fields = dae
                ? fieldsOf(dae)
                : Array.isArray(target)
                    ? target.join(", ")
                    : (target as string | undefined) ?? "campo sconosciuto";
            Log.error(`Vincolo di unicità violato per il campo: ${fields}`);
            return new httpErrors.BadRequest(`Vincolo di unicità violato per il campo: ${fields}`);
        }
        case "P2003": {
            const field = dae
                ? fieldsOf(dae)
                : (err.meta?.field_name as string | undefined) ?? "campo sconosciuto";
            Log.error(`Vincolo sulla chiave esterna violato per: ${field}`);
            return new httpErrors.BadRequest(`Vincolo sulla chiave esterna violato per: ${field}`);
        }
        case "P2025": {
            const cause = (err.meta?.cause as string | undefined) ?? err.message;
            Log.error(`Campo non trovato: ${cause}`);
            return new httpErrors.BadRequest(`Campo non trovato: ${cause}`);
        }
        default:
            Log.error(`${err.name}: ${err.message}`);
            return new httpErrors.InternalServerError(`${err.name}: ${err.message}`);
    }
}

/**
 * Restituisce una nuova query con la proprietà "deleted" settata a false se diversa da null o undefined
 * @param query
 */
export function evaluateQuery(query: any) {
    return {
        ...query,
        deleted: query.deleted ?? false
    };
}

export function setPaginationAndPopulation(options: PaginateOptions) {
    return {
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        include: options?.populate ? getPopulateOptions(options.populate) : undefined,
        orderBy: options.sort
    };
}

export function setPagination(options: PaginateOptions) {
    return {
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: options.sort
    };
}

export function getPaginationMetadata(options: PaginateOptions, totalDocs: number) {
    const totalPages = Math.ceil(totalDocs / options.limit);
    return {
        totalDocs,
        totalPages,
        hasNextPage: options.page < totalPages,
        nextPage: options.page < totalPages ? (options.page + 1) : undefined,
        hasPrevPage: options.page !== 1,
        prevPage: options.page !== 1 ? (options.page - 1) : undefined,
        page: options.page,
        limit: options.limit
    }
}

/**
 * Restituisce un oggetto contenente la formattazione json (per prisma) che consente
 * di popolare ricorsivamente figli e figli di figli (potenzialmente all'infinito)
 * @example fields: "cargo suppliers.supplier orders.order.customer orders.productionLane"
 * Se si vuole popolare più campi che condividono lo stesso padre ripetere nel populate: padre.figlio1 padre.figlio2
 * @param fields
 */
export function getPopulateOptions(fields: string) {
    return fields.split(" ").reduce((acc, field) => ({
        ..._.merge(acc, destructPopulation(field))
        // ...acc,
        // ...destructPopulation(field)
    }), {});
}

export function destructPopulation(field: string): object {
    if(!field.includes(".")) {
        return {
            [field]: true
        }
    }

    const fields = field.split(".");
    return {
        [fields[0] as string]: {
            include: {
                ...destructPopulation(fields.slice(1).join("."))
            }
        }
    };
}

/**
 * Valido solo per la creazione di relazioni molti a molti
 * Restituisce un oggetto contenente la formattazione json (per prisma) che consente
 * di creare il record nella relazione indicata
 * @param arr key -> name of relation, field --> name of field, ids -> array of id for every field
 * Nel caso in cui la relazione abbia campi propri, non usare questo metodo
 * @example for Products { key: "suppliers", field: "supplier", ids: [4] }
 */
export function connectEntitiesOnCreate(arr?: { key: string, field: string, ids: number[] }[]) {
    if(!arr) return {};

    return arr.reduce((acc, { key, field, ids }) => ({
        ...acc,
        [key]: connectQueryOnCreate(field, ids)
    }), {});
}

export function connectQueryOnCreate(field: string, ids: number[]) {
    return {
        create: ids.map(id => ({
            [field]: {
                connect: { id }
            }
        }))
    }
}

export function mapPrismaErrorToConsoleError(err: PrismaClientKnownRequestError) {
    switch (err.code) {
        case "P2002":
            LOGGER.error(`Vincolo di unicità violato per il campo: ${(err.meta!.target as unknown as string[]).join(", ")}`);
            break;
        case "P2003":
            LOGGER.error(`Vincolo sulla chiave esterna violato per: ${err.meta!.field_name as string}`);
            break;
        case "P2025": // Record not found
            LOGGER.error(`Campo non trovato: ${err.meta ? err.meta.cause as string : err.message}`);
            break;
        default:
            LOGGER.error(`${err.name}: ${err.message}`);
    }
}