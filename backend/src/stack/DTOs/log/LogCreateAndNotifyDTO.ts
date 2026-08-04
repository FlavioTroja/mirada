import { z } from "zod";
import { LogCreateSchema } from "@DTOs/log/LogCreateDTO";

export const LogCreateAndNotifySchema = LogCreateSchema.omit({
    recipients: true,
    actionByUsername: true,
});
export type LogCreateAndNotifyDTO = z.infer<typeof LogCreateAndNotifySchema>;
