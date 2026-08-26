import { z } from 'zod';

export const SalesChannelScalarFieldEnumSchema = z.enum(['id','organizationId','provider','label','publicId','externalShopId','credentials','webhookSecret','status','lastReconciledAt','roleAttributeName','attendeeNameAttributeName','deleted','createdAt','updatedAt']);

export default SalesChannelScalarFieldEnumSchema;
