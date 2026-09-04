import { Service } from "fastify-decorators";
import { Person, Prisma } from "@prisma/client";
import { AuditLog, LogOp } from "@utils/adapters/decorators/AuditLog";
import { Log } from "@utils/adapters/log";
import { PersonRepository } from "@repositories/PersonRepository";
import { ContactRepository } from "@repositories/ContactRepository";
import { DancerProfileRepository } from "@repositories/DancerProfileRepository";
import { PersonLookupResultDTO } from "@DTOs/person/PersonLookupDTO";

/** Ciò che serve per censire qualcuno che la piattaforma non conosce ancora. */
export type PersonSeed = {
    email: string | null | undefined;
    name: string;
    surname: string;
};

/**
 * # Il censimento dell'anagrafica — `16-anagrafica-unica.md` §3
 *
 * Un ballerino è **una riga sola** su tutta la piattaforma. Chi si iscrive al
 * corso della scuola A e a marzo va al festival dell'organizzazione B è la stessa
 * `Person`: l'isolamento fra organizzazioni vive sull'iscrizione, che discende
 * dall'evento, non sulla persona (`backend-brief` §1.5).
 *
 * ── Le tre regole di questo servizio ─────────────────────────────────────────
 *
 * 1. **L'email è la chiave, normalizzata.** Minuscolo e senza spazi, come già
 *    fa `OrganizationInvitation.email`. Due indirizzi che differiscono per una
 *    maiuscola sono la stessa persona, e trattarli come due sarebbe il difetto
 *    che questo servizio esiste per impedire.
 *
 * 2. **Chi è già censito non si riscrive** (`RB32`). Si collega e basta. Un'
 *    anagrafica scrivibile da qualunque organizzazione che ne conosca l'email
 *    conterrebbe, dopo il terzo organizzatore, la versione dell'ultimo che ha
 *    digitato — e l'ultimo può aver scritto «Maria R.» per fare prima. I dati
 *    propri li corregge chi li possiede, dalla sua area personale.
 *
 * 3. **Senza email non si censisce.** `Contact.email` è unico su tutta la
 *    piattaforma (decisione A9): chi non ha un indirizzo proprio — la metà di
 *    una coppia che ne condivide uno — resta un'iscrizione sciolta, con i suoi
 *    `holderName` e `holderSurname` e nessun `personId`. È il comportamento di
 *    prima, non una regressione.
 *
 *    ⚠️ Ciò che **non** si fa è sintetizzare un indirizzo per riempire il
 *    vincolo. Il precedente in casa esiste — `pass-…@non-nominale.local` per i
 *    pass al portatore — ed è corretto lì, dove una persona non c'è. Qui la
 *    persona c'è: un'email finta la censirebbe con un dato che non le
 *    appartiene, e sporcherebbe l'anagrafica globale, cioè l'opposto dello scopo.
 *
 * ── Perché `personType: USER` su chi un account non ce l'ha ─────────────────
 * `PersonType` ha un valore solo, e distingue la persona-utente da tipi futuri.
 * Una persona censita **è** una persona-utente che non si è ancora registrata:
 * il giorno in cui rivendica l'anagrafica (§4) quella riga non cambia tipo,
 * acquista un `User`. Introdurre qui un tipo «provvisorio» significherebbe
 * doverlo convertire, e una conversione è un posto dove si perdono righe.
 */
@Service()
export class PersonResolutionService {
    constructor(
        private readonly personRepository: PersonRepository,
        private readonly contactRepository: ContactRepository,
        private readonly dancerProfileRepository: DancerProfileRepository,
    ) {}

    /**
     * La forma canonica di un indirizzo. Unica funzione: se un giorno la
     * normalizzazione cambia, cambia per la ricerca **e** per la creazione
     * insieme — se divergessero, il censimento creerebbe righe che poi non
     * ritrova.
     */
    public static normalize(email: string | null | undefined): string | null {
        const clean = (email ?? "").trim().toLowerCase();
        return clean.length ? clean : null;
    }

    /** Cerca soltanto. Non crea nulla: è la lettura del percorso di vendita. */
    public async find(
        email: string | null | undefined,
        tx?: Prisma.TransactionClient,
    ): Promise<Person | null> {
        const normalized = PersonResolutionService.normalize(email);
        if (!normalized) {
            return null;
        }
        return this.personRepository.findOne(
            { deleted: false, contact: { email: normalized } },
            undefined,
            tx,
        ) as Promise<Person | null>;
    }

