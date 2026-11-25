import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WorkSphere Multi-Tenant Core API',
      version: '1.0.0',
      description:
        'Versioned REST API for WorkSphere multi-tenant project management, workflow automation, RBAC, real-time notifications, and third-party webhooks.',
    },
    servers: [
      {
        url: `${config.apiUrl}/api/v1`,
        description: 'WorkSphere API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        orgHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Org-ID',
        },
      },
    },
    security: [{ bearerAuth: [], orgHeader: [] }],
  },
  apis: ['./src/routes/v1/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
