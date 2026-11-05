import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Mensajes de una charla para MOSTRAR (sin los descartados), con el recurso adjunto si lo hay.
// La identidad la valida el llamador (página o acción de admin).
export type RecursoVista = { tipo: string; url: string; titulo: string };
export type MensajeVista = { id: string; autor: string; texto: string; estado: string; recurso_id: string | null; recurso: RecursoVista | null };

type FilaMsg = Omit<MensajeVista, "recurso"> & { recurso: RecursoVista | RecursoVista[] | null };
const unoSolo = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

export async function mensajesDe(leadId: string): Promise<MensajeVista[]> {
  const { data } = await createAdminClient().from("setter_mensajes")
    .select("id, autor, texto, estado, recurso_id, recurso:setter_recursos(tipo, url, titulo)")
    .eq("lead_id", leadId).neq("estado", "descartado").order("created_at");
  return ((data ?? []) as FilaMsg[]).map((m) => ({ ...m, recurso: unoSolo(m.recurso) }));
}
