# Smatch Badminton Backend

Backend service for the Arc Badminton application, designed to manage badminton court data and serve vector map tiles for geospatial visualization.

## Features

- **Courts Management**: CRUD operations for badminton courts.
- **Geospatial Search**: Find courts near a specific location.
- **Vector Tiles**: Serves MVT (Mapbox Vector Tiles) for high-performance map rendering.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Database**: PostgreSQL with PostGIS extension
- **ORM**: Prisma
- **Authentication**: Firebase Admin SDK
- **Infrastructure**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/arc_badminton?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase Admin SDK (required for authentication)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ZaloPay (optional, for payments)
ZALOPAY_APP_ID=
ZALOPAY_KEY1=
ZALOPAY_KEY2=
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn
ZALOPAY_CALLBACK_URL=
```

To get Firebase credentials:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Copy the values to your `.env` file

### Installation

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
