import { FieldResolvers } from "@DTOs/transfomer/FieldResolvers";
import {
    HiddenComponentConfigOptionalDefaults,
    HiddenComponentConfigOptionalDefaultsSchema,
} from "@prisma-gen/zod";
import { TransformerInterface } from "../interfaces/TransformerInterface";
import { HiddenComponentConfigCreateDTO } from "@DTOs/hidden_component_config/HiddenComponentConfigCreateDTO";

export type HiddenComponentConfigCreateResolvers = FieldResolvers & {
    hiddenComponentConfigs: () => HiddenComponentConfigOptionalDefaults[]
}

export class HiddenComponentConfigCreateDTOTransformer implements TransformerInterface<HiddenComponentConfigCreateDTO, HiddenComponentConfigCreateResolvers> {
    transform(dto: HiddenComponentConfigCreateDTO): HiddenComponentConfigCreateResolvers {
        return {
            hiddenComponentConfigs: () => dto.roles.map((r) => ({
                ...HiddenComponentConfigOptionalDefaultsSchema.parse(dto),
                roleName: r
            }))
        }
    }
}