import { z } from 'zod';

export const FiscalDeclarationScalarFieldEnumSchema = z.enum(['id','organizationId','eventId','kind','version','frameworkLabel','statementText','declaredAt','declaredByUserId','ipAddress','deleted','createdAt','updatedAt']);

export default FiscalDeclarationScalarFieldEnumSchema;
