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
- **Infrastructure**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

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
