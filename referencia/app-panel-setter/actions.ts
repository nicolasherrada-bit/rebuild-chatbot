"use server";
import { accesoSetter } from "@/lib/setter/acceso";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { registrarEntrante, responder, aprobarBorrador, enviarComoNico, ensenar, type Lead, type ItemSalida } from "@/lib/setter/motor";
import { ETAPAS, ETAPAS_GUION } from "@/lib/setter/cerebro";
import { mensajesDe, type MensajeVista } from "@/lib/setter/vista";

// El setter lo manejan Nico (admin) y quien tenga acceso_setter (Maylén). Las tablas son deny-all → admin client,
// validando acá quién pide: este chequeo es la única puerta de TODAS las acciones.
async function puedeSetter(): Promise<boolean> {
  return (await accesoSetter()).ok;
}

export type EstadoSim = {
  leadId: string;
  copiloto: boolean;
  mensajes: MensajeVista[];
  lead: Pick<Lead, "etapa" | "score" | "ficha" | "resumen" | "necesita_humano" | "motivo_humano">;
  error?: string;
};

async function estadoLead(leadId: string, error?: string): Promise<EstadoSim> {
  const admin = createAdminClient();
  const [{ data: l }, mensajes] = await Promise.all([
    admin.from("setter_leads").select("etapa, score, ficha, resumen, necesita_humano, motivo_humano, modo").eq("id", leadId).single(),
    mensajesDe(leadId),
  ]);
  return { leadId, copiloto: l?.modo === "copiloto", mensajes, lead: l as EstadoSim["lead"], error };
}

// ── Simulador: Nico hace de lead y el bot contesta en el acto (sin ManyChat, sin mandar nada a nadie).
// copiloto = el bot deja borrador y Nico lo corrige/aprueba (así se practica enseñarle).
export async function simularMensaje(leadId: string | null, texto: string, origen: string, copiloto = false): Promise<EstadoSim | { error: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const t = texto.trim();
  if (!t) return { error: "Escribí algo" };
  const { lead } = await registrarEntrante({
    canal: "simulador", externoId: leadId ? await externoDe(leadId) : `sim-${randomUUID().slice(0, 8)}`,
    texto: t, nombre: "Prueba (simulador)", origen,
  });
  await createAdminClient().from("setter_leads").update({ modo: copiloto ? "copiloto" : null }).eq("id", lead.id);
  const r = await responder(lead.id);
  return estadoLead(lead.id, r.ok ? undefined : r.error);
}

async function externoDe(leadId: string): Promise<string> {
  const { data } = await createAdminClient().from("setter_leads").select("externo_id").eq("id", leadId).single();
  return data?.externo_id ?? `sim-${randomUUID().slice(0, 8)}`;
}

// Aprobar (con correcciones) desde el simulador: devuelve el estado para repintar.
export async function aprobarSim(leadId: string, items: ItemSalida[]): Promise<EstadoSim | { error: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const r = await aprobarBorrador(leadId, items);
  revalidatePath("/panel/setter/aprendizajes");
  return estadoLead(leadId, r.ok ? undefined : r.error);
}

export async function borrarLead(leadId: string) {
  if (!(await puedeSetter())) return;
  await createAdminClient().from("setter_leads").delete().eq("id", leadId);
  revalidatePath("/panel/setter");
}

// ── Bandeja / conversación real
export async function aprobar(leadId: string, items: ItemSalida[]): Promise<{ error?: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const r = await aprobarBorrador(leadId, items);
  revalidatePath(`/panel/setter/${leadId}`);
  revalidatePath("/panel/setter");
  return r.ok ? {} : { error: r.error };
}

export async function descartarBorrador(leadId: string) {
  if (!(await puedeSetter())) return;
  await createAdminClient().from("setter_mensajes").update({ estado: "descartado" }).eq("lead_id", leadId).eq("estado", "borrador");
  revalidatePath(`/panel/setter/${leadId}`);
  revalidatePath("/panel/setter");
}

export async function regenerar(leadId: string): Promise<{ error?: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const r = await responder(leadId);
  revalidatePath(`/panel/setter/${leadId}`);
  return r.ok ? {} : { error: r.error };
}

export async function escribirComoNico(leadId: string, texto: string): Promise<{ error?: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const r = await enviarComoNico(leadId, texto);
  revalidatePath(`/panel/setter/${leadId}`);
  revalidatePath("/panel/setter");
  return r.ok ? {} : { error: r.error };
}

// "🧠 Enseñale": regla explícita (desde una charla, el simulador o la pantalla de aprendizajes).
export async function ensenarRegla(regla: string, leadId: string | null = null): Promise<{ error?: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const r = await ensenar(regla, leadId);
  revalidatePath("/panel/setter/aprendizajes");
  revalidatePath("/panel/setter");
  return r.ok ? {} : { error: r.error };
}

export async function cambiarModo(leadId: string, modo: string) {
  if (!(await puedeSetter())) return;
  const valor = modo === "copiloto" || modo === "auto" || modo === "humano" ? modo : null;
  await createAdminClient().from("setter_leads").update({ modo: valor }).eq("id", leadId);
  revalidatePath(`/panel/setter/${leadId}`);
}

