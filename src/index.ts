import express, { type Express } from 'express';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config, initializeS3Client } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { apiRoutes } from './routes/index.js';
import { docsRoutes } from './routes/docs.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/index.js';
import { websocketService, redisService, schedulerService, s3Service } from './services/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();
const server = createServer(app);

// Load version info
let versionInfo: any = { version: 'unknown' };
try {
  const versionPath = join(__dirname, '../version.json');
  versionInfo = JSON.parse(readFileSync(versionPath, 'utf-8'));
} catch {
  // version.json not found, will use fallback
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    wsConnections: websocketService.getConnectionCount(),
  });
});

// Version endpoint
app.get('/version', (_req, res) => {
  res.json(versionInfo);
});

// API Documentation (Swagger UI)
app.use('/api/docs', docsRoutes);

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  schedulerService.stop();
  websocketService.close();
  await redisService.close();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start(): Promise<void> {
  // Initialize WebSocket server
  websocketService.initialize(server);

  // Start HTTP server
  server.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`📦 Environment: ${config.nodeEnv}`);
    console.log(`📚 API Docs: http://localhost:${config.port}/api/docs`);
    console.log(`🔌 WebSocket: ws://localhost:${config.port}/ws/payments`);
  });

  // Then connect to database (non-blocking)
  const dbConnected = await connectDatabase();
  if (!dbConnected) {
    console.warn('⚠️  Server running without database connection. Run docker:up first.');
  } else {
    // Initialize S3 client and create buckets
    try {
      initializeS3Client();
      await s3Service.createBucket(config.aws.s3.bucketProfile);
      await s3Service.createBucket(config.aws.s3.bucketMatches);
    } catch (error) {
      console.warn('⚠️  Failed to initialize S3:', error instanceof Error ? error.message : error);
    }

    // Start scheduler only if database is connected
    schedulerService.start();
  }
}

start().catch(console.error);
