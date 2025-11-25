import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DATABASE_URL || '',
  },
  tileServerUrl: process.env.TILE_SERVER_URL || 'http://localhost:7800',
} as const;
