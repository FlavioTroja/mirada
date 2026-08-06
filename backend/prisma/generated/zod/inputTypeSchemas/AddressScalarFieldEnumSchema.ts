import { z } from 'zod';

export const AddressScalarFieldEnumSchema = z.enum(['id','country','state','province','city','zipCode','address','number','note','default','billing','region','personId','createdAt','updatedAt']);

export default AddressScalarFieldEnumSchema;
