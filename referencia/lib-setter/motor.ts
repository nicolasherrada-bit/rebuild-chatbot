import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pensar, destilarLeccion, type ConfigSetter, type Ficha, type MensajeHist, type RecursoBot, type Aprendizajes, type Guion } from "./cerebro";
import { enviarManychat, type Salida } from "./manychat";

// ─────────────────────────────────────────────────────────────────────────────
// Motor del setter: guarda la charla, llama al cerebro y decide si el mensaje SALE (auto) o queda de
// BORRADOR para que Nico lo apruebe (copiloto). La identidad/permiso la valida el llamador
// (webhook con secreto, o server action de admin).
// ─────────────────────────────────────────────────────────────────────────────

export type Canal = "instagram" | "whatsapp" | "simulador";
export type Modo = "copiloto" | "auto" | "humano";

export type Lead = {
  id: string; canal: Canal; externo_id: string; nombre: string | null; usuario_ig: string | null;
  telefono: string | null; origen: string | null; etapa: string; score: number; ficha: Ficha;
  resumen: string | null; modo: Modo | null; necesita_humano: boolean; motivo_humano: string | null;
  cliente_id: string | null; seguimientos: number; ultimo_entrante_at: string | null;
  ultimo_saliente_at: string | null; created_at: string;
};

type Config = ConfigSetter & { activo: boolean; modo: "copiloto" | "auto" };

const VENTANA_MS = 24 * 3600 * 1000;

export async function leerConfig(): Promise<Config> {
  const { data } = await createAdminClient().from("setter_config").select("*").eq("id", 1).maybeSingle();
  return {
    activo: !!data?.activo, modo: data?.modo === "auto" ? "auto" : "copiloto",
    oferta: data?.oferta ?? null, link_vsl: data?.link_vsl ?? null, link_prueba: data?.link_prueba ?? null, link_pago: data?.link_pago ?? null,
    instrucciones: data?.instrucciones ?? null, ejemplos: data?.ejemplos ?? null,
    guion: (data?.guion && typeof data.guion === "object" ? data.guion : {}) as Guion, faq: data?.faq ?? null,
  };
}

export type Recurso = RecursoBot & { url: string; storage_path: string | null; activo: boolean; usos: number; created_at: string };

// Lo que el bot "sabe" además de la config: la biblioteca activa + lo que Nico le enseñó.
export async function cargarEntrenamiento(): Promise<{ recursos: Recurso[]; aprendizajes: Aprendizajes }> {
  const admin = createAdminClient();
  const [{ data: rec }, { data: reglas }, { data: corr }] = await Promise.all([
    admin.from("setter_recursos").select("*").eq("activo", true).order("created_at"),
    admin.from("setter_aprendizajes").select("regla").eq("tipo", "regla").eq("activo", true).order("created_at"),
    admin.from("setter_aprendizajes").select("contexto, original, corregido, regla").eq("tipo", "correccion").eq("activo", true)
      .order("created_at", { ascending: false }).limit(12),
  ]);
  return {
    recursos: (rec ?? []) as Recurso[],
    aprendizajes: {
      reglas: (reglas ?? []).map((r) => String(r.regla ?? "").trim()).filter(Boolean),
      correcciones: (corr ?? []).reverse().map((c) => ({ contexto: c.contexto, original: c.original, corregido: c.corregido, leccion: c.regla })),
    },
  };
}

// El simulador contesta solo salvo que Nico lo ponga en copiloto para practicar correcciones; el resto usa el
// modo del lead o el global.
export function modoEfectivo(lead: Pick<Lead, "canal" | "modo">, cfg: Pick<Config, "modo">): Modo {
  if (lead.canal === "simulador") return lead.modo === "copiloto" ? "copiloto" : "auto";
  return lead.modo ?? cfg.modo;
}

type FilaMsg = { autor: MensajeHist["autor"]; texto: string; created_at: string; recurso_id: string | null; recurso: { tipo: string; titulo: string } | { tipo: string; titulo: string }[] | null };
const unoSolo = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

// La charla ya enviada (lo que vio el lead), con los recursos identificados.
export async function historial(leadId: string): Promise<(MensajeHist & { recurso_id: string | null })[]> {
  const { data } = await createAdminClient()
    .from("setter_mensajes")
    .select("autor, texto, created_at, recurso_id, recurso:setter_recursos(tipo, titulo)")
    .eq("lead_id", leadId)
    .eq("estado", "enviado")
    .order("created_at", { ascending: true });
  return ((data ?? []) as FilaMsg[]).map((m) => ({ autor: m.autor, texto: m.texto, created_at: m.created_at, recurso_id: m.recurso_id, recurso: unoSolo(m.recurso) }));
}

const fueraDeVentana = (lead: Lead) => !lead.ultimo_entrante_at || Date.now() - new Date(lead.ultimo_entrante_at).getTime() > VENTANA_MS;

