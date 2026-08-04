# Naming

1. Files are **PascalCase** and match the class they export — `UserController.test.ts`, `UserService.ts`, `UserRepository.ts`. One class per file.
2. DTO files: `UserCreateDTO.ts` exports both `UserCreateSchema` (Zod) and `UserCreateDTO` (`z.infer<typeof UserCreateSchema>`).
3. Transformer files: `UserCreationDTOTransformer.ts`, exporting a class with a `transform(dto)` method.
4. Repository files: `UserRepository.ts`.
