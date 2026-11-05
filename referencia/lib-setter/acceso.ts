import "server-only";
import { createClient } from "@/lib/supabase/server";

// ¿Quién maneja el Setter? Nico (admin) o quien tenga `clientes.acceso_setter` (Maylén, a cargo del chatbot desde
// 30/10, db/117). Gate ÚNICO de /panel/setter/* y sus acciones: las tablas del setter son deny-all (admin client),
// así que este chequeo es la única puerta.
export async function accesoSetter(): Promise<{ ok: true; esAdmin: boolean; nombre: string } | { ok: false }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: yo } = await supabase.from("clientes").select("rol, acceso_setter, nombre").eq("auth_user_id", user.id).maybeSingle();
  if (yo?.rol === "admin") return { ok: true, esAdmin: true, nombre: yo.nombre ?? "Nico" };
  if (yo?.acceso_setter) return { ok: true, esAdmin: false, nombre: yo.nombre ?? "" };
  return { ok: false };
}
