import { z } from 'zod';

export const UiScopeSchema = z.enum(['EDITABLE','VISIBLE','INVISIBLE']);

export type UiScopeType = `${z.infer<typeof UiScopeSchema>}`

export default UiScopeSchema;
