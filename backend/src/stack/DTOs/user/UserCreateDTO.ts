import { z } from "zod";
import {
    AddressSchema,
    ContactSchema,
    PersonSchema,
    RoleToUserSchema,
} from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const UserCreateSchema = z.object({
    username: z.string(),
    password: z.string(),
    avatarUrl: z.string().optional(),
    note: z.string().optional(),

    // SaaS account lifecycle
    enabled: z.boolean().optional(),
    activatedAt: z.coerce.date().nullish(),
    expiresAt: z.coerce.date().nullish(),

    // Relations
    roles: z.array(withoutMetadata(RoleToUserSchema.omit({ userId: true }))).optional(),
    addresses: z.array(withoutMetadata(AddressSchema.omit({ personId: true }))).optional(),
    contact: withoutMetadata(ContactSchema),
    person: withoutMetadata(PersonSchema.omit({ contactId: true })),
});
export type UserCreateDTO = z.infer<typeof UserCreateSchema>;