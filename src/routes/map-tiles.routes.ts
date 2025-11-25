import { Router, type Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/index.js';

const router = Router();

const tileServerUrl = config.tileServerUrl;

/**
 * Map Tiles Proxy Route
 * 
 * Forwards requests to pg_tileserv for vector tile generation.
 * 
 * Request:  GET /api/map-tiles/:z/:x/:y.pbf
 * Proxied:  GET http://localhost:7800/public.courts_tile/:z/:x/:y.pbf
 * 
 * The tiles are generated using the courts_tile SQL function which:
 * 1. Accepts tile coordinates (z, x, y)
 * 2. Transforms coordinates from WGS84 to Web Mercator
 * 3. Returns MVT (Mapbox Vector Tile) format
 */
const tileProxy = createProxyMiddleware({
  target: tileServerUrl,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Path coming in is like: /14/13112/7491.pbf (Express already stripped /api/map-tiles)
    // We need to prepend /public.courts_tile
    const newPath = `/public.courts_tile${path}`;
    console.log(`[Tile Proxy] Rewriting: ${path} -> ${newPath}`);
    return newPath;
  },
  on: {
    proxyReq: (proxyReq, req) => {
      const expressReq = req as Request;
      console.log(`[Tile Proxy] ${req.method} ${expressReq.originalUrl} -> ${tileServerUrl}${proxyReq.path}`);
    },
    proxyRes: (proxyRes, req) => {
      const expressReq = req as Request;
      console.log(`[Tile Proxy] Response: ${proxyRes.statusCode} for ${expressReq.originalUrl}`);
    },
    error: (err, req, res) => {
      console.error('[Tile Proxy] Error:', err.message);
      if (res && 'status' in res && typeof res.status === 'function') {
        res.status(502).json({
          success: false,
          error: { message: 'Tile server unavailable' },
        });
      }
    },
  },
});

// Route: GET /:z/:x/:y.pbf
router.use('/', tileProxy);

export { router as mapTilesRoutes };
