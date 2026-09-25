import { z } from 'zod';

export const AppointmentScalarFieldEnumSchema = z.enum(['id','organizationId','title','note','startAt','endAt','allDay','venueId','room','seriesId','createdById','deleted','createdAt','updatedAt']);

export default AppointmentScalarFieldEnumSchema;
