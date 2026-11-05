import { createAdminClient } from "@/lib/supabase/admin";
import { accesoSetter } from "@/lib/setter/acceso";
import { redirect } from "next/navigation";
import Link from "next/link";
import Aprendizajes, { type Aprendizaje } from "./aprendizajes";

const f = "font-[family-name:var(--font-montserrat)]";

// Lo que el bot aprendió de Nico: reglas explícitas ("Enseñale") + correcciones (cuando editó o reemplazó un borrador).
export default async function AprendizajesPage() {
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");

  const { data } = await createAdminClient().from("setter_aprendizajes")
    .select("id, tipo, contexto, original, corregido, regla, activo, created_at").order("created_at", { ascending: false }).limit(300);

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-3xl mx-auto w-full">
      <Link href="/panel/setter" className={`${f} text-xs text-azul-claro hover:text-crema block mb-3`}>← Setter</Link>
      <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide">🧠 Lo que aprendió el bot</h1>
      <p className={`${f} text-xs text-azul-claro mb-5`}>
        <b className="text-crema">Reglas</b> = lo que le enseñaste con “🧠 Enseñale” (las sigue SIEMPRE).
        <b className="text-crema"> Correcciones</b> = cada vez que cambiaste un borrador antes de mandarlo: se guarda el antes y después y la IA
        anota la lección en una línea (podés editarla). El bot usa todas las reglas y las últimas 12 correcciones activas.
      </p>
      <Aprendizajes items={(data ?? []) as Aprendizaje[]} />
    </main>
  );
}
