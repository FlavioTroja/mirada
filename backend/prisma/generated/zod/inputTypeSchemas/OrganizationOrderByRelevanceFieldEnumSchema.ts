import { z } from 'zod';

export const OrganizationOrderByRelevanceFieldEnumSchema = z.enum(['name','legalName','legalForm','vatNumber','taxCode','contactEmail','contactPhone','website','stripeAccountId','termsVersion']);

export default OrganizationOrderByRelevanceFieldEnumSchema;
