# Smatch Badminton Backend API Documentation

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

## Availability API

Base path: `/api/courts/:courtId/availability`

### Get Court Availability

```http
GET /api/courts/:courtId/availability?date=YYYY-MM-DD
```

Get availability for all sub-courts of a court on a specific date. Returns time slots with availability status and pricing.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `courtId` | UUID | Court ID |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | Date in YYYY-MM-DD format |

**Example Request**
```bash
curl "http://localhost:3000/api/courts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/availability?date=2025-12-01"
```

**Response**
```json
{
  "success": true,
  "data": {
    "courtId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "courtName": "Sân cầu lông Ngọc Khánh",
    "date": "2025-12-01",
    "dayType": "weekday",
    "openingTime": "06:00",
    "closingTime": "22:00",
    "subCourts": [
      {
        "id": "sub-court-uuid-1",
        "name": "Sân 1",
        "description": "Sân cầu lông số 1",
        "isActive": true,
        "slots": [
          {
            "startTime": "06:00",
            "endTime": "06:30",
            "isAvailable": true,
            "price": 35000
          },
          {
            "startTime": "06:30",
            "endTime": "07:00",
            "isAvailable": true,
            "price": 35000
          },
          {
            "startTime": "10:00",
            "endTime": "10:30",
            "isAvailable": false,
            "price": 35000
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- `dayType` can be `weekday`, `weekend`, or `holiday`
- `price` is the final calculated price for a 30-minute slot:
  - Base price = hourly rate from PricingRule / 2
  - If the date is a holiday, price = base price × holiday multiplier
- `isAvailable: false` means the slot is either booked or closed for maintenance

---

## Bookings API

Base path: `/api/bookings`

### Create Booking

```http
POST /api/bookings
```

Create a new court booking. Minimum duration is 1 hour, in 30-minute increments.

**Request Body**
```json
{
  "subCourtId": "sub-court-uuid",
  "guestName": "Nguyễn Văn A",
  "guestPhone": "0901234567",
  "guestEmail": "email@example.com",
  "date": "2025-12-01",
  "startTime": "10:00",
  "endTime": "12:00",
  "notes": "Optional notes"
}
```

**Required Fields**
- `subCourtId` (UUID): Sub-court to book
- `guestName` (string): Guest's name
- `guestPhone` (string): Guest's phone number
- `date` (string): Date in YYYY-MM-DD format
- `startTime` (string): Start time in HH:mm format
- `endTime` (string): End time in HH:mm format

**Optional Fields**
- `guestEmail` (string): Guest's email
- `notes` (string): Additional notes

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "subCourtId": "sub-court-uuid",
    "subCourtName": "Sân 1",
    "courtId": "court-uuid",
    "courtName": "Sân cầu lông Ngọc Khánh",
    "guestName": "Nguyễn Văn A",
    "guestPhone": "0901234567",
    "guestEmail": "email@example.com",
    "date": "2025-12-01",
    "startTime": "10:00",
    "endTime": "12:00",
    "totalPrice": 140000,
    "status": "pending",
    "notes": "Optional notes",
    "createdAt": "2025-12-01T08:00:00.000Z"
  }
}
```

**Error Responses**
- `400 Bad Request`: Invalid date/time format, duration less than 1 hour, or not in 30-minute increments
- `404 Not Found`: Sub-court not found
- `409 Conflict`: Time slot is already booked

---

### Get Booking by ID

```http
GET /api/bookings/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Booking ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "subCourtId": "sub-court-uuid",
    "subCourtName": "Sân 1",
    "courtId": "court-uuid",
    "courtName": "Sân cầu lông Ngọc Khánh",
    "guestName": "Nguyễn Văn A",
    "guestPhone": "0901234567",
    "guestEmail": "email@example.com",
    "date": "2025-12-01",
    "startTime": "10:00",
    "endTime": "12:00",
    "totalPrice": 140000,
    "status": "confirmed",
    "notes": null,
    "createdAt": "2025-12-01T08:00:00.000Z"
  }
}
```

