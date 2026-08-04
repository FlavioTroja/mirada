import { z } from 'zod';

export const PersonScalarFieldEnumSchema = z.enum(['id','name','surname','birthDate','fiscalCode','vatNumber','gender','personType','note','avatarUrl','bornIn','livesIn','contactId','deleted','createdAt','updatedAt']);

export default PersonScalarFieldEnumSchema;