async function sumarUsos(ids: string[]) {
  if (!ids.length) return;
  const admin = createAdminClient();
  const { data } = await admin.from("setter_recursos").select("id, usos").in("id", ids);
  await Promise.all((data ?? []).map((r) => admin.from("setter_recursos").update({ usos: (r.usos ?? 0) + 1 }).eq("id", r.id)));
}

// Una línea por burbuja, con los recursos como [mandó: título] — así se comparan borrador vs lo que salió.
const comoLineas = (items: { texto: string; recurso_id?: string | null }[], titulos: Map<string, string>) =>
  items.map((m) => (m.recurso_id ? `[mandó: ${titulos.get(m.recurso_id) ?? "recurso"}]` : m.texto.trim())).filter(Boolean).join("\n");
const normal = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

// Nico corrigió al bot → se guarda el antes/después y, en segundo plano, la IA destila la lección en una línea.
export async function registrarCorreccion(leadId: string, original: string, corregido: string) {
  if (!original.trim() || normal(original) === normal(corregido)) return;
  const admin = createAdminClient();
  const { data: ult } = await admin.from("setter_mensajes").select("texto").eq("lead_id", leadId).eq("autor", "lead")
    .order("created_at", { ascending: false }).limit(2);
  const contexto = (ult ?? []).map((m) => m.texto).reverse().join(" / ") || null;
  const { data: fila } = await admin.from("setter_aprendizajes")
    .insert({ tipo: "correccion", lead_id: leadId, contexto, original, corregido }).select("id").single();
  if (!fila) return;
  const destilar = async () => {
    const leccion = await destilarLeccion({ contexto, original, corregido });
    if (leccion) await createAdminClient().from("setter_aprendizajes").update({ regla: leccion }).eq("id", fila.id);
  };
  try { after(destilar); } catch { await destilar(); } // fuera de un request (scripts) lo hace en el momento
}

