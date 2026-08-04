import { z } from 'zod';

export const DancerProfileOrderByRelevanceFieldEnumSchema = z.enum(['nickname','city','languages','declaredLevel']);

export default DancerProfileOrderByRelevanceFieldEnumSchema;
