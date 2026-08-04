import { UserCreateSchema } from "@DTOs/user/UserCreateDTO";
import { z } from "zod";

export const UserCreationFromPersonSchema = UserCreateSchema.omit({
    roles: true,
}).extend({
    username: z.string().optional(),
    email: z.string().optional(),
});
export type UserCreationFromPersonDTO = z.infer<typeof UserCreationFromPersonSchema>;