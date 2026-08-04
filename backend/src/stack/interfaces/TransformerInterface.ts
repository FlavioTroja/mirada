import { FieldResolvers } from "@DTOs/transfomer/FieldResolvers";

export interface TransformerInterface<I, O extends FieldResolvers> {
    transform(dto: I): O
}