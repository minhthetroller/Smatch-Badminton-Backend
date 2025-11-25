# Arc Badminton Backend API Documentation

Base URL: `http://localhost:3000`

## Overview

This API provides endpoints for managing badminton court information and serving vector map tiles.

---

## Health Check

### GET /health

Check if the server is running.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T12:00:00.000Z"
}
```

---

## Courts API

Base path: `/api/courts`

### List All Courts

```http
GET /api/courts
```

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page |
| `district` | string | - | Filter by district name |

**Example Request**
```bash
curl "http://localhost:3000/api/courts?page=1&limit=10&district=Quận Ba Đình"
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Sân cầu lông Ngọc Khánh",
      "description": "Sân cầu lông chất lượng cao",
      "phoneNumbers": ["0901234567"],
      "addressStreet": "Số 6 Nguyễn Công Hoan",
      "addressWard": "Phường Ngọc Khánh",
      "addressDistrict": "Quận Ba Đình",
      "addressCity": "Hà Nội",
      "details": {
        "amenities": ["Parking", "Shower"],
        "payments": ["Cash", "MoMo"]
      },
      "openingHours": {
        "mon": "06:00-22:00",
        "tue": "06:00-22:00"
      },
      "createdAt": "2025-11-25T12:00:00.000Z",
      "updatedAt": "2025-11-25T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### Get Court by ID

```http
GET /api/courts/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Court ID |

**Example Request**
```bash
curl "http://localhost:3000/api/courts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Sân cầu lông Ngọc Khánh",
    ...
  }
}
```

**Error Response (404)**
```json
{
  "success": false,
  "error": {
    "message": "Court not found"
  }
}
```

---

### Create Court

```http
POST /api/courts
```

**Request Body**
```json
{
  "name": "Sân cầu lông ABC",
  "description": "Mô tả sân",
  "phoneNumbers": ["0901234567", "0912345678"],
  "addressStreet": "123 Đường ABC",
  "addressWard": "Phường XYZ",
  "addressDistrict": "Quận Hoàn Kiếm",
  "addressCity": "Hà Nội",
  "details": {
    "amenities": ["Parking", "Shower", "WiFi"],
    "payments": ["Cash", "Card", "MoMo"],
    "serviceOptions": ["Racket Rental", "Coaching"],
    "highlights": ["Air Conditioned"]
  },
  "openingHours": {
    "mon": "06:00-22:00",
    "tue": "06:00-22:00",
    "wed": "06:00-22:00",
    "thu": "06:00-22:00",
    "fri": "06:00-22:00",
    "sat": "07:00-21:00",
    "sun": "07:00-21:00"
  },
  "location": {
    "latitude": 21.0285,
    "longitude": 105.8542
  }
}
```

**Required Fields**
- `name` (string): Court name

**Optional Fields**
- `description` (string): About/Overview
- `phoneNumbers` (string[]): Contact numbers
- `addressStreet`, `addressWard`, `addressDistrict`, `addressCity` (string): Address
- `details` (object): Amenities, payments, etc.
- `openingHours` (object): Operating hours by day
- `location` (object): GPS coordinates { latitude, longitude }

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "newly-generated-uuid",
    ...
  }
}
```

---

### Update Court

```http
PUT /api/courts/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Court ID |

**Request Body**

Same as Create Court, all fields optional.

**Example Request**
```bash
curl -X PUT "http://localhost:3000/api/courts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Court Name"}'
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Updated Court Name",
    ...
  }
}
```

---

### Delete Court

```http
DELETE /api/courts/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Court ID |

**Response**
```json
{
  "success": true,
  "data": {
    "message": "Court deleted successfully"
  }
}
```

---

### Find Nearby Courts

```http
GET /api/courts/nearby
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `latitude` | float | Yes | GPS latitude |
| `longitude` | float | Yes | GPS longitude |
| `radius` | float | No | Search radius in km (default: 5) |

**Example Request**
```bash
curl "http://localhost:3000/api/courts/nearby?latitude=21.0285&longitude=105.8542&radius=3"
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Nearby Court",
      "distance": 1234.56,
      ...
    }
  ]
}
```

---

## Map Tiles API

Base path: `/api/map-tiles`

This endpoint serves vector tiles (MVT format) for rendering courts on a map.

### Get Vector Tile

```http
GET /api/map-tiles/:z/:x/:y.pbf
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `z` | integer | Zoom level (0-22) |
| `x` | integer | Tile X coordinate |
| `y` | integer | Tile Y coordinate |

**Example Request**
```bash
curl "http://localhost:3000/api/map-tiles/14/13112/7491.pbf" -o tile.pbf
```

**Response**
- Content-Type: `application/vnd.mapbox-vector-tile`
- Binary MVT data

### Usage with MapLibre GL JS

```javascript
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      courts: {
        type: 'vector',
        tiles: ['http://localhost:3000/api/map-tiles/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 22
      }
    },
    layers: [
      {
        id: 'courts-layer',
        type: 'circle',
        source: 'courts',
        'source-layer': 'courts',
        paint: {
          'circle-radius': 8,
          'circle-color': '#FF5722',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF'
        }
      }
    ]
  }
});

// Add popup on click
map.on('click', 'courts-layer', (e) => {
  const court = e.features[0].properties;
  new maplibregl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`<h3>${court.name}</h3><p>${court.address_district}</p>`)
    .addTo(map);
});
```

### Usage with Leaflet

```javascript
const map = L.map('map').setView([21.0285, 105.8542], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const vectorTileOptions = {
  vectorTileLayerStyles: {
    courts: {
      weight: 2,
      color: '#FF5722',
      radius: 8,
      fill: true,
      fillColor: '#FF5722',
      fillOpacity: 0.8
    }
  }
};

L.vectorGrid.protobuf(
  'http://localhost:3000/api/map-tiles/{z}/{x}/{y}.pbf',
  vectorTileOptions
).addTo(map);
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |
| 502 | Tile Server Unavailable |

---

## Setup & Running

### Prerequisites
- Node.js 22+
- Docker & Docker Compose

### Quick Start

```bash
# 1. Start PostgreSQL and pg_tileserv
npm run docker:up

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. (Optional) Seed database
npm run db:seed

# 6. Start development server
npm run dev
```

### Environment Variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/arc_badminton
TILE_SERVER_URL=http://localhost:7800
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database with PostGIS |
| pg_tileserv | 7800 | Vector tile server |

---

## Data Models

### Court

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Court name |
| description | string | About/Overview |
| phoneNumbers | string[] | Contact numbers |
| addressStreet | string | Street address |
| addressWard | string | Ward/Phường |
| addressDistrict | string | District/Quận |
| addressCity | string | City (default: Hà Nội) |
| details | JSON | Amenities, payments, etc. |
| openingHours | JSON | Operating hours |
| location | geography | GPS coordinates |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

