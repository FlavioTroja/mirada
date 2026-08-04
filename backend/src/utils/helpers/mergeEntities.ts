export type LinkableEntity<T> = T & { toBeDisconnected?: boolean, id?: number };

export function mergeEntities<A, B>(currentEntities: LinkableEntity<A>[], updatedEntities: LinkableEntity<B>[])  {
    const newEntities = currentEntities.map((entity) => {
        const updatedEntity = updatedEntities.find((e) => e.id === entity.id);

        return updatedEntity ? updatedEntity.toBeDisconnected ? null : updatedEntity : entity;
    }).filter((p) => !!p) as LinkableEntity<A | B>[];

    newEntities.push(...(updatedEntities?.filter((p) => p.id === -1) ?? []));

    return newEntities;
}

export function splitLinkableEntities<T extends { toBeDisconnected?: boolean, id?: number }>(items: T[]) {
    return {
        toCreate: items.filter(r => r.id === -1 && !r.toBeDisconnected).map(r => ({ ...r, toBeDisconnected: undefined })),
        toDisconnect: items.filter(r => r.id !== -1 && r.toBeDisconnected).map(r => ({ ...r, toBeDisconnected: undefined })),
        toUpdate: items.filter(r => r.id !== -1 && !r.toBeDisconnected).map(r => ({ ...r, toBeDisconnected: undefined })),
    };
}