import { z } from 'zod';

export const ArtistKindSchema = z.enum(['TEACHER','DJ','ORCHESTRA']);

export type ArtistKindType = `${z.infer<typeof ArtistKindSchema>}`

export default ArtistKindSchema;
