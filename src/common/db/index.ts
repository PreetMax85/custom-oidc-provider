import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: 5,
  idle_timeout: 10,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
console.log(`[DB] Client initialized (${process.env.NODE_ENV})`);