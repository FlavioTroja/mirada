import { z } from 'zod';

export const VenueScalarFieldEnumSchema = z.enum(['id','organizationId','name','addressId','latitude','longitude','capacity','floorNotes','airConditioning','parking','accessibility','notes','deleted','createdAt','updatedAt']);

export default VenueScalarFieldEnumSchema;
