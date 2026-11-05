import { createAdminClient } from "@/lib/supabase/admin";
import { accesoSetter } from "@/lib/setter/acceso";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { leerConfig, modoEfectivo, type Lead } from "@/lib/setter/motor";
import { ETAPA_LABEL, ETAPA_STYLE, FICHA_LABEL, colorScore, CANAL_ICON } from "../ui";
import Conversacion from "./conversacion";
import { mensajesDe } from "@/lib/setter/vista";

const f = "font-[family-name:var(--font-montserrat)]";

export default async function LeadSetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");

  const admin = createAdminClient();
  const [{ data: l }, mensajes, cfg] = await Promise.all([
    admin.from("setter_leads").select("*").eq("id", id).maybeSingle(),
    mensajesDe(id),
    leerConfig(),
  ]);
  if (!l) notFound();
  const lead = l as Lead;
  const ficha = Object.entries(lead.ficha ?? {}).filter(([, v]) => v);
  const nombre = lead.nombre || (lead.usuario_ig ? `@${lead.usuario_ig}` : "Sin nombre");

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-5xl mx-auto w-full">
      <Link href="/panel/setter" className={`${f} text-xs text-azul-claro hover:text-crema block mb-3`}>← Setter</Link>
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide">{CANAL_ICON[lead.canal]} {nombre}</h1>
        {lead.usuario_ig && (
          <a href={`https://instagram.com/${lead.usuario_ig}`} target="_blank" rel="noopener noreferrer" className={`${f} text-xs text-azul-claro hover:text-dorado`}>@{lead.usuario_ig} ↗</a>
        )}
        {lead.origen && <span className={`${f} text-xs text-azul`}>vino por: {lead.origen}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <Conversacion
          leadId={lead.id}
          mensajes={mensajes}
          modo={lead.modo ?? ""}
          modoEfectivo={modoEfectivo(lead, cfg)}
          etapa={lead.etapa}
        />

        <aside className={`${f} flex flex-col gap-3`}>
          <div className="rounded-lg border border-navy-700 bg-navy-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ETAPA_STYLE[lead.etapa] ?? ""}`}>{ETAPA_LABEL[lead.etapa] ?? lead.etapa}</span>
              <span className="text-sm font-semibold text-crema">{lead.score}<span className="text-azul text-xs">/100</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-navy-900 overflow-hidden"><div className={`h-full ${colorScore(lead.score)}`} style={{ width: `${lead.score}%` }} /></div>
            {lead.resumen && <p className="mt-3 text-xs text-crema">{lead.resumen}</p>}
          </div>

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

          {lead.telefono && (
            <a href={`https://wa.me/${lead.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="rounded-md border border-green-600/50 bg-green-500/10 px-3 py-2 text-center text-xs text-green-300 hover:bg-green-500/20">💬 {lead.telefono}</a>
          )}
        </aside>
      </div>
    </main>
  );
}
