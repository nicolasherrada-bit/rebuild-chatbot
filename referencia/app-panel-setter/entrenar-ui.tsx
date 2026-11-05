"use client";
// Piezas para ENTRENAR al bot desde una charla (simulador o real): editar el borrador antes de aprobarlo
// (si lo cambiás, el bot aprende la corrección) y "🧠 Enseñale" (una regla explícita).
import { useState, useTransition } from "react";
import { ensenarRegla } from "./actions";
import { VistaRecurso, ICONO_RECURSO } from "./burbuja";
import type { MensajeVista } from "@/lib/setter/vista";
import type { ItemSalida } from "@/lib/setter/motor";

const f = "font-[family-name:var(--font-montserrat)]";

export function EditorBorrador({ borradores, cargando, onAprobar, onOtra, onDescartar }: {
  borradores: MensajeVista[];
  cargando: boolean;
  onAprobar: (items: ItemSalida[]) => void;
  onOtra?: () => void;
  onDescartar?: () => void;
}) {
  const clave = borradores.map((b) => b.id).join();
  const [vista, setVista] = useState(clave);
  const [items, setItems] = useState(borradores);
  // Llegó un borrador nuevo (otra versión): resincronizamos el editor.
  if (clave !== vista) { setVista(clave); setItems(borradores); }
  const cambiado = items.length !== borradores.length || items.some((m, i) => !m.recurso_id && m.texto.trim() !== borradores[i]?.texto.trim());

  return (
    <div className="border-t border-dashed border-dorado/50 bg-dorado/5 px-4 py-3">
      <p className={`${f} text-[10px] uppercase tracking-wider text-dorado mb-2`}>✏️ El bot propone — editá lo que quieras (si lo cambiás, aprende)</p>
      <div className="flex flex-col gap-2">
        {items.map((m, i) => m.recurso ? (
          <div key={m.id} className={`${f} flex items-center gap-3 rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-crema`}>
            <span className="shrink-0">{ICONO_RECURSO[m.recurso.tipo] ?? "📎"} {m.recurso.titulo}</span>
            <div className="min-w-0 flex-1"><VistaRecurso r={m.recurso} chico /></div>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="shrink-0 text-azul hover:text-red-400">Quitar</button>
          </div>
        ) : (
          <textarea key={m.id} value={m.texto} rows={Math.min(4, Math.max(1, Math.ceil(m.texto.length / 60)))}
            onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
            className={`${f} rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema focus:border-dorado outline-none`} />
        ))}
      </div>
      <div className={`${f} mt-2 flex flex-wrap items-center gap-2 text-xs`}>
        <button disabled={cargando} onClick={() => onAprobar(items.map((m) => (m.recurso_id ? { recursoId: m.recurso_id } : { texto: m.texto })))}
          className="rounded-md bg-dorado px-3 py-1.5 font-semibold text-navy-900 disabled:opacity-40">
          ✓ {cambiado ? "Mandar corregido" : "Aprobar y mandar"}
        </button>
        {onOtra && <button disabled={cargando} onClick={onOtra} className="rounded-md border border-navy-700 px-3 py-1.5 text-crema hover:border-dorado disabled:opacity-40">↻ Otra versión</button>}
        {onDescartar && <button disabled={cargando} onClick={onDescartar} className="rounded-md px-3 py-1.5 text-azul hover:text-red-400 disabled:opacity-40">Descartar</button>}
        {cambiado && <span className="text-[11px] text-dorado">🧠 Se guarda como corrección</span>}
      </div>
    </div>
  );
}

export function Ensenale({ leadId }: { leadId: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [cargando, start] = useTransition();
  if (!abierto) {
    return (
      <button onClick={() => { setAbierto(true); setMsg(null); }} className={`${f} text-[11px] text-dorado hover:underline`}>
        🧠 Enseñale algo{msg ? <span className="ml-2 text-green-400">{msg}</span> : null}
      </button>
    );
  }
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await ensenarRegla(texto, leadId);
        if (r.error) setMsg(r.error); else { setTexto(""); setAbierto(false); setMsg("✓ Aprendido"); }
      });
    }} className={`${f} flex flex-col gap-1.5`}>
      <p className="text-[11px] text-azul-claro">Una regla que el bot va a seguir en TODAS las charlas. Ej: “no preguntes la edad tan rápido”, “si dice que es de Córdoba, decile que entrenás ahí”.</p>
      <div className="flex gap-2">
        <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Qué tiene que aprender…"
          className="flex-1 rounded-md border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs text-crema placeholder:text-azul focus:border-dorado outline-none" />
        <button disabled={cargando || !texto.trim()} className="rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-navy-900 disabled:opacity-40">Guardar</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-azul hover:text-crema">✕</button>
      </div>
      {msg && <p className="text-[11px] text-red-400">{msg}</p>}
    </form>
  );
}
