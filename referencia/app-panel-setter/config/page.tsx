import { accesoSetter } from "@/lib/setter/acceso";
import { redirect } from "next/navigation";
import Link from "next/link";
import { leerConfig } from "@/lib/setter/motor";
import { manychatConfigurado } from "@/lib/setter/manychat";
import { guardarConfig } from "../actions";
import ManychatConfig from "./manychat-config";

const f = "font-[family-name:var(--font-montserrat)]";
const GUION = [
  { k: "apertura", l: "1 · Apertura (el primer mensaje)", ph: "Ej: agradecé que escribió, nombrá el reel o historia que vio y preguntale hace cuánto entrena." },
  { k: "diagnostico", l: "2 · Diagnóstico (entender su caso)", ph: "Ej: antes de hablar de la oferta tenés que saber: años entrenando, qué hace hoy, si registra, objetivo y por qué ahora." },
  { k: "oferta", l: "3 · Oferta (mostrar cómo trabajás)", ph: "Ej: conectá su problema con 1 cosa concreta del método y mandá el video. Nunca más de 3 burbujas." },
  { k: "cierre", l: "4 · Cierre (precio y arrancar)", ph: "Ej: decí el precio una sola vez, ofrecé la semana de prueba si duda, y si quiere pagar pasame la posta." },
] as const;
const input = `${f} w-full rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-crema placeholder:text-azul focus:border-dorado outline-none`;

export default async function ConfigSetterPage() {
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");
  const cfg = await leerConfig();

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-2xl mx-auto w-full">
      <Link href="/panel/setter" className={`${f} text-xs text-azul-claro hover:text-crema block mb-3`}>← Setter</Link>
      <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide mb-5">⚙️ Config del setter</h1>

      <form action={guardarConfig} className={`${f} flex flex-col gap-5`}>
        <section className="rounded-lg border border-navy-700 bg-navy-800 p-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-crema">
            <input type="checkbox" name="activo" defaultChecked={cfg.activo} className="accent-[var(--color-dorado,#c9a24a)]" />
            Bot prendido <span className="text-xs text-azul-claro">(apagado: guarda los DMs pero no contesta)</span>
          </label>
          <div>
            <p className="text-xs text-azul-claro mb-1">Modo por defecto</p>
            <select name="modo" defaultValue={cfg.modo} className={input}>
              <option value="copiloto">Copiloto — el bot redacta, yo apruebo cada mensaje</option>
              <option value="auto">Automático — manda solo (salvo cuando me pasa la posta)</option>
            </select>
          </div>
        </section>

        <section className="rounded-lg border border-navy-700 bg-navy-800 p-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-azul">La oferta</p>
          <textarea name="oferta" rows={5} defaultValue={cfg.oferta ?? ""} className={input}
            placeholder="Cómo querés que la explique (qué incluye, precio exacto, opciones). Vacío = usa la descripción por defecto: experiencia REBUILD, 380-500 USD/mes, el número final lo cerrás vos." />
          <input name="link_vsl" defaultValue={cfg.link_vsl ?? ""} placeholder="Link del video (VSL)" className={input} />
          <input name="link_prueba" defaultValue={cfg.link_prueba ?? ""} placeholder="Link de la semana de prueba" className={input} />
          <input name="link_pago" defaultValue={cfg.link_pago ?? ""} placeholder="Link para pagar/arrancar (vacío = te pasa la posta para cerrar)" className={input} />
        </section>

        <section className="rounded-lg border border-navy-700 bg-navy-800 p-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-azul">Estructura de la charla (tu guion por etapa)</p>
          <p className="text-[11px] text-azul-claro -mt-1">Qué querés que haga el bot en cada momento. Lo que escribas acá se suma a cómo lo hace hoy y manda sobre eso. Vacío = usa su forma por defecto.</p>
          {GUION.map((g) => (
            <div key={g.k}>
              <p className="text-xs text-crema mb-1">{g.l}</p>
              <textarea name={`guion_${g.k}`} rows={2} defaultValue={cfg.guion[g.k] ?? ""} className={input} placeholder={g.ph} />
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-navy-700 bg-navy-800 p-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-azul">Preguntas frecuentes y objeciones</p>
          <p className="text-[11px] text-azul-claro -mt-1">Una por bloque: la pregunta u objeción y cómo la respondés vos. El bot usa ESTO en vez de inventar.</p>
          <textarea name="faq" rows={8} defaultValue={cfg.faq ?? ""} className={input}
            placeholder={"¿Sirve si entreno en casa? → Sí, armamos con lo que tengas, pero rinde más con gimnasio.\n\n'Lo voy a pensar' → Dale, ¿qué es lo que te hace dudar? Si es la plata, hay opciones; si es si te va a servir, tenés la semana de prueba.\n\n¿Cuántas veces por semana hay que entrenar? → Lo armamos según tus días reales, de 3 a 6."} />
        </section>

        <section className="rounded-lg border border-navy-700 bg-navy-800 p-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-azul">Tu voz</p>
          <textarea name="instrucciones" rows={4} defaultValue={cfg.instrucciones ?? ""} className={input}
            placeholder={'Reglas tuyas, una por línea. Ej: "nunca digas que soy nutricionista", "a las mujeres no les hables de volumen"…'} />
          <textarea name="ejemplos" rows={8} defaultValue={cfg.ejemplos ?? ""} className={input}
            placeholder="Pegá chats reales tuyos con leads (los que cerraste). El bot copia el tono." />
        </section>

        <button className="self-start rounded-md bg-dorado px-5 py-2 text-sm font-semibold text-navy-900">Guardar</button>
      </form>

      <ManychatConfig secreto={process.env.SETTER_WEBHOOK_SECRET ?? null} apiKeyOk={manychatConfigurado()} />
    </main>
  );
}