// "Enseñale": una regla explícita de Nico (queda activa para todas las charlas).
export async function ensenar(regla: string, leadId: string | null = null): Promise<{ ok: boolean; error?: string }> {
  const t = regla.trim();
  if (!t) return { ok: false, error: "Escribí qué tiene que aprender" };
  const { error } = await createAdminClient().from("setter_aprendizajes").insert({ tipo: "regla", regla: t.slice(0, 500), lead_id: leadId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Alta/actualización del lead cuando escribe + guarda su mensaje. Devuelve el lead y el id del mensaje.
export async function registrarEntrante(p: {
  canal: Canal; externoId: string; texto: string;
  nombre?: string | null; usuarioIg?: string | null; telefono?: string | null; origen?: string | null;
}): Promise<{ lead: Lead; mensajeId: string }> {
  const admin = createAdminClient();
  const ahora = new Date().toISOString();
  const { data: previo } = await admin.from("setter_leads").select("*").eq("canal", p.canal).eq("externo_id", p.externoId).maybeSingle();
  let lead = previo as Lead | null;
  if (!lead) {
    const { data, error } = await admin.from("setter_leads").insert({
      canal: p.canal, externo_id: p.externoId, nombre: p.nombre || null, usuario_ig: p.usuarioIg || null,
      telefono: p.telefono || null, origen: p.origen || "inbound", ultimo_entrante_at: ahora,
    }).select("*").single();
    if (error || !data) throw new Error(`no pude crear el lead: ${error?.message}`);
    lead = data as Lead;
  } else {
    // Si contesta, vuelve a contar desde cero el seguimiento; si estaba "en seguimiento", vuelve a la charla.
    const cambios: Record<string, unknown> = { ultimo_entrante_at: ahora, seguimientos: 0 };
    if (p.nombre && !lead.nombre) cambios.nombre = p.nombre;
    if (p.usuarioIg && !lead.usuario_ig) cambios.usuario_ig = p.usuarioIg;
    if (p.telefono && !lead.telefono) cambios.telefono = p.telefono;
    if (lead.etapa === "seguimiento") cambios.etapa = "diagnostico";
    const { data } = await admin.from("setter_leads").update(cambios).eq("id", lead.id).select("*").single();
    if (data) lead = data as Lead;
  }
  const { data: m, error: em } = await admin.from("setter_mensajes")
    .insert({ lead_id: lead.id, autor: "lead", texto: p.texto.trim() }).select("id").single();
  if (em || !m) throw new Error(`no pude guardar el mensaje: ${em?.message}`);
  return { lead, mensajeId: m.id };
}

// ¿Este mensaje sigue siendo el último del lead? (la gente manda 3 mensajes seguidos → contestamos UNA vez)
export async function esUltimoEntrante(leadId: string, mensajeId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("setter_mensajes").select("id")
    .eq("lead_id", leadId).eq("autor", "lead").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id === mensajeId;
}

// El corazón: piensa la respuesta y, según el modo, la manda o la deja de borrador.
export async function responder(leadId: string, opts: { seguimiento?: boolean } = {}): Promise<
  { ok: true; enviados: string[]; borradores: string[]; modo: Modo } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: l } = await admin.from("setter_leads").select("*").eq("id", leadId).maybeSingle();
  if (!l) return { ok: false, error: "lead no encontrado" };
  const lead = l as Lead;
  const cfg = await leerConfig();
  const modo = modoEfectivo(lead, cfg);
  if (modo === "humano") return { ok: true, enviados: [], borradores: [], modo };

  const [hist, ent] = await Promise.all([historial(lead.id), cargarEntrenamiento()]);
  const r = await pensar({
    historial: hist,
    lead: { nombre: lead.nombre, origen: lead.origen, etapa: lead.etapa, ficha: lead.ficha ?? {} },
    config: cfg,
    recursos: ent.recursos,
    yaMandados: hist.map((m) => m.recurso_id).filter((x): x is string => !!x),
    aprendizajes: ent.aprendizajes,
    seguimiento: opts.seguimiento,
  });
  if (!r.ok) return r;
  const d = r.decision;
  const elegidos = d.recursos.map((id) => ent.recursos.find((x) => x.id === id)).filter((x): x is Recurso => !!x);

  // Si el bot pide a Nico, en auto igual NO manda solo: deja borrador y frena (que Nico decida).
  const mandar = modo === "auto" && !d.necesita_humano;
  const ahora = new Date().toISOString();

  // Un borrador nuevo reemplaza a los viejos sin aprobar (no se apilan).
  await admin.from("setter_mensajes").update({ estado: "descartado" }).eq("lead_id", lead.id).eq("estado", "borrador");

  let estado: "enviado" | "borrador" | "error" = mandar ? "enviado" : "borrador";
  if (mandar && lead.canal !== "simulador") {
    const salidas: Salida[] = [...d.mensajes.map((texto) => ({ texto })), ...elegidos.map((x) => ({ recurso: x }))];
    const env = await enviarManychat(lead.externo_id, lead.canal, salidas, fueraDeVentana(lead));
    if (!env.ok) { estado = "borrador"; d.necesita_humano = true; d.motivo_humano = `No se pudo mandar: ${env.error}`; }
  }

  // Texto primero y después el recurso; created_at escalonado para que las burbujas queden en orden.
  const filas = [
    ...d.mensajes.map((texto) => ({ texto, recurso_id: null as string | null })),
    ...elegidos.map((x) => ({ texto: `📎 ${x.titulo}`, recurso_id: x.id })),
  ];
  if (filas.length) {
    const base = Date.now();
    await admin.from("setter_mensajes").insert(
      filas.map((f, i) => ({ lead_id: lead.id, autor: "bot", texto: f.texto, recurso_id: f.recurso_id, estado, created_at: new Date(base + i).toISOString() }))
    );
  }
  if (estado === "enviado") await sumarUsos(elegidos.map((x) => x.id));

  await admin.from("setter_leads").update({
    etapa: d.etapa, score: d.score, ficha: d.ficha, resumen: d.resumen || lead.resumen,
    necesita_humano: d.necesita_humano, motivo_humano: d.motivo_humano,
    ...(estado === "enviado" ? { ultimo_saliente_at: ahora } : {}),
    ...(opts.seguimiento ? { seguimientos: lead.seguimientos + 1 } : {}),
  }).eq("id", lead.id);

  const lineas = filas.map((f) => f.texto);
  return estado === "enviado"
    ? { ok: true, enviados: lineas, borradores: [], modo }
    : { ok: true, enviados: [], borradores: lineas, modo };
}

export type ItemSalida = { texto?: string; recursoId?: string };

// Nico aprueba (y quizá edita) el borrador → sale por el caño. Si lo cambió, queda como corrección (el bot aprende).
export async function aprobarBorrador(leadId: string, items: ItemSalida[]): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: l } = await admin.from("setter_leads").select("*").eq("id", leadId).maybeSingle();
  if (!l) return { ok: false, error: "lead no encontrado" };
  const lead = l as Lead;
  const finales = items
    .map((i) => (i.recursoId ? { texto: "", recurso_id: i.recursoId } : { texto: (i.texto ?? "").trim(), recurso_id: null as string | null }))
    .filter((i) => i.recurso_id || i.texto);
  const { data: borr } = await admin.from("setter_mensajes").select("texto, recurso_id").eq("lead_id", leadId).eq("estado", "borrador").order("created_at");
  const idsRec = [...new Set([...finales, ...(borr ?? [])].map((m) => m.recurso_id).filter((x): x is string => !!x))];
  const { data: recs } = idsRec.length ? await admin.from("setter_recursos").select("*").in("id", idsRec) : { data: [] };
  const porId = new Map(((recs ?? []) as Recurso[]).map((r) => [r.id, r]));
  const titulos = new Map(((recs ?? []) as Recurso[]).map((r) => [r.id, r.titulo]));

  if (lead.canal !== "simulador") {
    const salidas: Salida[] = finales.map((f) => (f.recurso_id && porId.get(f.recurso_id) ? { recurso: porId.get(f.recurso_id)! } : { texto: f.texto }));
    const env = await enviarManychat(lead.externo_id, lead.canal as "instagram" | "whatsapp", salidas, fueraDeVentana(lead));
    if (!env.ok) return { ok: false, error: env.error };
  }
  await admin.from("setter_mensajes").update({ estado: "descartado" }).eq("lead_id", leadId).eq("estado", "borrador");
  const base = Date.now();
  if (finales.length) await admin.from("setter_mensajes").insert(
    finales.map((f, i) => ({
      lead_id: leadId, autor: "bot", estado: "enviado", recurso_id: f.recurso_id,
      texto: f.recurso_id ? `📎 ${titulos.get(f.recurso_id) ?? "recurso"}` : f.texto,
      created_at: new Date(base + i).toISOString(),
    }))
  );
  await sumarUsos(finales.map((f) => f.recurso_id).filter((x): x is string => !!x));
  await admin.from("setter_leads").update({ ultimo_saliente_at: new Date().toISOString(), necesita_humano: false, motivo_humano: null }).eq("id", leadId);
  await registrarCorreccion(leadId, comoLineas(borr ?? [], titulos), comoLineas(finales, titulos));
  return { ok: true };
}

