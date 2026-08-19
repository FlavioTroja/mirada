import { z } from 'zod';

export const UserOrderByRelevanceFieldEnumSchema = z.enum(['username','password','wsCode','avatarUrl','note','authentikSub']);

export default UserOrderByRelevanceFieldEnumSchema;
