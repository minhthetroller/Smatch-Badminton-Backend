import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = Router();

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and parse OpenAPI spec
const openApiPath = join(__dirname, '../../docs/openapi.yaml');
const openApiSpec = parse(readFileSync(openApiPath, 'utf8'));

// Swagger UI options
const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Smatch Badminton API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
};

// Serve Swagger UI at /api/docs
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, swaggerOptions));

// Serve raw OpenAPI spec as JSON at /api/docs/openapi.json
router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// Serve raw OpenAPI spec as YAML at /api/docs/openapi.yaml
router.get('/openapi.yaml', (_req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.send(readFileSync(openApiPath, 'utf8'));
});

export { router as docsRoutes };

