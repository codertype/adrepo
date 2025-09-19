import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect if we're using Neon or native PostgreSQL based on the connection string
const isNeonConnection = process.env.DATABASE_URL.includes('neon.tech') || 
                          process.env.DATABASE_URL.includes('neon.database.url');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isNeonConnection) {
  // Use Neon serverless for development/Neon hosting
  console.log('🔗 Using Neon serverless connection');
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool as NeonPool, schema });
} else {
  // Use native PostgreSQL for VPS/production deployment
  console.log('🔗 Using native PostgreSQL connection');
  pool = new PgPool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  db = pgDrizzle({ client: pool as PgPool, schema });
}

export { pool, db };

// Export a connection string for connect-pg-simple that works with native pg
export const getSessionConnectionString = (): string => {
  return process.env.DATABASE_URL!;
};