import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; username: string };
    user:    { sub: number; username: string };
  }
}