export async function cambiarEtapa(leadId: string, etapa: string) {
  if (!(await puedeSetter()) || !(ETAPAS as readonly string[]).includes(etapa)) return;
  await createAdminClient().from("setter_leads").update({ etapa }).eq("id", leadId);
  revalidatePath(`/panel/setter/${leadId}`);
  revalidatePath("/panel/setter");
}

export async function resolverHumano(leadId: string) {
  if (!(await puedeSetter())) return;
  await createAdminClient().from("setter_leads").update({ necesita_humano: false, motivo_humano: null }).eq("id", leadId);
  revalidatePath(`/panel/setter/${leadId}`);
  revalidatePath("/panel/setter");
}

// ── Biblioteca de recursos
const BUCKET = "setter-recursos";
const TIPOS = ["audio", "video", "imagen", "pdf", "link"] as const;

// URL firmada para subir el archivo DIRECTO al bucket desde el navegador (Vercel no deja pasar archivos
// de más de ~4.5 MB por el servidor, y un video pesa más).
export async function crearSubida(nombreArchivo: string): Promise<{ path: string; token: string; publicUrl: string } | { error: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  const limpio = nombreArchivo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "archivo";
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID().slice(0, 8)}-${limpio}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "No se pudo preparar la subida" };
  return { path, token: data.token, publicUrl: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

export async function guardarRecurso(r: {
  tipo: string; titulo: string; cuando_usar: string; etapa: string | null; url: string; storage_path: string | null;
}): Promise<{ error?: string }> {
  if (!(await puedeSetter())) return { error: "Sin acceso al Setter" };
  if (!(TIPOS as readonly string[]).includes(r.tipo)) return { error: "Tipo inválido" };
  if (!r.titulo.trim() || !r.cuando_usar.trim() || !r.url.trim()) return { error: "Falta título, cuándo usarlo o el archivo/link" };
  const etapa = r.etapa && (ETAPAS as readonly string[]).includes(r.etapa) ? r.etapa : null;
  const { error } = await createAdminClient().from("setter_recursos").insert({
    tipo: r.tipo, titulo: r.titulo.trim(), cuando_usar: r.cuando_usar.trim(), etapa, url: r.url.trim(), storage_path: r.storage_path,
  });
  revalidatePath("/panel/setter/biblioteca");
  revalidatePath("/panel/setter");
  return error ? { error: error.message } : {};
}

export async function editarRecurso(id: string, cambios: { titulo?: string; cuando_usar?: string; etapa?: string | null; activo?: boolean }) {
  if (!(await puedeSetter())) return;
  const upd: Record<string, unknown> = {};
  if (cambios.titulo?.trim()) upd.titulo = cambios.titulo.trim();
  if (cambios.cuando_usar?.trim()) upd.cuando_usar = cambios.cuando_usar.trim();
  if (cambios.etapa !== undefined) upd.etapa = cambios.etapa && (ETAPAS as readonly string[]).includes(cambios.etapa) ? cambios.etapa : null;
  if (cambios.activo !== undefined) upd.activo = cambios.activo;
  if (Object.keys(upd).length) await createAdminClient().from("setter_recursos").update(upd).eq("id", id);
  revalidatePath("/panel/setter/biblioteca");
  revalidatePath("/panel/setter");
}

export async function borrarRecurso(id: string) {
  if (!(await puedeSetter())) return;
  const admin = createAdminClient();
  const { data } = await admin.from("setter_recursos").select("storage_path").eq("id", id).maybeSingle();
  if (data?.storage_path) await admin.storage.from(BUCKET).remove([data.storage_path]);
  await admin.from("setter_recursos").delete().eq("id", id);
  revalidatePath("/panel/setter/biblioteca");
  revalidatePath("/panel/setter");
}

// ── Aprendizajes (reglas + correcciones)
export async function editarAprendizaje(id: string, cambios: { activo?: boolean; regla?: string }) {
  if (!(await puedeSetter())) return;
  const upd: Record<string, unknown> = {};
  if (cambios.activo !== undefined) upd.activo = cambios.activo;
  if (cambios.regla !== undefined) upd.regla = cambios.regla.trim() || null;
  if (Object.keys(upd).length) await createAdminClient().from("setter_aprendizajes").update(upd).eq("id", id);
  revalidatePath("/panel/setter/aprendizajes");
}

export async function borrarAprendizaje(id: string) {
  if (!(await puedeSetter())) return;
  await createAdminClient().from("setter_aprendizajes").delete().eq("id", id);
  revalidatePath("/panel/setter/aprendizajes");
  revalidatePath("/panel/setter");
}

// ── Config
export async function guardarConfig(formData: FormData) {
  if (!(await puedeSetter())) return;
  const txt = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const guion: Record<string, string> = {};
  for (const e of ETAPAS_GUION) { const v = txt(`guion_${e}`); if (v) guion[e] = v; }
  await createAdminClient().from("setter_config").update({
    activo: formData.get("activo") === "on",
    modo: formData.get("modo") === "auto" ? "auto" : "copiloto",
    oferta: txt("oferta"), link_vsl: txt("link_vsl"), link_prueba: txt("link_prueba"), link_pago: txt("link_pago"),
    instrucciones: txt("instrucciones"), ejemplos: txt("ejemplos"), guion, faq: txt("faq"),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  revalidatePath("/panel/setter");
  revalidatePath("/panel/setter/config");
}
