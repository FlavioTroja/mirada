import { z } from 'zod';

export const ArtistScalarFieldEnumSchema = z.enum(['id','organizationId','name','kind','bio','photoFileId','website','deleted','createdAt','updatedAt']);

export default ArtistScalarFieldEnumSchema;
