# Dependency injection

1. All dependencies are injected via the **constructor** as `private readonly` parameters. `fastify-decorators` resolves them.
2. Never instantiate a service or repository with `new` from a route handler.
3. Repositories that depend on other repositories follow the same rule.

```ts
@Service()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly personRepository: PersonRepository
    ) {}
}
```
