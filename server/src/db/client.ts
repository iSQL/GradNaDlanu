import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../env.js';
import * as schema from './schema.js';

const queryClient = postgres(env.databaseUrl);
export const db = drizzle(queryClient, { schema });
export const sql = queryClient;
