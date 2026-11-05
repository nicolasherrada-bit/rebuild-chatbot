import { createAdminClient } from "@/lib/supabase/admin";
import { accesoSetter } from "@/lib/setter/acceso";
import { redirect } from "next/navigation";
import Link from "next/link";
import { leerConfig, type Lead } from "@/lib/setter/motor";
import { manychatConfigurado } from "@/lib/setter/manychat";
import { ETAPA_LABEL, ETAPA_STYLE, colorScore, CANAL_ICON } from "./ui";

const f = "font-[family-name:var(--font-montserrat)]";

// Bandeja del setter: los DMs que entran por ManyChat, calificados. Arriba lo que espera a Nico
// (borradores para aprobar en copiloto + los que el bot le pasó la posta).
export default async function SetterPage() {
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");

  const admin = createAdminClient();
  const cuenta = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [cfg, { data: leadsRaw }, { data: borr }, nRecursos, nReglas, nCorrecciones] = await Promise.all([
    leerConfig(),
    admin.from("setter_leads").select("*").neq("canal", "simulador").order("ultimo_entrante_at", { ascending: false, nullsFirst: false }).limit(300),
    admin.from("setter_mensajes").select("lead_id").eq("estado", "borrador"),
    cuenta(admin.from("setter_recursos").select("id", { count: "exact", head: true }).eq("activo", true)),
    cuenta(admin.from("setter_aprendizajes").select("id", { count: "exact", head: true }).eq("tipo", "regla").eq("activo", true)),
    cuenta(admin.from("setter_aprendizajes").select("id", { count: "exact", head: true }).eq("tipo", "correccion").eq("activo", true)),
  ]);
  const etapasConGuion = Object.values(cfg.guion ?? {}).filter((v) => v?.trim()).length;
  const leads = (leadsRaw ?? []) as Lead[];
  const conBorrador = new Set((borr ?? []).map((b) => b.lead_id));
  const esperan = leads.filter((l) => l.necesita_humano || conBorrador.has(l.id));
  const resto = leads.filter((l) => !(l.necesita_humano || conBorrador.has(l.id)));
  const vivos = leads.filter((l) => ["apertura", "diagnostico", "oferta", "cierre"].includes(l.etapa)).length;
  const calificados = leads.filter((l) => l.score >= 70).length;

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-4xl mx-auto w-full">
      <Link href="/panel/captacion" className={`${f} text-xs text-azul-claro hover:text-crema block mb-3`}>← Captación</Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide">🤖 Setter</h1>
        <div className="flex gap-2">
          <Link href="/panel/setter/simulador" className={`${f} rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-navy-900`}>🧪 Probar el bot</Link>
          <Link href="/panel/setter/config" className={`${f} rounded-md border border-navy-700 px-3 py-1.5 text-xs text-crema hover:border-dorado`}>⚙️ Config</Link>
        </div>
      </div>

      {/* Estado del bot */}
      <div className={`${f} mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs`}>
        <span className={cfg.activo ? "text-green-400" : "text-azul-claro"}>{cfg.activo ? "● Prendido" : "○ Apagado (guarda, no contesta)"}</span>
        <span className="text-crema">Modo: <b>{cfg.modo === "auto" ? "automático" : "copiloto (vos aprobás)"}</b></span>
        <span className={manychatConfigurado() ? "text-green-400" : "text-amber-300"}>{manychatConfigurado() ? "ManyChat conectado" : "ManyChat sin conectar"}</span>
        <span className="text-azul-claro">{vivos} en charla · {calificados} calificados (70+)</span>
      </div>

      {/* Entrenar al bot: los 4 lugares donde se lo nutre */}
      <section className={`${f} mb-6 rounded-lg border border-dorado/40 bg-navy-800 p-4`}>
        <p className="text-xs uppercase tracking-wider text-dorado mb-3">🧠 Entrenar al bot</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Acceso href="/panel/setter/config" icono="⚙️" titulo="Oferta, guion y preguntas"
            detalle={`${cfg.oferta ? "oferta propia" : "oferta por defecto"} · guion en ${etapasConGuion}/4 etapas · ${cfg.faq ? "con" : "sin"} preguntas frecuentes`} />
          <Acceso href="/panel/setter/biblioteca" icono="📚" titulo="Biblioteca" detalle={`${nRecursos} recurso${nRecursos === 1 ? "" : "s"} activo${nRecursos === 1 ? "" : "s"} (audios, videos, PDFs, links)`} />
          <Acceso href="/panel/setter/aprendizajes" icono="✏️" titulo="Lo que aprendió" detalle={`${nReglas} regla${nReglas === 1 ? "" : "s"} · ${nCorrecciones} correccion${nCorrecciones === 1 ? "" : "es"}`} />
          <Acceso href="/panel/setter/simulador" icono="🧪" titulo="Practicar en el simulador" detalle="Prendé “Copiloto” y corregilo: aprende de cada cambio" />
        </div>
      </section>

      {leads.length === 0 ? (
        <div className={`${f} rounded-lg border border-navy-700 bg-navy-800 p-5 text-sm text-azul-claro`}>
          Todavía no entró ningún DM. Cuando conectes ManyChat, cada conversación aparece acá calificada.
          Mientras tanto, <Link href="/panel/setter/simulador" className="text-dorado underline">probalo en el simulador</Link>.
        </div>
      ) : (
        <>
          {esperan.length > 0 && (
            <section className="mb-6">
              <h2 className={`${f} text-xs uppercase tracking-wider text-dorado mb-2`}>✋ Te esperan ({esperan.length})</h2>
              <Lista leads={esperan} conBorrador={conBorrador} />
            </section>
          )}
          <section>
            <h2 className={`${f} text-xs uppercase tracking-wider text-azul mb-2`}>Conversaciones</h2>
            <Lista leads={resto} conBorrador={conBorrador} />
          </section>
        </>
      )}
    </main>
  );
}

