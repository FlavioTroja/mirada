import { z } from "zod";
import { ContactSchema } from "@prisma-gen/zod";

export const ContactCreationSchema = ContactSchema
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    })
    .refine((data: any) => {
        // Ensure that if email is provided, pec is not required and vice versa
        // Same thing for phoneNumber and telephone
        const hasEmail = data.email !== undefined && data.email !== null && data.email.trim() !== "";
        const hasPec = data.pec !== undefined && data.pec !== null && data.pec.trim() !== "";
        const hasPhoneNumber = data.phoneNumber !== undefined && data.phoneNumber !== null && data.phoneNumber.trim() !== "";
        const hasTelephone = data.telephone !== undefined && data.telephone !== null && data.telephone.trim() !== "";
        return !(!hasEmail && !hasPec) && !(!hasPhoneNumber && !hasTelephone);
    }, "Almeno un contatto deve essere fornito tra email e pec, e tra phoneNumber e telephone.");

export type ContactCreationDTO = z.infer<typeof ContactCreationSchema>;