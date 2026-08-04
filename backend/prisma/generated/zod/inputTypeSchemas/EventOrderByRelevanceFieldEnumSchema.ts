import { z } from 'zod';

export const EventOrderByRelevanceFieldEnumSchema = z.enum(['slug','contentLanguage','secondLanguage','tags','cancellationReason']);

export default EventOrderByRelevanceFieldEnumSchema;
