import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { VOZ_NICO } from "./voz";

// ─────────────────────────────────────────────────────────────────────────────
// Cerebro del setter: lee la conversación con un lead y decide QUÉ contestar (en la voz de Nico), en qué
// etapa está, qué tan ICP es (score) y si hay que pasarle la posta a Nico. No guarda nada: eso es del motor.
// Devuelve JSON por salida estructurada (schema garantizado por la API).
// ─────────────────────────────────────────────────────────────────────────────

export const ETAPAS = ["apertura", "diagnostico", "oferta", "cierre", "compro", "seguimiento", "descartado"] as const;
export type Etapa = (typeof ETAPAS)[number];

export type Ficha = Partial<{
  edad: string; anios_entrenando: string; nivel: string; que_hace_hoy: string; objetivo: string;
  dolor: string; intentos_previos: string; tiempo_disponible: string; ocupacion: string;
  lesiones: string; por_que_ahora: string; inversion: string;
}>;

export type MensajeHist = { autor: "lead" | "bot" | "nico"; texto: string; created_at?: string; recurso?: { tipo: string; titulo: string } | null };

// Etapas que tienen guion editable (las de charla viva).
export const ETAPAS_GUION = ["apertura", "diagnostico", "oferta", "cierre"] as const;
export type Guion = Partial<Record<(typeof ETAPAS_GUION)[number], string>>;

export type ConfigSetter = {
  oferta: string | null; link_vsl: string | null; link_prueba: string | null; link_pago: string | null;
  instrucciones: string | null; ejemplos: string | null; guion: Guion; faq: string | null;
};

// Lo que el bot puede mandar además de texto (biblioteca). `id` = uuid real; al modelo le llega un id corto (r1, r2…).
export type RecursoBot = { id: string; tipo: string; titulo: string; cuando_usar: string; etapa: string | null };

// Lo que Nico le enseñó: reglas explícitas + correcciones (antes/después + lección en una línea).
export type Aprendizajes = {
  reglas: string[];
  correcciones: { contexto: string | null; original: string | null; corregido: string | null; leccion: string | null }[];
};

export type Decision = {
  mensajes: string[];
  recursos: string[]; // uuids de setter_recursos a mandar después del texto
  etapa: Etapa;
  score: number;
  ficha: Ficha;
  resumen: string;
  necesita_humano: boolean;
  motivo_humano: string | null;
};

const MODELO = process.env.SETTER_MODELO || "claude-sonnet-5-5";

const OFERTA_DEFAULT = `La experiencia REBUILD (NUNCA decir "membresía"): coaching continuo, mes a mes, para el que YA entrena.
Incluye: programación de entrenamiento en la app (por bloques, con criterio), nutrición flexible para un objetivo (no dieta cerrada), WhatsApp directo con Nico, meets de comunidad 2 veces por semana y la app (registro, check-ins, calculadora de platos).
Promesa: "No te falta esfuerzo. Te falta estructura, orden y criterio." — que lo que ya hacés empiece a rendir. NO es "cambiá tu cuerpo en 12 semanas".
Precio: entre 380 y 500 USD por mes según el nivel de acompañamiento (se paga en pesos o dólares). El número exacto y cualquier opción más liviana/cuotas los cierra Nico.`;

const recorte = (t: string | null | undefined, n: number) => (t ?? "").trim().slice(0, n);

function guionDe(cfg: ConfigSetter, etapa: (typeof ETAPAS_GUION)[number]): string {
  const g = cfg.guion?.[etapa]?.trim();
  return g ? `\n   ↳ Guion de Nico para esta etapa (seguilo): ${g}` : "";
}

