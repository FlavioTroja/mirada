import { z } from 'zod';

export const TicketOrderByRelevanceFieldEnumSchema = z.enum(['code','holderName','holderSurname','holderEmail']);

export default TicketOrderByRelevanceFieldEnumSchema;
