import { Service } from "fastify-decorators";
import { provide } from "inversify-binding-decorators";
import { Address, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { regionForProvince } from "@utils/helpers/italianProvinces";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { AddressRepository } from "@repositories/AddressRepository";
import { AddressCreateDTO } from "@DTOs/address/AddressCreateDTO";
import { AddressUpdateDTO } from "@DTOs/address/AddressUpdateDTO";
import { AddressQueryDTO } from "@DTOs/address/AddressQueryDTO";

/**
 * `Address` — **eccezione della foundation completata** (backend-brief §3.4).
 *
 * Il template spediva il solo `GET /addresses/cities`, ma `Venue.addressId` è
 * obbligatorio: senza una creazione, una location non è creabile
 * dall'interfaccia. Qui vivono i cinque verbi del dialetto §3.2.
 *
 * **Tenancy** — `Address` non discende da `Organization`: non porta
 * `organizationId`, quindi non c'è alcun filtro di scope da applicare (§1.5
 * riguarda le entità che discendono da `Organization`). L'isolamento fra
 * organizzatori resta su `Venue` e `Organization`, che sono le righe che portano
 * il riferimento e il proprio `organizationId`.
 *
 * **Cancellazione** — `Address` è l'unica entità del dialetto **senza colonna
 * `deleted`**: la foundation non gliela dà. La cancellazione è quindi reale, e il
 * servizio rifiuta esplicitamente un indirizzo ancora referenziato invece di
 * lasciar produrre al vincolo di chiave esterna un errore opaco.
 */
@Service()
@provide(AddressService)
export class AddressService {

    constructor( private readonly addressRepository: AddressRepository) {}

    public async findDistinctCities(): Promise<{ cities: string[] | null }> {
        const fullAddresses = await this.addressRepository.findDistinctCities();

        if (!fullAddresses) {
            throw new httpErrors.NotFound("Attenzione! Non sono state trovate città!");
        }

        return {
            cities: [...new Set(fullAddresses.map(a => (a?.city?.charAt(0).toUpperCase() ?? "") + a?.city?.slice(1)?.toLowerCase()).sort())]
        };

    }

    public async save(dto: AddressCreateDTO): Promise<Address> {
        const region = regionForProvince(dto.province);

        Log.info(
            `[Address Service]: creating address '${dto.address ?? "-"} ${dto.number ?? ""}' in '${dto.city ?? "-"}' `
            + `(${dto.province ?? "no province"} → ${region ?? "no region"})`,
        );
        const address = await this.addressRepository.save({ ...dto, region });
        Log.info(`[Address Service]: address created (id ${address.id})`);
        return address;
    }

    public async findById(id: number, options?: FindOptions): Promise<Address | null> {
        return this.addressRepository.findOne({ id }, options);
    }

    public async paginate(query: AddressQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Address>> {
        return this.addressRepository.paginate(this.createQueryFromPayload(query), options);
    }

    /**
     * La regione si **ricalcola a ogni aggiornamento che tocca la provincia**
     * (§3.4). Un `PATCH { province: "RM" }` su un indirizzo pugliese che lasciasse
     * `region = "Puglia"` produrrebbe una riga che mente sul proprio territorio —
     * e la colonna è indicizzata, quindi mentirebbe anche nel filtro geografico
     * della ricerca pubblica, che è precisamente ciò per cui esiste.
     *
     * Se `province` non compare nel `PATCH`, la regione resta quella che è: non si
     * ricalcola ciò che non è cambiato.
     */
    public async updateById(id: number, dto: AddressUpdateDTO): Promise<Address> {
        await this.findByIdOrThrow(id);

        const derived = "province" in dto
            ? { region: regionForProvince(dto.province) }
            : {};

        Log.info(
            `[Address Service]: updating address (id ${id})`
            + ("region" in derived ? ` — province '${dto.province ?? "none"}' derives region '${derived.region ?? "none"}'` : ""),
        );
        return this.addressRepository.update({ id }, { ...dto, ...derived });
    }

    /**
     * Cancellazione **reale**: la riga non ha colonna `deleted`. Un indirizzo
     * ancora usato da una sala o da un'organizzazione non si cancella — la sala
     * resterebbe priva del suo dato obbligatorio.
     */
    public async deleteById(id: number): Promise<Address> {
        await this.findByIdOrThrow(id);

        const references = await this.addressRepository.countReferences(id);
        if (references.venues || references.organizations) {
            Log.warn(
                `[Address Service]: delete refused for address (id ${id}) — still referenced by `
                + `${references.venues} venue(s) and ${references.organizations} organization(s)`,
            );
            throw new httpErrors.BadRequest(
                "L'indirizzo è ancora usato da una sala o da un'organizzazione e non può essere eliminato.",
            );
        }

        Log.info(`[Address Service]: deleting address (id ${id})`);
        return this.addressRepository.deleteById(id);
    }

    private async findByIdOrThrow(id: number): Promise<Address> {
        const address = await this.findById(id);
        if (!address) {
            Log.warn(`[Address Service]: address (id ${id}) not found`);
            throw new httpErrors.NotFound("Indirizzo non trovato.");
        }
        return address;
    }

    private createQueryFromPayload(payload: AddressQueryDTO): Prisma.AddressWhereInput {
        const valueQuery: Prisma.AddressWhereInput[] = [
            createObjectWithoutThrow(payload.value, { city: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { address: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { province: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { region: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { country: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { zipCode: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.AddressWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.city, { city: { equals: payload.city, mode: "insensitive" as const } }),
            createObjectWithoutThrow(payload.province, { province: { equals: payload.province, mode: "insensitive" as const } }),
            createObjectWithoutThrow(payload.region, { region: { equals: payload.region, mode: "insensitive" as const } }),
            createObjectWithoutThrow(payload.country, { country: { equals: payload.country, mode: "insensitive" as const } }),
            createObjectWithoutThrow(payload.personId, { personId: payload.personId }),
        ].filter(o => Object.values(o).length > 0);

        return query.length ? { AND: query } : {};
    }
}
