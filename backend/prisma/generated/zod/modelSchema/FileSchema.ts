import { z } from 'zod';
import { PersonFileWithRelationsSchema, PersonFilePartialWithRelationsSchema, PersonFileOptionalDefaultsWithRelationsSchema } from './PersonFileSchema'
import type { PersonFileWithRelations, PersonFilePartialWithRelations, PersonFileOptionalDefaultsWithRelations } from './PersonFileSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { DancerProfileWithRelationsSchema, DancerProfilePartialWithRelationsSchema, DancerProfileOptionalDefaultsWithRelationsSchema } from './DancerProfileSchema'
import type { DancerProfileWithRelations, DancerProfilePartialWithRelations, DancerProfileOptionalDefaultsWithRelations } from './DancerProfileSchema'
import { ArtistWithRelationsSchema, ArtistPartialWithRelationsSchema, ArtistOptionalDefaultsWithRelationsSchema } from './ArtistSchema'
import type { ArtistWithRelations, ArtistPartialWithRelations, ArtistOptionalDefaultsWithRelations } from './ArtistSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'

/////////////////////////////////////////
// FILE SCHEMA
/////////////////////////////////////////

export const FileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  path: z.string(),
  url: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type File = z.infer<typeof FileSchema>

/////////////////////////////////////////
// FILE PARTIAL SCHEMA
/////////////////////////////////////////

export const FilePartialSchema = FileSchema.partial()

export type FilePartial = z.infer<typeof FilePartialSchema>

/////////////////////////////////////////
// FILE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const FileOptionalDefaultsSchema = FileSchema.merge(z.object({
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type FileOptionalDefaults = z.infer<typeof FileOptionalDefaultsSchema>

/////////////////////////////////////////
// FILE RELATION SCHEMA
/////////////////////////////////////////

export type FileRelations = {
  personFiles: PersonFileWithRelations[];
  userLogos: UserWithRelations[];
  organizationLogos: OrganizationWithRelations[];
  dancerProfileAvatar: DancerProfileWithRelations[];
  artistPhotos: ArtistWithRelations[];
  eventPostersVertical: EventWithRelations[];
  eventPostersHorizontal: EventWithRelations[];
  eventPostersSquare: EventWithRelations[];
  ticketPdfs: TicketWithRelations[];
};

export type FileWithRelations = z.infer<typeof FileSchema> & FileRelations

export const FileWithRelationsSchema: z.ZodType<FileWithRelations> = FileSchema.merge(z.object({
  personFiles: z.lazy(() => PersonFileWithRelationsSchema).array(),
  userLogos: z.lazy(() => UserWithRelationsSchema).array(),
  organizationLogos: z.lazy(() => OrganizationWithRelationsSchema).array(),
  dancerProfileAvatar: z.lazy(() => DancerProfileWithRelationsSchema).array(),
  artistPhotos: z.lazy(() => ArtistWithRelationsSchema).array(),
  eventPostersVertical: z.lazy(() => EventWithRelationsSchema).array(),
  eventPostersHorizontal: z.lazy(() => EventWithRelationsSchema).array(),
  eventPostersSquare: z.lazy(() => EventWithRelationsSchema).array(),
  ticketPdfs: z.lazy(() => TicketWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// FILE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type FileOptionalDefaultsRelations = {
  personFiles: PersonFileOptionalDefaultsWithRelations[];
  userLogos: UserOptionalDefaultsWithRelations[];
  organizationLogos: OrganizationOptionalDefaultsWithRelations[];
  dancerProfileAvatar: DancerProfileOptionalDefaultsWithRelations[];
  artistPhotos: ArtistOptionalDefaultsWithRelations[];
  eventPostersVertical: EventOptionalDefaultsWithRelations[];
  eventPostersHorizontal: EventOptionalDefaultsWithRelations[];
  eventPostersSquare: EventOptionalDefaultsWithRelations[];
  ticketPdfs: TicketOptionalDefaultsWithRelations[];
};

export type FileOptionalDefaultsWithRelations = z.infer<typeof FileOptionalDefaultsSchema> & FileOptionalDefaultsRelations

export const FileOptionalDefaultsWithRelationsSchema: z.ZodType<FileOptionalDefaultsWithRelations> = FileOptionalDefaultsSchema.merge(z.object({
  personFiles: z.lazy(() => PersonFileOptionalDefaultsWithRelationsSchema).array(),
  userLogos: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).array(),
  organizationLogos: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema).array(),
  dancerProfileAvatar: z.lazy(() => DancerProfileOptionalDefaultsWithRelationsSchema).array(),
  artistPhotos: z.lazy(() => ArtistOptionalDefaultsWithRelationsSchema).array(),
  eventPostersVertical: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
  eventPostersHorizontal: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
  eventPostersSquare: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
  ticketPdfs: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// FILE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type FilePartialRelations = {
  personFiles?: PersonFilePartialWithRelations[];
  userLogos?: UserPartialWithRelations[];
  organizationLogos?: OrganizationPartialWithRelations[];
  dancerProfileAvatar?: DancerProfilePartialWithRelations[];
  artistPhotos?: ArtistPartialWithRelations[];
  eventPostersVertical?: EventPartialWithRelations[];
  eventPostersHorizontal?: EventPartialWithRelations[];
  eventPostersSquare?: EventPartialWithRelations[];
  ticketPdfs?: TicketPartialWithRelations[];
};

export type FilePartialWithRelations = z.infer<typeof FilePartialSchema> & FilePartialRelations

export const FilePartialWithRelationsSchema: z.ZodType<FilePartialWithRelations> = FilePartialSchema.merge(z.object({
  personFiles: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  userLogos: z.lazy(() => UserPartialWithRelationsSchema).array(),
  organizationLogos: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  dancerProfileAvatar: z.lazy(() => DancerProfilePartialWithRelationsSchema).array(),
  artistPhotos: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  eventPostersVertical: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersHorizontal: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersSquare: z.lazy(() => EventPartialWithRelationsSchema).array(),
  ticketPdfs: z.lazy(() => TicketPartialWithRelationsSchema).array(),
})).partial()

export type FileOptionalDefaultsWithPartialRelations = z.infer<typeof FileOptionalDefaultsSchema> & FilePartialRelations

export const FileOptionalDefaultsWithPartialRelationsSchema: z.ZodType<FileOptionalDefaultsWithPartialRelations> = FileOptionalDefaultsSchema.merge(z.object({
  personFiles: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  userLogos: z.lazy(() => UserPartialWithRelationsSchema).array(),
  organizationLogos: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  dancerProfileAvatar: z.lazy(() => DancerProfilePartialWithRelationsSchema).array(),
  artistPhotos: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  eventPostersVertical: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersHorizontal: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersSquare: z.lazy(() => EventPartialWithRelationsSchema).array(),
  ticketPdfs: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export type FileWithPartialRelations = z.infer<typeof FileSchema> & FilePartialRelations

export const FileWithPartialRelationsSchema: z.ZodType<FileWithPartialRelations> = FileSchema.merge(z.object({
  personFiles: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  userLogos: z.lazy(() => UserPartialWithRelationsSchema).array(),
  organizationLogos: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  dancerProfileAvatar: z.lazy(() => DancerProfilePartialWithRelationsSchema).array(),
  artistPhotos: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  eventPostersVertical: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersHorizontal: z.lazy(() => EventPartialWithRelationsSchema).array(),
  eventPostersSquare: z.lazy(() => EventPartialWithRelationsSchema).array(),
  ticketPdfs: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export default FileSchema;