---

### Get Bookings by Phone

```http
GET /api/bookings?phone=0901234567
```

Get all bookings for a phone number.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Yes | Phone number |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "booking-uuid",
      "subCourtName": "Sân 1",
      "courtName": "Sân cầu lông Ngọc Khánh",
      "date": "2025-12-01",
      "startTime": "10:00",
      "endTime": "12:00",
      "totalPrice": 140000,
      "status": "confirmed"
    }
  ]
}
```

---

### Cancel Booking

```http
DELETE /api/bookings/:id
```

Cancel an existing booking.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Booking ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "status": "cancelled",
    ...
  }
}
```

**Error Responses**
- `400 Bad Request`: Booking already cancelled or completed
- `404 Not Found`: Booking not found

---

### Get Payment for Booking

```http
GET /api/bookings/:bookingId/payment
```

Get payment information for a specific booking.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `bookingId` | UUID | Booking ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    "bookingId": "booking-uuid",
    "appTransId": "251202_abc12345001",
    "zpTransId": "240520000001234",
    "amount": 140000,
    "status": "success",
    "orderUrl": "https://sb-openapi.zalopay.vn/v2/...",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:05:00.000Z"
  }
}
```

---

## Payments API (ZaloPay Integration)

Base path: `/api/payments`

The payment system uses ZaloPay's dynamic QR code payment method. When a payment is initiated, the time slot is locked in Redis for 10 minutes to prevent double-booking. **Real-time payment notifications** are delivered via WebSocket.

### Payment Flow (Flutter Mobile App)

1. User creates a booking → booking status = `pending`
2. Flutter app calls `POST /api/payments/create` with `bookingId`
3. Backend:
   - Acquires Redis lock for the time slot (10 min TTL)
   - Creates payment atomically in a database transaction
   - Calls ZaloPay API to create an order
   - Generates QR code image (base64)
   - Returns QR code + WebSocket URL
4. Flutter app:
   - Displays QR code image using `Image.memory(base64Decode(rawBase64))`
   - Connects to WebSocket and subscribes to payment updates
5. User scans QR code and pays via ZaloPay app
6. ZaloPay calls our callback endpoint
7. Backend updates payment status, confirms booking, and **notifies via WebSocket**
8. Flutter app receives real-time notification and navigates to success screen

### Create Payment

```http
POST /api/payments/create
```

Create a ZaloPay payment order for a booking. Returns QR code image and WebSocket URL for Flutter app.

**Request Body**
```json
{
  "bookingId": "booking-uuid"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment-uuid",
      "bookingId": "booking-uuid",
      "appTransId": "251202_abc12345001",
      "zpTransId": null,
      "amount": 140000,
      "status": "pending",
      "orderUrl": "https://sb-openapi.zalopay.vn/v2/...",
      "createdAt": "2025-12-02T10:00:00.000Z",
      "updatedAt": "2025-12-02T10:00:00.000Z"
    },
    "orderUrl": "https://sb-openapi.zalopay.vn/v2/...",
    "qrCode": {
      "base64": "data:image/png;base64,iVBORw0KGgo...",
      "rawBase64": "iVBORw0KGgo..."
    },
    "zpTransToken": "token_for_zalopay_sdk",
    "expireAt": "2025-12-02T10:10:00.000Z",
    "wsSubscribeUrl": "ws://localhost:3000/ws/payments"
  }
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `qrCode.base64` | Full data URL for HTML `<img src="">` |
| `qrCode.rawBase64` | Raw base64 for Flutter `Image.memory()` |
| `zpTransToken` | Token for ZaloPay SDK (optional alternative to QR) |
| `expireAt` | When slot lock expires (10 min) |
| `wsSubscribeUrl` | WebSocket URL for real-time notifications |

