import { z } from 'zod';

export const EventScalarFieldEnumSchema = z.enum(['id','organizationId','eventTypeId','venueId','title','slug','description','startAt','endAt','contentLanguage','secondLanguage','tags','posterVerticalFileId','posterHorizontalFileId','posterSquareFileId','status','refundPolicyId','refundPolicyText','minorsAdmitted','minorsConditions','salesCloseAt','salesCloseCriteria','manageExternalChannels','publishedAt','cancelledAt','cancellationReason','deleted','createdAt','updatedAt']);

export default EventScalarFieldEnumSchema;
