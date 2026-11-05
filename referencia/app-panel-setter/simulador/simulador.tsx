"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { simularMensaje, aprobarSim, borrarLead, type EstadoSim } from "../actions";
import { ETAPA_LABEL, ETAPA_STYLE, FICHA_LABEL, colorScore } from "../ui";
import { Burbuja } from "../burbuja";
import { EditorBorrador, Ensenale } from "../entrenar-ui";
import type { ItemSalida } from "@/lib/setter/motor";

const ORIGENES = [
  { v: "inbound", l: "DM directo" },
  { v: "historia", l: "Respondió una historia" },
  { v: "comentario", l: "Comentó un reel/post" },
  { v: "anuncio", l: "Vino de un anuncio" },
];

// Arranques típicos para probar rápido distintos perfiles.
const ATAJOS = [
  "Hola! Vi tu reel del estancamiento, me pasa exactamente eso",
  "Cuánto sale el coaching?",
  "Hola, quiero empezar a entrenar, nunca fui al gym",
  "Sos un bot?",
];

const f = "font-[family-name:var(--font-montserrat)]";

export default function Simulador() {
  const [estado, setEstado] = useState<EstadoSim | null>(null);
  const [texto, setTexto] = useState("");
  const [origen, setOrigen] = useState("inbound");
  const [copiloto, setCopiloto] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, start] = useTransition();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [estado, pendiente]);

  const aplicar = (r: EstadoSim | { error: string }) => {
    if ("leadId" in r) { setEstado(r); if (r.error) setError(r.error); }
    else setError(r.error);
  };

  const mandar = (t: string) => {
    const limpio = t.trim();
    if (!limpio || cargando) return;
    setTexto(""); setError(null); setPendiente(limpio);
    start(async () => {
      const r = await simularMensaje(estado?.leadId ?? null, limpio, origen, copiloto);
      setPendiente(null);
      aplicar(r);
    });
  };

  const aprobar = (items: ItemSalida[]) => {
    if (!estado) return;
    setError(null);
    start(async () => aplicar(await aprobarSim(estado.leadId, items)));
  };

  const reiniciar = () => {
    const id = estado?.leadId;
    setEstado(null); setError(null); setTexto("");
    if (id) start(() => borrarLead(id));
  };

  const msgs = estado?.mensajes ?? [];
  const enviados = msgs.filter((m) => m.estado !== "borrador");
  const borradores = msgs.filter((m) => m.estado === "borrador");
  const lead = estado?.lead;
  const ficha = Object.entries(lead?.ficha ?? {}).filter(([, v]) => v);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      {/* Chat */}
      <section className="flex flex-col rounded-lg border border-navy-700 bg-navy-800 min-h-[520px]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-700 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <select value={origen} onChange={(e) => setOrigen(e.target.value)} disabled={!!estado}
              className={`${f} rounded border border-navy-700 bg-navy-900 px-2 py-1 text-xs text-crema disabled:opacity-60`}>
              {ORIGENES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <label className={`${f} flex items-center gap-1.5 text-xs text-crema`} title="El bot te deja un borrador y vos lo corregís antes de mandarlo: así le enseñás.">
              <input type="checkbox" checked={copiloto} onChange={(e) => setCopiloto(e.target.checked)} />
              Copiloto (practicar correcciones)
            </label>
          </div>
          <button onClick={reiniciar} className={`${f} text-xs text-azul-claro hover:text-crema`}>↺ Nueva charla</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 max-h-[60vh]">
          {msgs.length === 0 && !pendiente && (
            <div className="my-auto flex flex-col items-center gap-2 text-center">
              <p className={`${f} text-xs text-azul-claro mb-1`}>Arrancá con lo que te escribiría un lead, o probá uno de estos:</p>
              {ATAJOS.map((a) => (
                <button key={a} onClick={() => mandar(a)} className={`${f} rounded-full border border-navy-700 px-3 py-1 text-xs text-crema hover:border-dorado`}>{a}</button>
              ))}
            </div>
          )}
          {enviados.map((m) => <Burbuja key={m.id} autor={m.autor} texto={m.texto} recurso={m.recurso} />)}
          {pendiente && <Burbuja autor="lead" texto={pendiente} />}
          {cargando && <p className={`${f} text-[11px] text-azul italic`}>Nico está escribiendo…</p>}
          <div ref={fin} />
        </div>

        {borradores.length > 0 && estado && (
          <EditorBorrador borradores={borradores} cargando={cargando} onAprobar={aprobar} />
        )}

        {error && <p className={`${f} px-4 pb-2 text-xs text-red-400`}>⚠️ {error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); mandar(texto); }} className="flex gap-2 border-t border-navy-700 p-3">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={borradores.length > 0}
            placeholder={borradores.length ? "Primero aprobá o corregí el borrador…" : "Escribí como si fueras el lead…"}
            className={`${f} flex-1 rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema placeholder:text-azul focus:border-dorado outline-none disabled:opacity-50`} />
          <button disabled={cargando || !texto.trim() || borradores.length > 0} className={`${f} rounded-md bg-dorado px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-40`}>Enviar</button>
        </form>
        <div className="px-4 pb-3"><Ensenale leadId={estado?.leadId ?? null} /></div>
      </section>

      {/* Lo que el bot va entendiendo */}
      <aside className={`${f} flex flex-col gap-3`}>
        <div className="rounded-lg border border-navy-700 bg-navy-800 p-4">
          <p className="text-[10px] uppercase tracking-wider text-azul mb-2">Calificación</p>
          {lead ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ETAPA_STYLE[lead.etapa] ?? ""}`}>{ETAPA_LABEL[lead.etapa] ?? lead.etapa}</span>
                <span className="text-sm font-semibold text-crema">{lead.score}<span className="text-azul text-xs">/100</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-navy-900 overflow-hidden"><div className={`h-full ${colorScore(lead.score)}`} style={{ width: `${lead.score}%` }} /></div>
              {lead.resumen && <p className="mt-3 text-xs text-crema">{lead.resumen}</p>}
            </>
          ) : <p className="text-xs text-azul-claro">Todavía nada. Mandá el primer mensaje.</p>}
        </div>

        {lead?.necesita_humano && (
          <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-300">✋ Te pasaría la posta</p>
            <p className="text-xs text-crema mt-1">{lead.motivo_humano ?? "Necesita que intervengas vos."}</p>
            <p className="text-[10px] text-azul-claro mt-1">Con un lead real, esto NO sale solo: queda esperando tu OK.</p>
          </div>
        )}

        <div className="rounded-lg border border-navy-700 bg-navy-800 p-4">
          <p className="text-[10px] uppercase tracking-wider text-azul mb-2">Lo que sabe del lead</p>
          {ficha.length ? (
            <dl className="flex flex-col gap-1.5">
              {ficha.map(([k, v]) => (
                <div key={k}><dt className="text-[10px] text-azul">{FICHA_LABEL[k] ?? k}</dt><dd className="text-xs text-crema">{String(v)}</dd></div>
              ))}
            </dl>
          ) : <p className="text-xs text-azul-claro">—</p>}
        </div>
      </aside>
    </div>
  );
}
