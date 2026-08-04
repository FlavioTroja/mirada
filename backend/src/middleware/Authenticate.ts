import { FastifyReply, FastifyRequest } from "fastify";
import httpErrors from "http-errors";


export function Authenticate() {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            await req.jwtVerify();
        } catch (err) {
            throw new httpErrors.Unauthorized();
        }
    };
}
