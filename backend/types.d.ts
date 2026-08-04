import http from "http";
import {
    FastifyInstance,
    RawReplyDefaultExpression,
    RawRequestDefaultExpression,
} from "fastify";
import { FastifyBaseLogger } from "fastify/types/logger";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { User } from "@authentication/models/User";
import { FilterQuery, PaginateModel, PaginateOptions, PaginateResult } from "mongoose";

type FastifyApplication = FastifyInstance<
    http.Server,
    RawRequestDefaultExpression<http.Server>,
    RawReplyDefaultExpression<http.Server>,
    FastifyBaseLogger,
    ZodTypeProvider
>;

declare module "fastify" {
    export interface FastifyInstance<
        HttpServer = http.Server,
        HttpRequest = http.IncomingMessage,
        HttpResponse = http.ServerResponse,
    > {
        authenticate: (
            request: FastifyRequest,
            reply: FastifyReply
        ) => Promise<void>;
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: User;
        user: User;
    }
}

// HACK: This is to make sure that library that depend on mongoose <7.0 keep working
type LeanDocument<T> = T;

type PaginateMethod<T> = <T extends PaginateModel<T>>(
    this: T,
    query?: FilterQuery<T>,
    options?: PaginateOptions,
    callback?: (err: Error, result: PaginateResult<T>) => void,
) => Promise<PaginateResult<T>>;