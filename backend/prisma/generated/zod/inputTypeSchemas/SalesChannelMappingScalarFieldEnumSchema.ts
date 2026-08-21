import { z } from 'zod';

export const SalesChannelMappingScalarFieldEnumSchema = z.enum(['id','salesChannelId','externalProductId','externalVariantId','ticketTypeId','seatsPerUnit','deleted','createdAt','updatedAt']);

export default SalesChannelMappingScalarFieldEnumSchema;