**Flutter Usage:**
```dart
import 'dart:convert';
import 'package:flutter/material.dart';

// Display QR code
Image.memory(base64Decode(response.data.qrCode.rawBase64))
```

**Error Responses**
- `400 Bad Request`: Invalid booking status or payment service not configured
- `404 Not Found`: Booking not found
- `409 Conflict`: Time slot is currently being reserved by another user

---

### WebSocket: Real-time Payment Notifications

Connect to WebSocket for real-time payment status updates.

**WebSocket URL:** `ws://localhost:3000/ws/payments` (or `wss://` for production)

**Connection Flow:**
```
1. Connect to WebSocket
2. Send: {"action": "subscribe", "paymentId": "payment-uuid"}
3. Receive: {"type": "subscribed", "paymentId": "...", "message": "..."}
4. Wait for payment notification...
5. Receive: {"type": "payment_status", "status": "success", ...}
```

**Subscribe to Payment**
```json
{
  "action": "subscribe",
  "paymentId": "payment-uuid"
}
```

**Payment Success Notification**
```json
{
  "type": "payment_status",
  "paymentId": "payment-uuid",
  "status": "success",
  "bookingId": "booking-uuid",
  "zpTransId": "240520000001234",
  "message": "Payment successful! Your booking has been confirmed."
}
```

**Payment Failed Notification**
```json
{
  "type": "payment_status",
  "paymentId": "payment-uuid",
  "status": "failed",
  "bookingId": "booking-uuid",
  "message": "Payment failed. Please try again."
}
```

**Flutter WebSocket Example:**
```dart
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

final channel = WebSocketChannel.connect(
  Uri.parse('ws://your-server.com/ws/payments'),
);

// Subscribe to payment
channel.sink.add(jsonEncode({
  'action': 'subscribe',
  'paymentId': paymentId,
}));

// Listen for notifications
channel.stream.listen((message) {
  final data = jsonDecode(message);
  if (data['type'] == 'payment_status') {
    if (data['status'] == 'success') {
      // Navigate to success screen
      Navigator.pushNamed(context, '/booking-success');
    } else if (data['status'] == 'failed') {
      // Show error dialog
      showErrorDialog(data['message']);
    }
  }
});
```

**WebSocket Messages:**
| Action | Description |
|--------|-------------|
| `subscribe` | Subscribe to payment updates |
| `unsubscribe` | Unsubscribe from payment |
| `ping` | Keep-alive (responds with `pong`) |

---

### ZaloPay Callback (Webhook)

```http
POST /api/payments/callback
```

Webhook endpoint called by ZaloPay after payment completion. **Do not call this endpoint directly.**

**Request Body** (from ZaloPay)
```json
{
  "data": "{\"app_id\":123,\"app_trans_id\":\"251202_abc12345001\",...}",
  "mac": "hmac_signature",
  "type": 1
}
```

**Response** (to ZaloPay)
```json
{
  "return_code": 1,
  "return_message": "Success"
}
```

**Notes:**
- `type: 1` = payment success
- On successful payment, the booking status is automatically updated to `confirmed`
- The Redis slot lock is released after callback processing

---

### Get Payment by ID

```http
GET /api/payments/:id
```

Get payment details with associated booking information.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Payment ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    "bookingId": "booking-uuid",
    "appTransId": "251202_abc12345001",
    "zpTransId": "240520000001234",
    "amount": 140000,
    "status": "success",
    "orderUrl": "https://sb-openapi.zalopay.vn/v2/...",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:05:00.000Z",
    "booking": {
      "id": "booking-uuid",
      "subCourtId": "sub-court-uuid",
      "guestName": "Nguyễn Văn A",
      "guestPhone": "0901234567",
      "date": "2025-12-02",
      "startTime": "10:00",
      "endTime": "12:00",
      "totalPrice": 140000,
      "status": "confirmed"
    }
  }
}
```

---

### Query Payment Status

```http
GET /api/payments/:id/status
```

Query the latest payment status from ZaloPay and sync with local database. Useful for polling payment status.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Payment ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    "bookingId": "booking-uuid",
    "appTransId": "251202_abc12345001",
    "zpTransId": "240520000001234",
    "amount": 140000,
    "status": "success",
    "orderUrl": "https://sb-openapi.zalopay.vn/v2/...",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:05:00.000Z"
  }
}
```