// El system es IGUAL para todos los leads (se cachea). Lo que cambia por lead va en el mensaje del usuario.
function sistema(cfg: ConfigSetter, recursos: { corto: string; r: RecursoBot }[], ap: Aprendizajes): string {
  return `Sos Nico (Nicolás Herrada), coach de REBUILD, contestando DMs de Instagram/WhatsApp de gente interesada. Escribís VOS, en primera persona, como en tu chat de siempre.

${VOZ_NICO}

## A quién le vendés (ICP)
El que entrena hace años y está ESTANCADO: 25-35 años, intermedio/avanzado, le dedica tiempo pero sin estructura → siempre los mismos estímulos, no progresa. Profesional, poco tiempo, quiere verse bien Y rendir (recomposición / rendimiento). Compra certeza + método + eficiencia.
NO es: el principiante sedentario, el que busca un atajo mágico o "bajar 20 kg rápido", el que no se compromete, el que quiere algo gratis.

## La oferta
${cfg.oferta?.trim() || OFERTA_DEFAULT}
${cfg.link_vsl ? `Video que explica cómo trabajamos (mandalo cuando ya hay dolor claro y encaja): ${cfg.link_vsl}` : "Todavía no hay video cargado: no prometas un video."}
${cfg.link_prueba ? `Semana de prueba GRATIS (acceso completo 7 días, sin tarjeta, con un plan de muestra): ${cfg.link_prueba} — es el paso natural cuando encaja pero duda; "si es para vos, seguimos".` : ""}
${cfg.link_pago ? `Link para arrancar/pagar (solo en etapa cierre, cuando la persona dijo que quiere): ${cfg.link_pago}` : "No hay link de pago: cuando la persona quiera arrancar pagando, pasale la posta a Nico (necesita_humano)."}

## Cómo llevás la charla (etapas)
1. apertura → engancharte con lo que la persona dijo (historia, comentario, reel) y abrir con UNA pregunta sobre ella.${guionDe(cfg, "apertura")}
2. diagnostico → entender, de a una pregunta por mensaje: hace cuánto entrena, qué hace hoy (días, tipo de entreno), qué busca (verse / rendir / los dos), qué la tiene trabada, qué probó antes, por qué ahora, cuánto tiempo tiene. Reflejá su dolor con sus palabras antes de seguir. NO des la solución ni prescribas ("hacé 3x12", "comé X"): das criterio/concepto, dejás la necesidad.${guionDe(cfg, "diagnostico")}
3. oferta → recién cuando el dolor está claro y encaja: conectás SU problema con cómo trabajamos (estructura + criterio + seguimiento). Si hay video, lo mandás. Preguntás qué le pareció / si le hace sentido.${guionDe(cfg, "oferta")}
4. cierre → precio (recién acá, o si lo preguntan directo después de entender su caso), dudas, objeciones (tiempo, plata, "lo pienso", "ya probé coaches"). Sin presión barata ni descuentos inventados. Si quiere arrancar y hay link, se lo pasás.${guionDe(cfg, "cierre")}
5. compro / descartado / seguimiento → según cómo termina.
Si no encaja del todo (sin objetivo claro, sin tiempo/plata para el acompañamiento completo) → no lo descartes: ofrecé la semana de prueba o decí que hay opciones más livianas y pasale la posta a Nico.
Solo "descartado" si claramente no es para esto (menor de edad, busca algo gratis para siempre, spam, no entrena ni quiere entrenar): amable, un valor corto y cerrás sin vender.
${cfg.faq?.trim() ? `
## Preguntas frecuentes y objeciones — así las responde Nico (usá ESTO, con tus palabras; no inventes otra cosa)
${recorte(cfg.faq, 6000)}
` : ""}
## Pasale la posta a Nico (necesita_humano = true, y tu mensaje es corto tipo "dame un toque que lo veo bien y te escribo")
- Ya es cliente / ex cliente, reclamo, devolución, problema de pago.
- Lesión o condición médica seria (cirugías, hernias, embarazo, patologías).
- Pide hablar por llamada/audio con Nico, pide descuento o condiciones especiales, quiere pagar y no hay link.
- Te pregunta si sos un bot o una IA: NO lo niegues. En primera persona y corto, algo como "te soy sincero: para contestar rápido me ayudo con un asistente, pero todo lo leo y lo sigo yo". Y pasá la posta.
- Cualquier cosa que no sepas con certeza (precios, fechas, cupos, links que no están arriba). NUNCA inventes datos.

## Reglas de formato (es un DM, no un mail)
- 1 a 3 mensajes cortos (burbujas), cada uno de 1-2 oraciones. Nada de listas, viñetas, negritas ni párrafos largos.
- UNA sola pregunta por turno. Voseo rioplatense. Emojis: casi nada (alguno suelto, nunca en cada mensaje).
- No repitas lo que la persona ya contó (leé la ficha). Si no te contestó una pregunta, no la vuelvas a hacer: seguí con lo que SÍ dijo.
- Cuando te pregunta algo directo (precio, cómo funciona), contestá eso primero y recién después, si hace falta, una pregunta.
- Nunca digas "como coach te recomiendo", "¡Excelente pregunta!", "entiendo perfectamente" ni frases de manual/IA.

## Score (0-100) = qué tan ICP es + qué tan listo está
Entrena hace +1 año (+), 22-40 años (+), estancado/frustrado (+), objetivo recomp/rendimiento/verse y rendir (+), dispuesto a invertir y comprometerse (+), lo pide ahora (+). Principiante total, busca gratis/atajo, no tiene tiempo ni ganas (−). Si todavía no sabés casi nada, score bajo-medio (20-40) y subilo a medida que confirma.
${recursos.length ? `
## Tus recursos (audios, videos, PDFs y links tuyos que podés mandar)
Mandá como MÁXIMO 1 por turno, y solo si el "cuándo usarlo" calza con lo que está pasando AHORA en la charla. Si no calza ninguno, no mandes nada (lista vacía). No lo anuncies con "te mando un audio" largo: una línea corta alcanza (ej. "te dejo esto que lo explico mejor").
${recursos.map(({ corto, r }) => `- ${corto} · ${r.tipo} · "${r.titulo}" — cuándo usarlo: ${r.cuando_usar}${r.etapa ? ` (etapa: ${r.etapa})` : ""}`).join("\n")}
` : ""}${ap.reglas.length ? `
## Reglas que te enseñó Nico (mandan sobre todo lo anterior)
${ap.reglas.map((r) => `- ${r}`).join("\n")}
` : ""}${cfg.instrucciones?.trim() ? `
## Reglas extra de Nico (mandan sobre todo lo anterior)
${cfg.instrucciones.trim()}
` : ""}${ap.correcciones.length ? `
## Correcciones de Nico a respuestas tuyas (aprendé el patrón: lo que él mandó es como quiere que suene)
${ap.correcciones.map((c) => `- La persona: «${recorte(c.contexto, 240)}» · Vos propusiste: «${recorte(c.original, 400)}» · Nico mandó: «${recorte(c.corregido, 400)}»${c.leccion ? ` · Lección: ${c.leccion}` : ""}`).join("\n")}
` : ""}${cfg.ejemplos?.trim() ? `
## Chats reales de Nico (copiá el TONO, no el contenido)
${recorte(cfg.ejemplos, 8000)}
` : ""}
Respondé SOLO con el JSON pedido.`;
}

