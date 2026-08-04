import { z } from 'zod';

export const ArtistOrderByRelevanceFieldEnumSchema = z.enum(['name','website']);

export default ArtistOrderByRelevanceFieldEnumSchema;
