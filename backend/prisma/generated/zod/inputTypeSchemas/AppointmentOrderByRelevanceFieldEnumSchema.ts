import { z } from 'zod';

export const AppointmentOrderByRelevanceFieldEnumSchema = z.enum(['title','note','room','seriesId']);

export default AppointmentOrderByRelevanceFieldEnumSchema;
