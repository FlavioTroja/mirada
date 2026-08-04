import { z } from 'zod';

export const VenueOrderByRelevanceFieldEnumSchema = z.enum(['name','floorNotes','accessibility','notes']);

export default VenueOrderByRelevanceFieldEnumSchema;
