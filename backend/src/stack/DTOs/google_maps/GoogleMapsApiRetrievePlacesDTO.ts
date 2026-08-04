import { z } from "zod";

export const GoogleMapsApiRetrievePlacesSchema = z.lazy(() => z.object({
    searchAddress: z.string()
}));

export type GoogleMapsApiRetrievePlacesDTO = z.infer<typeof GoogleMapsApiRetrievePlacesSchema>;
