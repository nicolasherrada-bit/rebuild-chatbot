import { createAdminClient } from "@/lib/supabase/admin";
import { accesoSetter } from "@/lib/setter/acceso";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Recurso } from "@/lib/setter/motor";
import Biblioteca from "./biblioteca";

const f = "font-[family-name:var(--font-montserrat)]";

// Biblioteca del setter: audios, videos, imágenes, PDFs y links que el bot puede mandar solo, cada uno con
// "cuándo usarlo" (eso es lo que lee el bot para elegir).
export default async function BibliotecaPage() {
  // Nico (admin) o quien tenga acceso al Setter (Maylén, a cargo del chatbot).
  const acc = await accesoSetter();
  if (!acc.ok) redirect("/panel");

  const { data } = await createAdminClient().from("setter_recursos").select("*").order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col px-5 py-8 max-w-3xl mx-auto w-full">
      <Link href="/panel/setter" className={`${f} text-xs text-azul-claro hover:text-crema block mb-3`}>← Setter</Link>
      <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-crema tracking-wide">📚 Biblioteca del bot</h1>
      <p className={`${f} text-xs text-azul-claro mb-5`}>
        Lo que el bot puede mandar además de texto: tus audios, videos, casos, PDFs o links. Lo más importante es el
        <b className="text-crema"> “cuándo usarlo”</b>: el bot lo lee para decidir si en ESE momento de la charla corresponde mandarlo
        (como máximo uno por respuesta, y nunca el mismo dos veces a la misma persona).
      </p>
      <Biblioteca recursos={(data ?? []) as Recurso[]} />
    </main>
  );
}
