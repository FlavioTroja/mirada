import { z } from 'zod';

export const ConfigScalarFieldEnumSchema = z.enum(['name','scope','uiScope','type','boolean','integer','float','string','json','createdAt','updatedAt']);

export default ConfigScalarFieldEnumSchema;
