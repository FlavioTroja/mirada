import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
    actorId?: number;
    actorUsername?: string;
};

export const requestStorage = new AsyncLocalStorage<RequestContext>();

export const currentActor = (): RequestContext | undefined => requestStorage.getStore();
