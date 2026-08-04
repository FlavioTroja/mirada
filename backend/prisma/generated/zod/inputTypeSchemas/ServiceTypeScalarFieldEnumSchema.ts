import { z } from 'zod';

export const ServiceTypeScalarFieldEnumSchema = z.enum(['id','name','attributesSchema','active','deleted','createdAt','updatedAt']);

export default ServiceTypeScalarFieldEnumSchema;