// Nico escribe él mismo desde el panel.
export async function enviarComoNico(leadId: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: l } = await admin.from("setter_leads").select("*").eq("id", leadId).maybeSingle();
  if (!l) return { ok: false, error: "lead no encontrado" };
  const lead = l as Lead;
  const t = texto.trim();
  if (!t) return { ok: true };
  if (lead.canal !== "simulador") {
    const env = await enviarManychat(lead.externo_id, lead.canal as "instagram" | "whatsapp", [{ texto: t }], fueraDeVentana(lead));
    if (!env.ok) return { ok: false, error: env.error };
  }
  // Si había un borrador del bot y Nico escribió otra cosa, eso también es una corrección.
  const { data: borr } = await admin.from("setter_mensajes").select("texto, recurso_id").eq("lead_id", leadId).eq("estado", "borrador").order("created_at");
  await admin.from("setter_mensajes").update({ estado: "descartado" }).eq("lead_id", leadId).eq("estado", "borrador");
  await admin.from("setter_mensajes").insert({ lead_id: leadId, autor: "nico", texto: t });
  if (borr?.length) await registrarCorreccion(leadId, comoLineas(borr, new Map()), t);
  await admin.from("setter_leads").update({ ultimo_saliente_at: new Date().toISOString(), necesita_humano: false, motivo_humano: null }).eq("id", leadId);
  return { ok: true };
}

// Follow-ups: leads que dejaron de contestar. Máx 2 seguimientos, el 1º a las ~20 hs, el 2º a los ~3 días.
// Solo etapas "vivas" y solo si el último mensaje fue NUESTRO (la pelota está del lado del lead).
export async function correrSeguimientos(): Promise<{ revisados: number; procesados: number }> {
  const admin = createAdminClient();
  const cfg = await leerConfig();
  if (!cfg.activo) return { revisados: 0, procesados: 0 };
  const { data } = await admin.from("setter_leads").select("*")
    .in("etapa", ["apertura", "diagnostico", "oferta", "cierre"])
    .neq("canal", "simulador").eq("necesita_humano", false).lt("seguimientos", 2);
  const ESPERA_H = [20, 72];
  let procesados = 0;
  for (const lead of (data ?? []) as Lead[]) {
    if (!lead.ultimo_saliente_at) continue;
    if (lead.ultimo_entrante_at && lead.ultimo_entrante_at > lead.ultimo_saliente_at) continue;
    const horas = (Date.now() - new Date(lead.ultimo_saliente_at).getTime()) / 3600000;
    if (horas < ESPERA_H[lead.seguimientos]) continue;
    // ¿Ya hay un borrador esperando a Nico? No apilar otro.
    const { count } = await admin.from("setter_mensajes").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("estado", "borrador");
    if (count) continue;
    const r = await responder(lead.id, { seguimiento: true });
    if (r.ok) procesados++;
    if (lead.seguimientos + 1 >= 2) await admin.from("setter_leads").update({ etapa: "seguimiento" }).eq("id", lead.id);
  }
  return { revisados: data?.length ?? 0, procesados };
}
