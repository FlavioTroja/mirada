import { z } from 'zod';

export const LogScalarFieldEnumSchema = z.enum(['id','level','description','entityId','entityName','input','output','toRoles','actionByUsername','actionById','isNotification','hasError','createdAt','recipients']);

export default LogScalarFieldEnumSchema;
