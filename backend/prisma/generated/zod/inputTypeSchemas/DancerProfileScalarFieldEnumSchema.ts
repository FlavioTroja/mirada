import { z } from 'zod';

export const DancerProfileScalarFieldEnumSchema = z.enum(['id','userId','nickname','preferredRole','city','languages','birthDate','declaredLevel','avatarFileId','nicknameChangedAt','nicknameChangeCount','attributes','deleted','createdAt','updatedAt']);

export default DancerProfileScalarFieldEnumSchema;
