import { z } from 'zod';

export const DancerProfileScalarFieldEnumSchema = z.enum(['id','userId','nickname','preferredRole','city','languages','birthDate','declaredLevel','avatarFileId','nicknameChangedAt','nicknameChangeCount','attributes','profileVisibleToOrganizers','deleted','createdAt','updatedAt']);

export default DancerProfileScalarFieldEnumSchema;
