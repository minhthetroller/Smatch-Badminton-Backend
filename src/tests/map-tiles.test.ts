/**
 * Map Tiles Route Tests
 * 
 * Run manually with: npx tsx src/tests/map-tiles.test.ts
 * 
 * Prerequisites:
 * - Docker services running (npm run docker:up)
 * - Server running (npm run dev)
 * - Database seeded (npm run db:seed)
 */

const API_BASE = 'http://localhost:3000';
const TILE_SERVER = 'http://localhost:7800';

// Correct tile coordinates for Hanoi area (21.0303°N, 105.8138°E) at zoom 14
const HANOI_TILE = { z: 14, x: 13007, y: 7212 };

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];

  console.log('🧪 Running Map Tiles Route Tests\n');
  console.log('='.repeat(50));

  // Test 1: pg_tileserv is accessible
  results.push(await testTileServerHealth());

  // Test 2: Tile function exists in pg_tileserv
  results.push(await testTileFunctionExists());

  // Test 3: Direct tile request to pg_tileserv
  results.push(await testDirectTileRequest());

  // Test 4: Proxy route returns 200
  results.push(await testProxyRoute());

  // Test 5: Proxy route returns correct content type
  results.push(await testProxyContentType());

  // Test 6: Tile contains data (non-zero content length)
  results.push(await testTileHasContent());

  // Test 7: Empty tile for area without courts
  results.push(await testEmptyTileArea());

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (!r.passed) {
      console.log(`   └─ ${r.message}`);
    }
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function testTileServerHealth(): Promise<TestResult> {
  const name = 'pg_tileserv is accessible';
  try {
    const response = await fetch(`${TILE_SERVER}/index.json`);
    if (response.ok) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Status: ${response.status}` };
  } catch (error) {
    return { name, passed: false, message: `Connection failed: ${error}` };
  }
}

async function testTileFunctionExists(): Promise<TestResult> {
  const name = 'courts_tile function discovered by pg_tileserv';
  try {
    const response = await fetch(`${TILE_SERVER}/index.json`);
    const data = await response.json();

    if (data['public.courts_tile']) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: 'Function not found in tile server index' };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testDirectTileRequest(): Promise<TestResult> {
  const name = 'Direct tile request to pg_tileserv returns 200';
  try {
    const { z, x, y } = HANOI_TILE;
    const response = await fetch(`${TILE_SERVER}/public.courts_tile/${z}/${x}/${y}.pbf`);

    if (response.ok) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Status: ${response.status}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testProxyRoute(): Promise<TestResult> {
  const name = 'Proxy route /api/map-tiles returns 200';
  try {
    const { z, x, y } = HANOI_TILE;
    const response = await fetch(`${API_BASE}/api/map-tiles/${z}/${x}/${y}.pbf`);

    if (response.ok) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Status: ${response.status}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testProxyContentType(): Promise<TestResult> {
  const name = 'Proxy returns correct MVT content type';
  try {
    const { z, x, y } = HANOI_TILE;
    const response = await fetch(`${API_BASE}/api/map-tiles/${z}/${x}/${y}.pbf`);
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/vnd.mapbox-vector-tile')) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Content-Type: ${contentType}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testTileHasContent(): Promise<TestResult> {
  const name = 'Tile for Hanoi area contains court data';
  try {
    const { z, x, y } = HANOI_TILE;
    const response = await fetch(`${API_BASE}/api/map-tiles/${z}/${x}/${y}.pbf`);
    const contentLength = response.headers.get('content-length');
    const length = contentLength ? parseInt(contentLength, 10) : 0;

    if (length > 0) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Content-Length: ${length} (expected > 0). Did you run db:seed?` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testEmptyTileArea(): Promise<TestResult> {
  const name = 'Empty tile returned for area without courts';
  try {
    // Tile coordinates for area far from Hanoi (middle of Pacific Ocean)
    const response = await fetch(`${API_BASE}/api/map-tiles/14/1000/8000.pbf`);
    const contentLength = response.headers.get('content-length');
    const length = contentLength ? parseInt(contentLength, 10) : 0;

    // Should return 200 with empty tile (MVT header only ~25 bytes or less)
    if (response.ok && length < 50) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Expected empty/small tile, got Content-Length: ${length}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

// Run tests
runTests().catch(console.error);
