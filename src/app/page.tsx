import { q } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Home() {
  let n = 0; let err: string | null = null;
  try { const rows = await q<{ n: number }>("select count(*)::int n from public.clientes"); n = rows[0]?.n ?? 0; }
  catch (e) { err = (e as Error).message; }
  return (
    <main style={{ padding: 40 }}>
      <h1>REBUILD</h1>
      {err ? <p style={{ color: "#f88" }}>Error de conexión: {err}</p>
           : <p>Conectado a la app (solo lectura) ✅ — <b>{n}</b> clientes.</p>}
      <p style={{ opacity: 0.6, fontSize: 14 }}>Leé la app con <code>public.*</code>. Guardá lo de este proyecto en su propio schema.</p>
    </main>
  );
}
