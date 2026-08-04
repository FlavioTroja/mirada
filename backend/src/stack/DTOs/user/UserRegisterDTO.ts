import { z } from "zod";
import { GenderSchema } from "@prisma-gen/zod";

export const UserRegisterSchema = z.object({
    // User
    username: z.string(),
    password: z.string().min(8),
    avatarUrl: z.string().nullish(),
    note: z.string().nullish(),

    // Person
    firstName: z.string(),
    lastName: z.string(),
    fiscalCode: z.string().nullish(),
    vatNumber: z.string().nullish(),
    gender: GenderSchema.nullish(),
    birthDate: z.coerce.date().nullish(),
    bornIn: z.string().nullish(),
    livesIn: z.string().nullish(),

    // Contact
    email: z.string().email(),
    phoneNumber: z.string().nullish(),
    telephone: z.string().nullish(),
    pec: z.string().nullish(),
});
export type UserRegisterDTO = z.infer<typeof UserRegisterSchema>;
