# Smatch Badminton Backend

Backend service for the Smatch Badminton application, a comprehensive platform for managing badminton courts, bookings, matches, and real-time features.

## Features

- **Authentication & User Management**: Firebase-based authentication with user profiles and FCM token management
- **Courts Management**: Full CRUD operations for badminton courts with sub-courts, pricing, and holiday multipliers
- **Availability & Booking System**: Real-time court availability checking and booking management with group bookings support
- **Match System**: Create and manage badminton matches with participant tracking, payment splitting, and notifications
- **Payment Integration**: ZaloPay payment processing with transaction tracking and QR code generation
- **Geospatial Features**: 
  - Find courts near specific locations
  - Vector map tiles (MVT) for high-performance map rendering
  - PostgreSQL text search with Vietnamese language support
- **Real-time Features**: WebSocket support for live updates
- **Media Management**: AWS S3 integration for court images with automatic optimization
- **Task Scheduling**: Automated background jobs using Redis-backed scheduling
- **API Documentation**: Interactive Swagger UI documentation

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript (ESM)
- **Framework**: Express.js 5
- **Database**: PostgreSQL 17 with PostGIS 3.5 extension
- **ORM**: Prisma
- **Cache/Queue**: Redis 7
- **Authentication**: Firebase Admin SDK
- **Payment**: ZaloPay API
- **Storage**: AWS S3
- **Infrastructure**: Docker & Docker Compose
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/arc_badminton?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase Admin SDK (required for authentication)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# AWS S3 (for court images)
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# ZaloPay (for payments)
ZALOPAY_APP_ID=your-app-id
ZALOPAY_KEY1=your-key1
ZALOPAY_KEY2=your-key2
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn
ZALOPAY_CALLBACK_URL=h, Redis, and tile server:
    ```bash
    npm run docker:up
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Generate Prisma client:
    ```bash
    npm run db:generate
    ```

4.  Run database migrations:
    ```bash
    npm run db:migrate
    ```

5.  (Optional) Seed the database with sample data:
    ```bash
    npm run db:seed
    ```

6.  Start the development server:
    ```bash
    npm run dev
    ```

The server will start at `http://localhost:3000`.

## API Endpoints

The API is organized into the following main routes:

- **`/api/auth`** - User authentication and profile management
- **`/api/courts`** - Court CRUD operations and management
- **`/api/courts/:courtId/availability`** - Check court availability
- **`/api/bookings`** - Booking management
- **`/api/matches`** - Match creation and management
- **`/api/payments`** - Payment processing and callbacks
- **`/api/search`** - Search courts with filters
- **`/api/map-tiles`** - Vector tiles for map rendering
- **`/api/s3-proxy`** - Proxy for S3 image uploads
- **`/api/docs`** - Interactive Swagger API documentation

## Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:migrate:prod  # Deploy migrations (production)
npm run db:push          # Push schema changes without migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database with sample data
npm run db:reset         # Reset database (destructive)

# Docker
npm run docker:up        # Start Docker services (PostgreSQL, Redis, pg_tileserv)
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:security    # Run security tests only
npm run test:coverage    # Run tests with coverage report

# Build & Production
npm run build            # Build TypeScript to JavaScript
npm start                # Start production server

# Utilities
npm run backfill:google-users  # Backfill existing Google users
```

## Documentation

- **API Documentation**: Visit `http://localhost:3000/api/docs` when the server is running for interactive Swagger UI
- **OpenAPI Spec**: Available at [docs/openapi.yaml](docs/openapi.yaml)
- **Health Check**: `GET /health`
- **Version Info**: `GET /version`

## Architecture

The project follows a layered architecture pattern:

```
routes → controllers → services → repositories → database
```

- **Routes**: Define API endpoints and route handlers
- **Controllers**: Handle HTTP requests/responses, validate input
- **Services**: Contain business logic, orchestrate operations
- **Repositories**: Data access layer, interact with database
- **Middlewares**: Authentication, validation, error handling

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Test individual functions and services
- **Integration Tests**: Test API endpoints and database interactions
- **Security Tests**: Test authentication and authorization

Run tests with:
```bash
npm run test
```

## WebSocket Support

The server includes WebSocket support for real-time features. WebSocket connections are automatically upgraded at the root endpoint. Use the `websocketService` to broadcast updates to connected clients.

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Configure production database URL
3. Run migrations: `npm run db:migrate:prod`
4. Build the application: `npm run build`
5. Start the server: `npm start`

Ensure all required environment variables are configured for production, including secure Firebase credentials and payment gateway settings
1.  Start the database and tile server:
    ```bash
    npm run docker:up
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run database migrations:
    ```bash
    npm run db:migrate
    ```

4.  Start the development server:
    ```bash
    npm run dev
    ```

The server will start at `http://localhost:3000`.

## Documentation

For detailed API documentation, please refer to [docs/API.md](docs/API.md).
