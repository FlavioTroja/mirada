import { UserCreateSchema } from "@DTOs/user/UserCreateDTO";
import { z } from "zod";

export const UserUpdateFromPersonSchema = UserCreateSchema.extend({
    password: z.string().optional(),
});
export type UserUpdateFromPersonDTO = z.infer<typeof UserUpdateFromPersonSchema>;