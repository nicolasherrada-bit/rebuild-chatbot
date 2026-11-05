// Burbuja de chat del setter (simulador + conversación). Si el mensaje es un recurso, lo muestra con su reproductor.
import type { RecursoVista } from "@/lib/setter/vista";

const f = "font-[family-name:var(--font-montserrat)]";
export const ICONO_RECURSO: Record<string, string> = { audio: "🎧", video: "🎬", imagen: "🖼️", pdf: "📄", link: "🔗" };

export function VistaRecurso({ r, chico }: { r: RecursoVista; chico?: boolean }) {
  if (r.tipo === "audio") return <audio controls preload="none" src={r.url} className={chico ? "h-8 w-56" : "h-9 w-64 max-w-full"} />;
  if (r.tipo === "video") return <video controls preload="metadata" src={r.url} className={`rounded-lg ${chico ? "max-h-32" : "max-h-56"} max-w-full`} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (r.tipo === "imagen") return <img src={r.url} alt={r.titulo} className={`rounded-lg ${chico ? "max-h-24" : "max-h-48"} max-w-full object-contain`} />;
  return <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline break-all">{ICONO_RECURSO[r.tipo] ?? "🔗"} {r.titulo}</a>;
}

export function Burbuja({ autor, texto, borrador, recurso }: { autor: string; texto: string; borrador?: boolean; recurso?: RecursoVista | null }) {
  const delLead = autor === "lead";
  return (
    <div className={`flex ${delLead ? "justify-start" : "justify-end"}`}>
      <div className={`${f} max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
        delLead ? "rounded-bl-sm bg-navy-900 text-crema border border-navy-700"
          : borrador ? "rounded-br-sm border border-dashed border-dorado/70 bg-dorado/5 text-crema"
          : autor === "nico" ? "rounded-br-sm bg-azul/30 text-crema" : "rounded-br-sm bg-dorado/90 text-navy-900"}`}>
        {recurso ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold">{ICONO_RECURSO[recurso.tipo] ?? "📎"} {recurso.titulo}</span>
            <VistaRecurso r={recurso} />
          </div>
        ) : texto}
      </div>
    </div>
  );
}