function Acceso({ href, icono, titulo, detalle }: { href: string; icono: string; titulo: string; detalle: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-md border border-navy-700 bg-navy-900 px-3 py-2.5 hover:border-dorado">
      <span className="text-lg">{icono}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-crema">{titulo}</span>
        <span className="block text-[11px] text-azul-claro">{detalle}</span>
      </span>
    </Link>
  );
}

// Hace cuánto (server component: se calcula en cada request, no en el render del cliente).
function hace(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
}

function Lista({ leads, conBorrador }: { leads: Lead[]; conBorrador: Set<string> }) {
  return (
    <div className="flex flex-col gap-2">
      {leads.map((l) => (
        <Link key={l.id} href={`/panel/setter/${l.id}`}
          className={`${f} flex items-center gap-3 rounded-lg border bg-navy-800 px-4 py-3 hover:border-dorado ${l.etapa === "descartado" ? "border-navy-700 opacity-60" : "border-navy-700"}`}>
          <span className="text-lg">{CANAL_ICON[l.canal] ?? "•"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-crema">{l.nombre || (l.usuario_ig ? `@${l.usuario_ig}` : "Sin nombre")}</p>
              {l.necesita_humano && <span className="text-[10px] text-amber-300">✋ te necesita</span>}
              {conBorrador.has(l.id) && <span className="text-[10px] text-dorado">✏️ borrador</span>}
            </div>
            <p className="truncate text-xs text-azul-claro">{l.motivo_humano || l.resumen || "—"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${ETAPA_STYLE[l.etapa] ?? ""}`}>{ETAPA_LABEL[l.etapa] ?? l.etapa}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-12 rounded-full bg-navy-900 overflow-hidden"><div className={`h-full ${colorScore(l.score)}`} style={{ width: `${l.score}%` }} /></div>
              <span className="text-[10px] text-azul">{hace(l.ultimo_entrante_at)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
