"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ensenarRegla, editarAprendizaje, borrarAprendizaje } from "../actions";

export type Aprendizaje = {
  id: string; tipo: "correccion" | "regla"; contexto: string | null; original: string | null; corregido: string | null;
  regla: string | null; activo: boolean; created_at: string;
};

const f = "font-[family-name:var(--font-montserrat)]";
const input = `${f} w-full rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema placeholder:text-azul focus:border-dorado outline-none`;
const fecha = (s: string) => new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export default function Aprendizajes({ items }: { items: Aprendizaje[] }) {
  const router = useRouter();
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, start] = useTransition();
  const reglas = items.filter((i) => i.tipo === "regla");
  const correcciones = items.filter((i) => i.tipo === "correccion");

  return (
    <div className={`${f} flex flex-col gap-6`}>
      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-dorado">📏 Reglas ({reglas.length})</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => { const r = await ensenarRegla(nueva); if (r.error) setError(r.error); else { setNueva(""); router.refresh(); } });
        }} className="flex gap-2">
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} className={input}
            placeholder="Nueva regla (ej: nunca hables de bajar de peso rápido)" />
          <button disabled={cargando || !nueva.trim()} className="shrink-0 rounded-md bg-dorado px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-40">Agregar</button>
        </form>
        {error && <p className="text-xs text-red-400">⚠️ {error}</p>}
        {reglas.length === 0 && <p className="text-xs text-azul-claro">Todavía no le enseñaste reglas.</p>}
        {reglas.map((r) => <Fila key={r.id} a={r} />)}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-dorado">✏️ Correcciones ({correcciones.length})</h2>
        {correcciones.length === 0 && (
          <p className="text-xs text-azul-claro">Todavía no corregiste ningún borrador. Probalo en el simulador con “Copiloto” prendido: cambiás lo que propone el bot y le das “Mandar corregido”.</p>
        )}
        {correcciones.map((c) => <Fila key={c.id} a={c} />)}
      </section>
    </div>
  );
}

function Fila({ a }: { a: Aprendizaje }) {
  const router = useRouter();
  const [leccion, setLeccion] = useState(a.regla ?? "");
  const [cargando, start] = useTransition();
  const correr = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });
  const cambio = leccion.trim() !== (a.regla ?? "").trim();

  return (
    <div className={`rounded-lg border border-navy-700 bg-navy-800 p-3 ${a.activo ? "" : "opacity-50"}`}>
      {a.tipo === "correccion" && (
        <div className="mb-2 flex flex-col gap-1 text-xs">
          {a.contexto && <p className="text-azul-claro">La persona: <span className="text-crema">«{a.contexto}»</span></p>}
          <p className="text-azul-claro">El bot propuso: <span className="text-crema line-through decoration-red-400/60 whitespace-pre-wrap">{a.original}</span></p>
          <p className="text-azul-claro">Vos mandaste: <span className="text-green-300 whitespace-pre-wrap">{a.corregido}</span></p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input value={leccion} onChange={(e) => setLeccion(e.target.value)} className={`${input} py-1.5 text-xs`}
          placeholder={a.tipo === "correccion" ? "Lección (la IA la anota sola en unos segundos; podés escribirla vos)" : "Regla"} />
        {cambio && (
          <button disabled={cargando} onClick={() => correr(() => editarAprendizaje(a.id, { regla: leccion }))}
            className="shrink-0 rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-navy-900 disabled:opacity-40">Guardar</button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className="text-azul">{fecha(a.created_at)}</span>
        <button disabled={cargando} onClick={() => correr(() => editarAprendizaje(a.id, { activo: !a.activo }))} className="text-azul-claro hover:text-crema">
          {a.activo ? "Pausar" : "Activar"}
        </button>
        <button disabled={cargando} onClick={() => { if (confirm("¿Borrar este aprendizaje?")) correr(() => borrarAprendizaje(a.id)); }}
          className="text-azul hover:text-red-400">Borrar</button>
      </div>
    </div>
  );
}
