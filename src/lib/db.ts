import { Pool } from "pg";
// SOLO LECTURA sobre la app (schema public). Para guardar lo propio, usar el schema de este proyecto.
const g = globalThis as unknown as { __appPool?: Pool };
export const pool = g.__appPool ?? new Pool({ connectionString: process.env.APP_DB_URL, max: 3 });
if (!g.__appPool) g.__appPool = pool;
export async function q<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const r = await pool.query(text, params as never);
  return r.rows as T[];
}
