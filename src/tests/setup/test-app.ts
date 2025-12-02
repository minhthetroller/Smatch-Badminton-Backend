import express, { type Express } from 'express';
import { apiRoutes } from '../../routes/index.js';
import { errorHandler, notFoundHandler } from '../../middlewares/index.js';

/**
 * Creates an Express app instance for testing.
 * Does not start the server or connect to database.
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '100kb' })); // Limit payload size for security tests
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', apiRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const testApp = createTestApp();
