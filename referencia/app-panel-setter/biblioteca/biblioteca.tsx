"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { crearSubida, guardarRecurso, editarRecurso, borrarRecurso } from "../actions";
import { VistaRecurso, ICONO_RECURSO } from "../burbuja";
import { ETAPA_LABEL } from "../ui";
import type { Recurso } from "@/lib/setter/motor";

const f = "font-[family-name:var(--font-montserrat)]";
const input = `${f} w-full rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema placeholder:text-azul focus:border-dorado outline-none`;
const ETAPAS_RECURSO = ["apertura", "diagnostico", "oferta", "cierre", "seguimiento"];
const LIMITE_IG_MB = 25; // más que esto, Instagram/WhatsApp suelen rechazar la media → sale como link

function tipoDeArchivo(file: File): string | null {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "imagen";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

export default function Biblioteca({ recursos }: { recursos: Recurso[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<"archivo" | "link">("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [titulo, setTitulo] = useState("");
  const [cuando, setCuando] = useState("");
  const [etapa, setEtapa] = useState("");
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pesoMb = archivo ? archivo.size / 1024 / 1024 : 0;

  const subir = () => {
    setError(null);
    start(async () => {
      try {
        let url = link.trim(), storage_path: string | null = null, tipo = "link";
        if (modo === "archivo") {
          if (!archivo) { setError("Elegí un archivo"); return; }
          const t = tipoDeArchivo(archivo);
          if (!t) { setError("Formato no soportado: subí audio, video, imagen o PDF"); return; }
          tipo = t;
          setEstado("Subiendo…");
          const firma = await crearSubida(archivo.name);
          if ("error" in firma) { setError(firma.error); setEstado(null); return; }
          const { error: eUp } = await createClient().storage.from("setter-recursos")
            .uploadToSignedUrl(firma.path, firma.token, archivo, { contentType: archivo.type });
          if (eUp) { setError(`No se pudo subir: ${eUp.message}`); setEstado(null); return; }
          url = firma.publicUrl; storage_path = firma.path;
        } else if (!/^https?:\/\//.test(url)) { setError("El link tiene que empezar con https://"); return; }
        setEstado("Guardando…");
        const r = await guardarRecurso({ tipo, titulo, cuando_usar: cuando, etapa: etapa || null, url, storage_path });
        setEstado(null);
        if (r.error) { setError(r.error); return; }
        setArchivo(null); setLink(""); setTitulo(""); setCuando(""); setEtapa("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (e) {
        setEstado(null);
        setError(e instanceof Error ? e.message : "Algo falló");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Agregar */}
      <section className={`${f} rounded-lg border border-dorado/40 bg-navy-800 p-4 flex flex-col gap-3`}>
        <p className="text-xs uppercase tracking-wider text-dorado">➕ Agregar un recurso</p>
        <div className="flex gap-2 text-xs">
          {(["archivo", "link"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`rounded-md border px-3 py-1.5 ${modo === m ? "border-dorado bg-dorado/10 text-dorado" : "border-navy-700 text-azul-claro"}`}>
              {m === "archivo" ? "📁 Subir archivo (audio, video, imagen, PDF)" : "🔗 Pegar un link (YouTube, reel, web…)"}
            </button>
          ))}
        </div>
        {modo === "archivo" ? (
          <div>
            <input ref={fileRef} type="file" accept="audio/*,video/*,image/*,application/pdf"
              onChange={(e) => { const a = e.target.files?.[0] ?? null; setArchivo(a); if (a && !titulo) setTitulo(a.name.replace(/\.[^.]+$/, "")); }}
              className="text-xs text-crema file:mr-3 file:rounded-md file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-crema" />
            {archivo && (
              <p className={`mt-1 text-[11px] ${pesoMb > LIMITE_IG_MB ? "text-amber-300" : "text-azul-claro"}`}>
                {pesoMb.toFixed(1)} MB{pesoMb > LIMITE_IG_MB ? ` — pesa más de ${LIMITE_IG_MB} MB: Instagram/WhatsApp probablemente no lo acepten como video/audio y el bot lo va a mandar como link.` : ""}
              </p>
            )}
            <p className="mt-1 text-[11px] text-azul">Audios en mp3 o m4a · videos cortos en mp4 (idealmente menos de 25 MB) · imágenes jpg/png.</p>
          </div>
        ) : (
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={input} />
        )}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej: Audio — cómo trabajo con alguien estancado)" className={input} />
        <textarea value={cuando} onChange={(e) => setCuando(e.target.value)} rows={2} className={input}
          placeholder="¿Cuándo tiene que mandarlo el bot? (ej: cuando dice 'lo voy a pensar' o duda si le sirve un coach)" />
        <div className="flex flex-wrap items-center gap-3">
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className={`${input} w-auto`}>
            <option value="">En cualquier etapa</option>
            {ETAPAS_RECURSO.map((e) => <option key={e} value={e}>Solo en: {ETAPA_LABEL[e]}</option>)}
          </select>
          <button disabled={cargando || !titulo.trim() || !cuando.trim() || (modo === "archivo" ? !archivo : !link.trim())} onClick={subir}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-40">
            {estado ?? "Guardar en la biblioteca"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">⚠️ {error}</p>}
      </section>

      {/* Lista */}
      <section className="flex flex-col gap-3">
        {recursos.length === 0 && <p className={`${f} text-sm text-azul-claro`}>Todavía no hay recursos. El primero que conviene subir: un audio tuyo de 1 minuto explicando cómo trabajás con alguien que entrena y está estancado.</p>}
        {recursos.map((r) => <FilaRecurso key={r.id} r={r} />)}
      </section>
    </div>
  );
}

function FilaRecurso({ r }: { r: Recurso }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(r.titulo);
  const [cuando, setCuando] = useState(r.cuando_usar);
  const [etapa, setEtapa] = useState(r.etapa ?? "");
  const [cargando, start] = useTransition();
  const correr = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className={`${f} rounded-lg border bg-navy-800 p-4 ${r.activo ? "border-navy-700" : "border-navy-700 opacity-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-crema">{ICONO_RECURSO[r.tipo] ?? "📎"} {r.titulo}</p>
          <p className="text-[11px] text-azul">{r.etapa ? `Solo en: ${ETAPA_LABEL[r.etapa]}` : "Cualquier etapa"} · lo mandó {r.usos} {r.usos === 1 ? "vez" : "veces"}</p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <button disabled={cargando} onClick={() => setEditando(!editando)} className="text-azul-claro hover:text-crema">{editando ? "Cerrar" : "Editar"}</button>
          <button disabled={cargando} onClick={() => correr(() => editarRecurso(r.id, { activo: !r.activo }))} className="text-azul-claro hover:text-crema">
            {r.activo ? "Pausar" : "Activar"}
          </button>
          <button disabled={cargando} onClick={() => { if (confirm("¿Borrar este recurso? Se borra también el archivo.")) correr(() => borrarRecurso(r.id)); }}
            className="text-azul hover:text-red-400">Borrar</button>
        </div>
      </div>
      {editando ? (
        <div className="flex flex-col gap-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={input} />
          <textarea value={cuando} onChange={(e) => setCuando(e.target.value)} rows={2} className={input} />
          <div className="flex items-center gap-2">
            <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className={`${input} w-auto`}>
              <option value="">En cualquier etapa</option>
              {ETAPAS_RECURSO.map((e) => <option key={e} value={e}>Solo en: {ETAPA_LABEL[e]}</option>)}
            </select>
            <button disabled={cargando} onClick={() => correr(async () => { await editarRecurso(r.id, { titulo, cuando_usar: cuando, etapa: etapa || null }); setEditando(false); })}
              className="rounded-md bg-dorado px-3 py-2 text-xs font-semibold text-navy-900 disabled:opacity-40">Guardar</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-crema mb-2"><span className="text-azul">Cuándo: </span>{r.cuando_usar}</p>
      )}
      <VistaRecurso r={r} />
    </div>
  );
}