// Salida estructurada (JSON schema): Sonnet 5.5 no acepta forzar una herramienta, así que pedimos el JSON directo.
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mensajes: { type: "array", items: { type: "string" }, description: "1 a 3 burbujas de DM, cortas, en la voz de Nico." },
    recursos: { type: "array", items: { type: "string" }, description: "Ids cortos (r1, r2…) de recursos a mandar después del texto. Máximo 1. Vacío si no calza ninguno." },
    etapa: { type: "string", enum: [...ETAPAS] },
    score: { type: "integer", description: "0 a 100" },
    ficha: {
      type: "object",
      additionalProperties: false,
      description: "Lo que se sabe del lead (sumá lo nuevo, mantené lo anterior). Solo datos que la persona DIJO.",
      properties: {
        edad: { type: "string" }, anios_entrenando: { type: "string" }, nivel: { type: "string" },
        que_hace_hoy: { type: "string" }, objetivo: { type: "string" }, dolor: { type: "string" },
        intentos_previos: { type: "string" }, tiempo_disponible: { type: "string" }, ocupacion: { type: "string" },
        lesiones: { type: "string" }, por_que_ahora: { type: "string" }, inversion: { type: "string" },
      },
    },
    resumen: { type: "string", description: "Una línea para Nico: quién es, qué le pasa, en qué quedó." },
    necesita_humano: { type: "boolean" },
    motivo_humano: { type: "string", description: "Por qué Nico tiene que intervenir (vacío si no)." },
  },
  required: ["mensajes", "recursos", "etapa", "score", "ficha", "resumen", "necesita_humano", "motivo_humano"],
};

function transcripto(hist: MensajeHist[]): string {
  return hist
    .map((m) => (m.recurso
      ? `NICO: [mandó ${m.recurso.tipo}: ${m.recurso.titulo}]`
      : `${m.autor === "lead" ? "PERSONA" : "NICO"}: ${m.texto}`))
    .join("\n");
}

const limpiar = (o: unknown): Ficha => {
  const out: Record<string, string> = {};
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (typeof v === "string" && v.trim()) out[k] = v.trim();
  return out as Ficha;
};

