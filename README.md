# REBUILD · Chatbot (Setter) — guía para tu Claude Code

Sos el Claude Code de **May**. Este es un **proyecto propio y separado** para el **chatbot (Setter)**. Hoy el chatbot
vive DENTRO de la app (`/panel/setter`); la idea es **mudarlo acá** para que sea un proyecto propio que May arma y
publica ella misma. Contestale siempre en lenguaje simple.

## Qué es y qué NO
- Es **su propio proyecto** (esta carpeta / este repo). No tiene el código de la app → **no puede tocar la app**.
- **Lee** la info de la app en **solo lectura** (clientes, etc.).
- **Guarda** lo del chatbot (biblioteca, correcciones, aprendizaje, guiones) en su **propio espacio**: el schema
  **`chatbot`** de la base.
- Separado → **May lo publica sola** (su propio Vercel) sin riesgo para la app.

## IMPORTANTE: el chatbot de hoy sigue vivo
El chatbot actual (`/panel/setter`, dentro de la app) **sigue funcionando** hasta que esta versión nueva esté lista.
NO lo apagues ni lo toques. Cuando la nueva esté andando, Nico cambia el link del panel para que apunte acá. La
mudanza de los datos que el chatbot ya tiene se coordina con Nico en ese momento (no la hagas sola).

## El código actual está en `referencia/` (para portar)
- `referencia/app-panel-setter/` = la pantalla del Setter hoy (`src/app/panel/setter`).
- `referencia/lib-setter/` = la lógica (`src/lib/setter`).
Usalo como **mapa** para rearmar el chatbot acá como proyecto independiente. OJO: ese código usa la "llave maestra"
de la app y tablas en `public.*`. Acá se rehace para: leer la app con `may_ro` (solo lectura) y guardar lo suyo en
`chatbot.*`.

## Conexión a los datos (ya está enchufada)
En `.env.local` está `APP_DB_URL` = usuario **`may_ro`** (solo lectura). Garantizado por la base:
- ✅ `select ... from public.<tabla>` → lee la app.
- ⛔ escribir sobre `public.*` → la base lo **rechaza**.
- ✅ `chatbot.<tabla>` → acá SÍ crea y escribe (las tablas del chatbot). Helper en `src/lib/db.ts`.

## Arrancar
```
npm install
npm run dev     # http://localhost:3000 → "Conectado a la app ✅ — N clientes"
```
Después, portá el chatbot desde `referencia/` hacia este proyecto, guardando sus datos en `chatbot.*`.

## Publicar (lo hace May sola)
Proyecto Vercel aparte. `vercel --prod` desde esta carpeta publica SOLO el chatbot (no toca la app). Cargá
`APP_DB_URL` en las Environment Variables de ESE proyecto.

## Reglas
- Nunca pidas ni uses la service-role key de la app. Solo `may_ro` (lectura app + escritura en `chatbot.*`).
- El chatbot viejo (en la app) no se toca hasta que Nico haga el switch.
