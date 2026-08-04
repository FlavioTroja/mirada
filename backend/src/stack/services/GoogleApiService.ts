import { Service } from "fastify-decorators";
import { fetch } from "@utils/adapters/fetch";
import httpErrors from "http-errors";
import { ConfigService } from "@services/ConfigService";


@Service()
export class GoogleMapsApiService {
    constructor(private readonly configService: ConfigService) {}

    public async retrievePlaces(searchAddress: string) {

        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": (await this.configService.findByName("google_api_key")).value.toString()
            },
            body: JSON.stringify({
                input: searchAddress,
                languageCode: "it",
                regionCode: "it"
            }),
        });

        const result = await res.json();

        if (res.status !== 200) {
            throw new httpErrors.BadRequest(result.error.message);
        }

        return result.suggestions.map((suggestion: any) => ({
            placeId: suggestion.placePrediction.placeId,
            text: suggestion.placePrediction.text.text,
        }));

    }


    public async getDetailAddress(placeId: string) {
        const GOOGLE_API_KEY = (await this.configService.findByName("google_api_key")).value.toString();

        const filterFields: string = "formatted_address,address_components";

        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}&fields=${filterFields}&language=it`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY
            }
        });

        const result = await res.json();

        if (res.status !== 200) {
            throw new httpErrors.BadRequest(result.error.message);
        }

        const { result: { formatted_address, address_components } } = result;

        return {
            formatted_address,

            country: address_components.find((a: any) => a.types.includes("country"))?.long_name || undefined,
            state: address_components.find((a: any) => a.types.includes("administrative_area_level_1"))?.long_name || undefined,
            province: address_components.find((a: any) => a.types.includes("administrative_area_level_2"))?.short_name || undefined,
            city: address_components.find((a: any) => a.types.includes("administrative_area_level_3"))?.long_name || undefined,
            zipCode: address_components.find((a: any) => a.types.includes("postal_code"))?.long_name || undefined,
            address: address_components.find((a: any) => a.types.includes("route"))?.long_name || undefined,
            number: address_components.find((a: any) => a.types.includes("street_number"))?.long_name || undefined,
        };

    }

}
