import type { FastifyInstance } from 'fastify';

/**
 * Registers debug routes for development and testing
 * - GET /debug/auth - Returns current auth context
 */
export async function registerDebugRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/debug/auth',
    {
      schema: {
        tags: ['Debug'],
        summary: 'Returns current auth context (for debugging)',
        description:
          'Returns the auth context attached to the current request. ' +
          'Requires Authorization: Bearer <token> header and optionally X-Workspace-Id and X-Brand-Id headers.',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              auth: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      workspaceId: { type: ['string', 'null'] },
                      brandId: { type: ['string', 'null'] },
                      tokenType: { type: 'string' },
                      tokenPayload: {
                        type: 'object',
                        properties: {
                          sub: { type: 'string' },
                          wid: { type: ['string', 'null'] },
                          bid: { type: ['string', 'null'] },
                          type: { type: 'string' },
                          iat: { type: ['number', 'null'] },
                          exp: { type: ['number', 'null'] },
                        },
                      },
                    },
                    required: ['userId', 'tokenType', 'tokenPayload'],
                  },
                ],
              },
            },
            required: ['success', 'auth'],
          },
        },
      },
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        auth: request.auth ?? null,
      });
    }
  );
}

