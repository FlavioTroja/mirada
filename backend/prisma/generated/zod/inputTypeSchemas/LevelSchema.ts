import { z } from 'zod';

export const LevelSchema = z.enum(['INFO','WARNING','ERROR']);

export type LevelType = `${z.infer<typeof LevelSchema>}`

export default LevelSchema;
