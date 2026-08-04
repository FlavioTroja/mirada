import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { ArtistKindSchema } from '../inputTypeSchemas/ArtistKindSchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { EventCastWithRelationsSchema, EventCastPartialWithRelationsSchema, EventCastOptionalDefaultsWithRelationsSchema } from './EventCastSchema'
import type { EventCastWithRelations, EventCastPartialWithRelations, EventCastOptionalDefaultsWithRelations } from './EventCastSchema'

/////////////////////////////////////////
// ARTIST SCHEMA
/////////////////////////////////////////

export const ArtistSchema = z.object({
  kind: ArtistKindSchema,
  id: z.number().int(),
  /**
   * Null = anagrafica di piattaforma. Nessuna relazione a User: l'artista non ha account (§4.4).
   */
  organizationId: z.number().int().nullish(),
  name: z.string(),
  /**
   * I18nText { it, en? }
   */
  bio: JsonValueSchema.nullable(),
  photoFileId: z.number().int().nullish(),
  website: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Artist = z.infer<typeof ArtistSchema>

/////////////////////////////////////////
// ARTIST PARTIAL SCHEMA
/////////////////////////////////////////

export const ArtistPartialSchema = ArtistSchema.partial()

export type ArtistPartial = z.infer<typeof ArtistPartialSchema>

/////////////////////////////////////////
// ARTIST OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ArtistOptionalDefaultsSchema = ArtistSchema.merge(z.object({
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ArtistOptionalDefaults = z.infer<typeof ArtistOptionalDefaultsSchema>

/////////////////////////////////////////
// ARTIST RELATION SCHEMA
/////////////////////////////////////////

export type ArtistRelations = {
  organization?: OrganizationWithRelations | null;
  photoFile?: FileWithRelations | null;
  eventCasts: EventCastWithRelations[];
};

export type ArtistWithRelations = Omit<z.infer<typeof ArtistSchema>, "bio"> & {
  bio?: JsonValueType | null;
} & ArtistRelations

export const ArtistWithRelationsSchema: z.ZodType<ArtistWithRelations> = ArtistSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema).nullish(),
  photoFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  eventCasts: z.lazy(() => EventCastWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ARTIST OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ArtistOptionalDefaultsRelations = {
  organization?: OrganizationOptionalDefaultsWithRelations | null;
  photoFile?: FileOptionalDefaultsWithRelations | null;
  eventCasts: EventCastOptionalDefaultsWithRelations[];
};

export type ArtistOptionalDefaultsWithRelations = Omit<z.infer<typeof ArtistOptionalDefaultsSchema>, "bio"> & {
  bio?: JsonValueType | null;
} & ArtistOptionalDefaultsRelations

export const ArtistOptionalDefaultsWithRelationsSchema: z.ZodType<ArtistOptionalDefaultsWithRelations> = ArtistOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema).nullish(),
  photoFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  eventCasts: z.lazy(() => EventCastOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ARTIST PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ArtistPartialRelations = {
  organization?: OrganizationPartialWithRelations | null;
  photoFile?: FilePartialWithRelations | null;
  eventCasts?: EventCastPartialWithRelations[];
};

export type ArtistPartialWithRelations = Omit<z.infer<typeof ArtistPartialSchema>, "bio"> & {
  bio?: JsonValueType | null;
} & ArtistPartialRelations

export const ArtistPartialWithRelationsSchema: z.ZodType<ArtistPartialWithRelations> = ArtistPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  photoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  eventCasts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
})).partial()

export type ArtistOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof ArtistOptionalDefaultsSchema>, "bio"> & {
  bio?: JsonValueType | null;
} & ArtistPartialRelations

export const ArtistOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ArtistOptionalDefaultsWithPartialRelations> = ArtistOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  photoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  eventCasts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
}).partial())

export type ArtistWithPartialRelations = Omit<z.infer<typeof ArtistSchema>, "bio"> & {
  bio?: JsonValueType | null;
} & ArtistPartialRelations

export const ArtistWithPartialRelationsSchema: z.ZodType<ArtistWithPartialRelations> = ArtistSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  photoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  eventCasts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
}).partial())

export default ArtistSchema;
