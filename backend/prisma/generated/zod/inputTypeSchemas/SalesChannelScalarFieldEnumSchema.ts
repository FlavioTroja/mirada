import { z } from 'zod';

export const SalesChannelScalarFieldEnumSchema = z.enum(['id','organizationId','provider','label','publicId','externalShopId','credentials','webhookSecret','status','lastReconciledAt','deleted','createdAt','updatedAt']);

export default SalesChannelScalarFieldEnumSchema;
