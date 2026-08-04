import { z } from 'zod';

export const AddressScalarFieldEnumSchema = z.enum(['id','country','state','province','city','zipCode','address','number','note','default','billing','personId','createdAt','updatedAt']);

export default AddressScalarFieldEnumSchema;