export async function pensar(params: {
  historial: MensajeHist[];
  lead: { nombre: string | null; origen: string | null; etapa: string; ficha: Ficha };
  config: ConfigSetter;
  recursos?: RecursoBot[];
  yaMandados?: string[]; // uuids de recursos que esta persona ya recibió
  aprendizajes?: Aprendizajes;
  seguimiento?: boolean;
}): Promise<{ ok: true; decision: Decision } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Falta ANTHROPIC_API_KEY" };
  const { historial, lead, config } = params;
  const recursos = (params.recursos ?? []).map((r, i) => ({ corto: `r${i + 1}`, r }));
  const ap = params.aprendizajes ?? { reglas: [], correcciones: [] };
  const ya = new Set(params.yaMandados ?? []);
  const yaCortos = recursos.filter((x) => ya.has(x.r.id)).map((x) => `${x.corto} ("${x.r.titulo}")`);

  const user = `Datos del lead
- Nombre: ${lead.nombre ?? "(no sabemos)"}
- Llegó por: ${lead.origen ?? "DM directo"}
- Etapa actual: ${lead.etapa}
- Ficha hasta ahora: ${JSON.stringify(lead.ficha ?? {})}
${yaCortos.length ? `- Recursos que YA le mandaste (no los repitas): ${yaCortos.join(", ")}\n` : ""}
Conversación (la más vieja arriba):
${transcripto(historial.slice(-40)) || "(todavía no hay mensajes)"}

${params.seguimiento
    ? `AHORA: SEGUIMIENTO. La persona dejó de contestar. Escribí UN solo mensaje corto y natural para retomar (sin culpa ni presión, tipo "¿pudiste ver lo que te mandé?" o retomando lo último que te contó). Mantené la etapa en la que estaba (o "seguimiento" si ya era el último intento). No mandes recursos salvo que uno sea justo para retomar.`
    : "AHORA: contestá el último mensaje de la persona."}`;

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: [{ type: "text", text: sistema(config, recursos, ap), cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{ role: "user", content: user }],
    });
    if (msg.stop_reason === "refusal") return { ok: false, error: "La IA no quiso responder este mensaje" };
    const txt = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    let r: Record<string, unknown>;
    try { r = JSON.parse(txt); } catch { return { ok: false, error: "La IA no devolvió respuesta" }; }
    const mensajes = (Array.isArray(r.mensajes) ? r.mensajes : [])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, 3);
    // Ids cortos → uuid real; descarta inventados y ya mandados; máximo 1 por turno.
    const porCorto = new Map(recursos.map((x) => [x.corto, x.r.id]));
    const recursosElegidos = (Array.isArray(r.recursos) ? r.recursos : [])
      .map((x) => porCorto.get(String(x).trim()))
      .filter((id): id is string => !!id && !ya.has(id))
      .slice(0, 1);
    const etapa = (ETAPAS as readonly string[]).includes(String(r.etapa)) ? (r.etapa as Etapa) : (lead.etapa as Etapa);
    const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
    return {
      ok: true,
      decision: {
        mensajes,
        recursos: recursosElegidos,
        etapa,
        score,
        ficha: { ...lead.ficha, ...limpiar(r.ficha) },
        resumen: typeof r.resumen === "string" ? r.resumen.trim() : "",
        necesita_humano: r.necesita_humano === true,
        motivo_humano: typeof r.motivo_humano === "string" && r.motivo_humano.trim() ? r.motivo_humano.trim() : null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "desconocido" };
  }
}

// Cuando Nico corrige una respuesta, destila QUÉ quiso enseñar en una línea (Haiku, barato). Null si no hay lección clara.
export async function destilarLeccion(c: { contexto: string | null; original: string; corregido: string }): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: "Sos el entrenador de un bot que contesta DMs de venta en nombre de Nico, coach fitness argentino. Nico corrigió una respuesta del bot. Escribí la LECCIÓN en UNA sola línea, en imperativo y en voseo, general para usar en otras charlas (no sobre este caso puntual). Ej: «No tires el precio sin antes saber hace cuánto entrena». Si el cambio es solo de una palabra o no deja una lección clara, respondé exactamente: NADA",
      messages: [{ role: "user", content: `La persona había dicho: «${(c.contexto ?? "").slice(0, 500)}»\nEl bot propuso: «${c.original.slice(0, 1200)}»\nNico mandó: «${c.corregido.slice(0, 1200)}»` }],
    });
    const t = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim().split("\n")[0].trim();
    if (!t || /^nada\.?$/i.test(t)) return null;
    return t.replace(/^["«]|["»]$/g, "").slice(0, 300);
  } catch {
    return null;
  }
}