    /**
     * Cerca, e **se non esiste la crea senza account**.
     *
     * È il censimento vero e proprio: da qui in poi quella persona è nota alla
     * piattaforma, e la prossima organizzazione che la iscrive non la ridigita.
     * L'utenza arriverà — o non arriverà mai — per la sua strada (§4).
     *
     * Restituisce `null` quando non c'è un'email su cui reggere l'identità: il
     * chiamante crea l'iscrizione senza `personId`, ed è legittimo.
     */
    public async resolveOrCreate(
        seed: PersonSeed,
        tx?: Prisma.TransactionClient,
    ): Promise<Person | null> {
        const email = PersonResolutionService.normalize(seed.email);
        if (!email) {
            Log.info("[PersonResolution Service]: no email on this participant — no anagraphic, registration stays loose");
            return null;
        }

        const existing = await this.find(email, tx);
        if (existing) {
            // `RB32` — si collega, non si riscrive.
            Log.info(
                `[PersonResolution Service]: '${email}' is already known as person (id ${existing.id}) — linking, `
                + "not rewriting",
            );
            return existing;
        }

        const contact = await this.contactRepository.save({ email }, tx);
        const person = await this.personRepository.save(
            {
                name: seed.name.trim() || email.split("@")[0] || "Senza nome",
                surname: seed.surname.trim() || "",
                personType: "USER",
                contact: { connect: { id: contact.id } },
            } as never,
            tx,
        );

        Log.info(
            `[PersonResolution Service]: '${email}' censused as person (id ${person.id}) WITHOUT an account — `
            + "claimable at signup (`16` §4)",
        );
        return person;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La ricerca dell'organizzatore — `16` §5, `GET /persons/lookup`
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * «Questa email la conosciamo già?» — l'unica domanda che questa rotta
     * risponde, e va tenuta l'unica.
     *
     * ── I tre presidi, e quale fa il lavoro ─────────────────────────────────
     * 1. **Email esatta, mai ricerca parziale.** Sta nello schema del DTO, non
     *    qui: è il presidio che regge, perché toglie la possibilità invece di
     *    negarla. Gli altri due servono quando qualcuno le email ce le ha già.
     * 2. **Solo a chi può creare iscrizioni** in un'organizzazione: si guarda
     *    mentre si iscrive qualcuno, non si consulta. Il controllo è sulla rotta.
     * 3. **Ogni chiamata lascia una riga di registro** (`RF-ADM-9`), che è anche
     *    il solo modo di accorgersi di qualcuno che prova indirizzi a tappeto.
     *
     * ── Perché non restituisce mai un errore «non trovata» ──────────────────
     * Non trovare è il caso normale — la maggior parte di chi si iscrive non è
     * mai passata di qui — e un `404` costringerebbe il chiamante a trattare
     * come eccezione ciò che è la regola. Si risponde `found: false` e si
     * compila il modulo a mano, che è esattamente ciò che si faceva prima.
     */
    @AuditLog({
        op: LogOp.READ,
        entity: Prisma.ModelName.Person,
        // Il terzo presidio del §5.1. La riga porta l'indirizzo cercato perché
        // senza di esso il registro direbbe «qualcuno ha cercato qualcuno», che
        // non serve a nessuno: ciò che si vuole poter vedere è **un operatore
        // che prova indirizzi a tappeto**, e quella forma si riconosce solo
        // avendo davanti la sequenza di cosa ha cercato.
        description: ctx => `Ricerca anagrafica per indirizzo: ${String(ctx.functionParams[0] ?? "")}`,
        entityIdFrom: ctx => (ctx.returnValue as PersonLookupResultDTO | undefined)?.personId ?? null,
    })
    public async lookup(email: string): Promise<PersonLookupResultDTO> {
        const normalized = PersonResolutionService.normalize(email);
        const vuoto: PersonLookupResultDTO = {
            found: false,
            personId: null,
            name: null,
            surname: null,
            email: null,
            hasAccount: false,
            dancerProfile: null,
        };
        if (!normalized) {
            return vuoto;
        }

        const person = await this.personRepository.findOne(
            { deleted: false, contact: { email: normalized } },
            { populate: "contact user" },
        ) as (Person & { contact?: { email?: string }; user?: { id: number } | null }) | null;

        if (!person) {
            Log.info(`[PersonResolution Service]: lookup for '${normalized}' — not known to the platform`);
            return vuoto;
        }

        const userId = person.user?.id ?? null;
        const profile = userId ? await this.dancerProfileRepository.findByUserId(userId) : null;

        // A10 — l'interruttore del ballerino. Un profilo nascosto e un profilo
        // inesistente escono di qui identici: «esiste ma non te lo dico» sarebbe
        // comunque un'informazione su una persona che ha chiesto di non darla.
        const visible = !!profile && !profile.deleted && profile.profileVisibleToOrganizers;

        Log.info(
            `[PersonResolution Service]: lookup for '${normalized}' — person (id ${person.id}), `
            + `${userId ? "has an account" : "no account"}, dance profile ${visible ? "disclosed" : "withheld"}`,
        );

        return {
            found: true,
            personId: person.id,
            name: person.name,
            surname: person.surname,
            email: person.contact?.email ?? normalized,
            hasAccount: !!userId,
            dancerProfile: visible
                ? {
                    preferredRole: profile!.preferredRole ?? null,
                    declaredLevel: profile!.declaredLevel ?? null,
                    city: profile!.city ?? null,
                }
                : null,
        };
    }
}
