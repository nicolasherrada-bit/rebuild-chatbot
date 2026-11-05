"use client";
// Datos EXACTOS para armar el "External Request" en ManyChat (lo arma quien maneja el chatbot). El secreto llega
// del server solo si la persona tiene acceso al Setter, y queda oculto hasta que toca "mostrar".
import { useState } from "react";

const f = "font-[family-name:var(--font-montserrat)]";
const URL_WEBHOOK = "https://rebuildcoach.app/api/webhooks/manychat";

// Qué va en cada campo del body y de dónde sale en ManyChat (botón "+" / variables del contacto).
const CAMPOS = [
  { k: "subscriber_id", v: "{{user_id}}", de: "User Id (variable del sistema) — OBLIGATORIO" },
  { k: "canal", v: "instagram", de: "Texto fijo: instagram (o whatsapp si el flujo es de WhatsApp)" },
  { k: "nombre", v: "{{first_name}}", de: "First Name" },
  { k: "usuario_ig", v: "{{ig_username}}", de: "Instagram Username" },
  { k: "telefono", v: "{{phone}}", de: "Phone" },
  { k: "texto", v: "{{last_input_text}}", de: "Last Text Input — OBLIGATORIO (lo que escribió la persona)" },
  { k: "origen", v: "inbound", de: "Texto fijo: inbound · historia · comentario · anuncio (según el disparador del flujo)" },
];
const BODY = `{\n${CAMPOS.map((c) => `  "${c.k}": "${c.v}"`).join(",\n")}\n}`;

function Copiar({ texto, label = "Copiar" }: { texto: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="shrink-0 rounded border border-navy-700 px-2 py-0.5 text-[10px] text-crema hover:border-dorado">{ok ? "✓ Copiado" : label}</button>
  );
}

export default function ManychatConfig({ secreto, apiKeyOk }: { secreto: string | null; apiKeyOk: boolean }) {
  const [ver, setVer] = useState(false);
  const header = secreto ? `Bearer ${secreto}` : "";
  const fila = "flex items-center justify-between gap-2 rounded-md border border-navy-700 bg-navy-800 px-3 py-2";

  return (
    <section className={`${f} mt-8 rounded-lg border border-navy-700 bg-navy-900 p-4 text-xs text-azul-claro flex flex-col gap-3`}>
      <p className="text-crema font-semibold">Conexión con Instagram / WhatsApp (ManyChat)</p>
      <div className="flex flex-col gap-1">
        <p>{secreto ? "✅" : "⬜"} Clave del webhook (SETTER_WEBHOOK_SECRET)</p>
        <p>{apiKeyOk ? "✅" : "⬜"} Clave de la API de ManyChat (MANYCHAT_API_KEY) — para que el bot pueda contestar</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-crema">Cómo armar el flujo en ManyChat</p>
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>Automation → nuevo flujo con disparador <b className="text-crema">Default Reply</b> (o keyword / comentario de historia).</li>
          <li>Agregá una acción <b className="text-crema">External Request</b> con estos datos:</li>
        </ol>

        <div className={fila}><span><span className="text-azul">Método:</span> <b className="text-crema">POST</b></span></div>
        <div className={fila}>
          <span className="min-w-0 break-all"><span className="text-azul">URL:</span> <span className="text-crema">{URL_WEBHOOK}</span></span>
          <Copiar texto={URL_WEBHOOK} />
        </div>
        <div className={fila}>
          <span className="min-w-0 break-all">
            <span className="text-azul">Header:</span> <span className="text-crema">Authorization</span> = {" "}
            <span className="text-crema">{secreto ? (ver ? header : "Bearer ••••••••••••") : "(falta cargar SETTER_WEBHOOK_SECRET en Vercel)"}</span>
          </span>
          {secreto && (
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setVer(!ver)} className="rounded border border-navy-700 px-2 py-0.5 text-[10px] text-crema hover:border-dorado">{ver ? "Ocultar" : "Mostrar"}</button>
              <Copiar texto={header} />
            </span>
          )}
        </div>
        <p className="text-[11px]">⚠️ Esa clave es secreta: va solo en ManyChat, no la pases por chat ni la publiques.</p>

        <div className="rounded-md border border-navy-700 bg-navy-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span><span className="text-azul">Body</span> (tipo JSON)</span>
            <Copiar texto={BODY} label="Copiar body" />
          </div>
          <pre className="overflow-x-auto whitespace-pre text-[11px] text-crema">{BODY}</pre>
          <p className="mt-2 text-[11px]">En ManyChat, cada <span className="text-crema">{"{{…}}"}</span> se inserta con el botón <b className="text-crema">+</b> eligiendo el campo:</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
            {CAMPOS.map((c) => <li key={c.k}><span className="text-crema">{c.k}</span> → {c.de}</li>)}
          </ul>
        </div>
        <p className="text-[11px]">La respuesta del request no hay que mapearla: la app contesta “OK” al toque y el bot responde unos segundos después por la API de ManyChat (o deja el borrador si está en copiloto).</p>
      </div>
    </section>
  );
}
