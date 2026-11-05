import "server-only";

// Caño de salida: ManyChat (API oficial de Meta para IG + WhatsApp → no arriesga la cuenta).
// Sin MANYCHAT_API_KEY queda DORMIDO: no manda nada (el panel igual funciona en copiloto / simulador).
// Fuera de la ventana de 24 hs de Meta, IG exige la etiqueta HUMAN_AGENT (hasta 7 días).

const KEY = () => process.env.MANYCHAT_API_KEY;
export const manychatConfigurado = () => !!KEY();

// Lo que sale: una burbuja de texto o un recurso de la biblioteca (audio/video/imagen/pdf/link).
export type Salida = { texto: string } | { recurso: { tipo: string; url: string; titulo: string } };

type MsgManychat = { type: string; text?: string; url?: string };

const comoTexto = (r: { url: string; titulo: string }): MsgManychat => ({ type: "text", text: `${r.titulo}: ${r.url}` });

function aMensaje(s: Salida, soloTexto: boolean): MsgManychat {
  if ("texto" in s) return { type: "text", text: s.texto };
  const r = s.recurso;
  if (soloTexto || r.tipo === "link") return comoTexto(r);
  const tipo = { audio: "audio", video: "video", imagen: "image", pdf: "file" }[r.tipo];
  return tipo ? { type: tipo, url: r.url } : comoTexto(r);
}

async function mandar(subscriberId: string, canal: string, messages: MsgManychat[], fueraDeVentana: boolean) {
  const r = await fetch("https://api.manychat.com/fb/sending/sendContent", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriber_id: Number(subscriberId) || subscriberId,
      data: { version: "v2", content: { type: canal, messages } },
      ...(fueraDeVentana ? { message_tag: "HUMAN_AGENT" } : {}),
    }),
  });
  const j = (await r.json().catch(() => null)) as { status?: string; message?: string } | null;
  if (!r.ok || j?.status !== "success") return { ok: false as const, error: j?.message ?? `HTTP ${r.status}` };
  return { ok: true as const };
}

export async function enviarManychat(
  subscriberId: string,
  canal: "instagram" | "whatsapp",
  salidas: Salida[],
  fueraDeVentana = false
): Promise<{ ok: boolean; error?: string }> {
  if (!KEY()) return { ok: false, error: "ManyChat no está conectado (falta MANYCHAT_API_KEY)" };
  if (!salidas.length) return { ok: true };
  try {
    const r = await mandar(subscriberId, canal, salidas.map((s) => aMensaje(s, false)), fueraDeVentana);
    if (r.ok) return r;
    // Si falló y había media (formato/tamaño que el canal no acepta), reintentamos con el recurso como link.
    if (salidas.some((s) => "recurso" in s)) return await mandar(subscriberId, canal, salidas.map((s) => aMensaje(s, true)), fueraDeVentana);
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "desconocido" };
  }
}
