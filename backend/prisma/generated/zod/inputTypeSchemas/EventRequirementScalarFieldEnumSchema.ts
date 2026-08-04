import { z } from 'zod';

export const EventRequirementScalarFieldEnumSchema = z.enum(['id','eventId','requirementTypeId','label','text','mandatory','blocking','verification','dueAt','config','sortOrder','deleted','createdAt','updatedAt']);

export default EventRequirementScalarFieldEnumSchema;