**Payment Status Values**
| Status | Description |
|--------|-------------|
| `pending` | Payment created, waiting for user to pay |
| `success` | Payment completed successfully |
| `failed` | Payment failed |
| `expired` | Payment expired (user didn't pay within time limit) |

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
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/arc_badminton

# Tile Server
TILE_SERVER_URL=http://localhost:7800

# Redis (for slot locking)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ZaloPay Configuration
ZALOPAY_APP_ID=your_app_id
ZALOPAY_KEY1=your_key1
ZALOPAY_KEY2=your_key2
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn  # Sandbox
# ZALOPAY_ENDPOINT=https://openapi.zalopay.vn   # Production
ZALOPAY_CALLBACK_URL=https://your-domain.com/api/payments/callback

# Payment Settings
SLOT_LOCK_TTL_SECONDS=600  # 10 minutes
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database with PostGIS |
| pg_tileserv | 7800 | Vector tile server |
| Redis | 6379 | Cache for slot locking |

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
| openingHours | JSON | Operating hours per day |
| location | geography | GPS coordinates |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

### SubCourt

Individual playable courts within a venue.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| courtId | UUID | Parent court reference |
| name | string | Sub-court name (e.g., "Sân 1") |
| description | string | Optional description |
| isActive | boolean | Whether the sub-court is active |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

### Booking

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| subCourtId | UUID | Sub-court reference |
| userId | UUID | User reference (optional, for future) |
| guestName | string | Guest's name |
| guestPhone | string | Guest's phone (required) |
| guestEmail | string | Guest's email (optional) |
| date | date | Booking date |
| startTime | time | Start time |
| endTime | time | End time |
| totalPrice | integer | Total price in VND |
| status | enum | pending, confirmed, cancelled, completed |
| notes | string | Optional notes |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

### PricingRule

Tiered pricing rules per court.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| courtId | UUID | Court reference |
| name | string | Rule name (e.g., "Weekday Morning") |
| dayType | enum | weekday, weekend, holiday |
| startTime | time | Rule start time |
| endTime | time | Rule end time |
| pricePerHour | integer | Price per hour in VND |
| isActive | boolean | Whether the rule is active |

**Pricing Calculation:**
1. Find the matching `PricingRule` based on `dayType` and time window (`startTime` to `endTime`)
2. Calculate base price: `pricePerHour / 2` (for 30-minute slot)
3. If the date is a holiday, apply multiplier: `finalPrice = basePrice × holiday.multiplier`
4. Return the rounded final price to the frontend

### SubCourtClosure

Track when sub-courts are unavailable.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| subCourtId | UUID | Sub-court reference |
| date | date | Closure date |
| startTime | time | Start time (null = full day) |
| endTime | time | End time (null = full day) |
| reason | string | Closure reason |

### Holiday

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| date | date | Holiday date (unique) |
| name | string | Holiday name |
| multiplier | float | Price multiplier (default: 1.0, e.g., 1.5 = 50% increase) |

### Payment

Track ZaloPay payment transactions.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| bookingId | UUID | Booking reference |
| appTransId | string | ZaloPay transaction ID (format: yymmdd_xxx) |
| zpTransId | string | ZaloPay's internal transaction ID (from callback) |
| zpTransToken | string | Token for ZaloPay mobile SDK |
| amount | integer | Amount in VND |
| status | enum | pending, success, failed, expired |
| orderUrl | string | ZaloPay order URL for QR code |
| callbackData | JSON | Raw callback data for debugging |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

