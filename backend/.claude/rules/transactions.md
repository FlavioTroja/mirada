# Transactions

1. **Any operation that performs more than one write — even on the same entity — must run inside a `$transaction`.**
2. Open the transaction in the **service** layer with `getPrismaClient().$transaction(async prisma => { … })`.
3. Forward the `prisma` argument to **every** repository call inside the closure.

```ts
return getPrismaClient().$transaction(async prisma => {
    const a = await this.fooRepository.save(data1, prisma);
    return this.barRepository.update({ id: a.id }, data2, undefined, undefined, prisma);
});
```
