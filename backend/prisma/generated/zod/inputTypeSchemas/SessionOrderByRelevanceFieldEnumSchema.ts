import { z } from 'zod';

export const SessionOrderByRelevanceFieldEnumSchema = z.enum(['room','level','cancellationReason','seriesId']);

export default SessionOrderByRelevanceFieldEnumSchema;
