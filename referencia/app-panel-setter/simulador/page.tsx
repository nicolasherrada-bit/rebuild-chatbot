import { accesoSetter } from "@/lib/setter/acceso";
import { redirect } from "next/navigation";
import Link from "next/link";
import Simulador from "./simulador";

// Simulador del setter: Nico hace de lead y prueba cómo contesta el bot (no manda nada a nadie).
export default async function SimuladorPage() {
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-5xl mx-auto w-full">
      <Link href="/panel/setter" className="font-[family-name:var(--font-montserrat)] text-xs text-azul-claro hover:text-crema block mb-3">← Setter</Link>
      <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide">🧪 Simulador del setter</h1>
      <p className="font-[family-name:var(--font-montserrat)] text-xs text-azul-claro mb-5">
        Escribile como si fueras alguien que te manda un DM. El bot contesta como lo haría con un lead real (no se manda nada a nadie). A la derecha ves cómo lo va calificando.
      </p>
      <Simulador />
    </main>
  );
}
