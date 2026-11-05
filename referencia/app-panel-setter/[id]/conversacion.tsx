"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobar, descartarBorrador, regenerar, escribirComoNico, cambiarModo, cambiarEtapa, resolverHumano, borrarLead } from "../actions";
import { Burbuja } from "../burbuja";
import { EditorBorrador, Ensenale } from "../entrenar-ui";
import { ETAPA_LABEL } from "../ui";
import type { MensajeVista } from "@/lib/setter/vista";

type Msg = MensajeVista;
const f = "font-[family-name:var(--font-montserrat)]";

export default function Conversacion({ leadId, mensajes, modo, modoEfectivo, etapa }: {
  leadId: string; mensajes: Msg[]; modo: string; modoEfectivo: string; etapa: string;
}) {
  const router = useRouter();
  const enviados = mensajes.filter((m) => m.estado !== "borrador");
  const borradores = mensajes.filter((m) => m.estado === "borrador");
  const [propio, setPropio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, start] = useTransition();

  const correr = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r && r.error) setError(r.error);
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col rounded-lg border border-navy-700 bg-navy-800">
      {/* Controles */}
      <div className={`${f} flex flex-wrap items-center gap-2 border-b border-navy-700 px-4 py-2.5 text-xs`}>
        <label className="text-azul-claro">Modo</label>
        <select value={modo} onChange={(e) => correr(() => cambiarModo(leadId, e.target.value))}
          className="rounded border border-navy-700 bg-navy-900 px-2 py-1 text-crema">
          <option value="">Global ({modoEfectivo === "auto" ? "auto" : "copiloto"})</option>
          <option value="copiloto">Copiloto (apruebo yo)</option>
          <option value="auto">Automático</option>
          <option value="humano">Lo llevo yo (bot callado)</option>
        </select>
        <label className="text-azul-claro ml-2">Etapa</label>
        <select value={etapa} onChange={(e) => correr(() => cambiarEtapa(leadId, e.target.value))}
          className="rounded border border-navy-700 bg-navy-900 px-2 py-1 text-crema">
          {Object.entries(ETAPA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => { if (confirm("¿Borrar esta conversación del setter?")) start(async () => { await borrarLead(leadId); router.push("/panel/setter"); }); }}
          className="ml-auto text-azul hover:text-red-400">Borrar</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 max-h-[55vh]">
        {enviados.map((m) => <Burbuja key={m.id} autor={m.autor} texto={m.texto} recurso={m.recurso} />)}
        {enviados.length === 0 && <p className={`${f} text-xs text-azul-claro`}>Sin mensajes todavía.</p>}
      </div>

      {/* Borrador del bot (copiloto): si lo editás, queda como corrección y el bot aprende */}
      {borradores.length > 0 && (
        <EditorBorrador borradores={borradores} cargando={cargando}
          onAprobar={(items) => correr(() => aprobar(leadId, items))}
          onOtra={() => correr(() => regenerar(leadId))}
          onDescartar={() => correr(() => descartarBorrador(leadId))} />
      )}

      {borradores.length === 0 && modoEfectivo !== "humano" && enviados.at(-1)?.autor === "lead" && (
        <div className={`${f} border-t border-navy-700 px-4 py-2 text-xs`}>
          <button disabled={cargando} onClick={() => correr(() => regenerar(leadId))} className="text-dorado hover:underline disabled:opacity-40">
            🤖 Que el bot proponga una respuesta
          </button>
        </div>
      )}

      {error && <p className={`${f} px-4 pb-2 text-xs text-red-400`}>⚠️ {error}</p>}
      {cargando && <p className={`${f} px-4 pb-2 text-[11px] italic text-azul`}>Procesando…</p>}

      {/* Escribir yo */}
      <form onSubmit={(e) => { e.preventDefault(); const t = propio; setPropio(""); correr(() => escribirComoNico(leadId, t)); }}
        className="flex gap-2 border-t border-navy-700 p-3">
        <input value={propio} onChange={(e) => setPropio(e.target.value)} placeholder={borradores.length ? "O escribí vos tu versión (el bot aprende de la diferencia)…" : "Escribir yo (sale como mensaje tuyo)…"}
          className={`${f} flex-1 rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema placeholder:text-azul focus:border-dorado outline-none`} />
        <button disabled={cargando || !propio.trim()} className={`${f} rounded-md border border-dorado px-4 py-2 text-sm text-dorado disabled:opacity-40`}>Mandar</button>
      </form>
      <div className={`${f} flex flex-wrap items-start justify-between gap-3 px-4 pb-3`}>
        <Ensenale leadId={leadId} />
        <button onClick={() => correr(() => resolverHumano(leadId))} className="text-[11px] text-azul hover:text-crema">Marcar como resuelto (sacar ✋)</button>
      </div>
    </section>
  );
}
