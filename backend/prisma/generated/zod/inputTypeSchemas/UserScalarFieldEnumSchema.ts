import { z } from 'zod';

export const UserScalarFieldEnumSchema = z.enum(['id','username','password','wsCode','avatarUrl','note','enabled','activatedAt','expiresAt','emailVerifiedAt','authentikSub','logoFileId','personId','deleted','createdAt','updatedAt']);

export default UserScalarFieldEnumSchema;
