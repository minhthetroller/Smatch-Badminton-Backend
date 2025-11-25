/**
 * Map Tiles Route Tests
 * 
 * Run manually with: npx tsx src/tests/map-tiles.test.ts
 * 
 * Prerequisites:
 * - Docker services running (npm run docker:up)
 * - Server running (npm run dev)
 */

const API_BASE = 'http://localhost:3000';
const TILE_SERVER = 'http://localhost:7800';

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

  // Test 4: Proxy route returns MVT
  results.push(await testProxyRoute());

  // Test 5: Proxy route returns correct content type
  results.push(await testProxyContentType());

  // Test 6: Invalid tile coordinates return appropriate response
  results.push(await testInvalidTileCoords());

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
    // Tile coordinates for Hanoi area at zoom 14
    const response = await fetch(`${TILE_SERVER}/public.courts_tile/14/13112/7491.pbf`);

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
    const response = await fetch(`${API_BASE}/api/map-tiles/14/13112/7491.pbf`);

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
    const response = await fetch(`${API_BASE}/api/map-tiles/14/13112/7491.pbf`);
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/vnd.mapbox-vector-tile')) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Content-Type: ${contentType}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

async function testInvalidTileCoords(): Promise<TestResult> {
  const name = 'Invalid tile coordinates handled gracefully';
  try {
    // Request tile at invalid coordinates (zoom 0 should only have 1 tile: 0/0/0)
    const response = await fetch(`${API_BASE}/api/map-tiles/0/999/999.pbf`);

    // pg_tileserv returns 200 with empty tile for out-of-bounds requests
    // or 400 for truly invalid params
    if (response.status === 200 || response.status === 400) {
      return { name, passed: true, message: '' };
    }
    return { name, passed: false, message: `Unexpected status: ${response.status}` };
  } catch (error) {
    return { name, passed: false, message: `Error: ${error}` };
  }
}

// Run tests
runTests().catch(console.error);

