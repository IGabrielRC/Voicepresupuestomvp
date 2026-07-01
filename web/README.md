# PresupuestoYA — Web (Frontend)

Editor de presupuestos + vista pública. Hecho con Vite + React + TypeScript + Tailwind.

## Quick start

Necesitas tener el backend corriendo en `http://localhost:3001` (ver `../backend/README.md`).

En otra terminal:

```bash
cd "C:\Users\Gabri\Downloads\1.Jobs\Proyecto de voice\web"
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Rutas

- `/` — Landing con botón "Probar demo" (crea un quote de ejemplo y te lleva al editor)
- `/q/:id` — Editor del presupuesto
- `/s/:slug` — Vista pública (lo que ve tu cliente)
- `/p/:contractorId` — Editor de tu perfil de empresa

## Setup paso a paso (para no-devs)

### 0. Prerrequisitos

- **Node.js** instalado (descárgalo de https://nodejs.org/, versión LTS). Si ya lo tienes, salta este paso.
- **Dos terminales PowerShell abiertos** (busca "PowerShell" en el menú inicio de Windows, ábrelo dos veces).

### 1. Levantar el BACKEND (en la primera terminal)

```powershell
cd "C:\Users\Gabri\Downloads\1.Jobs\Proyecto de voice\backend"
npm install
Copy-Item .env.example .env
notepad .env
```

En el Notepad, completa las 4 keys que tienes:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

Guarda el archivo (Ctrl+S) y cierra el Notepad. Después:

```powershell
npm run dev
```

Deberías ver: `[backend] listening on http://localhost:3001`. **Deja esta terminal abierta.**

### 2. Levantar el FRONTEND (en la segunda terminal)

```powershell
cd "C:\Users\Gabri\Downloads\1.Jobs\Proyecto de voice\web"
npm install
npm run dev
```

Deberías ver algo como `Local: http://localhost:5173/`. **Deja esta terminal abierta también.**

### 3. Probar en el navegador

Abre http://localhost:5173 en Chrome o Edge.

- Haz click en **"Probar demo ahora"** → te lleva al editor con un presupuesto de ejemplo.
- Edita lo que quieras, haz click en **Guardar**, después en **Compartir** → te genera un link público.
- Abre ese link en otra pestaña (o envíaselo a alguien por WhatsApp) → ves la vista que verá tu cliente.

### 4. (Opcional) Probar con una nota de voz real

Si quieres probar el flujo completo con tu bot de Telegram:

1. Instala `ngrok` desde https://ngrok.com/download.
2. En una tercera terminal:
   ```powershell
   ngrok http 3001
   ```
   Copia la URL HTTPS que imprime (algo como `https://abc-123.ngrok-free.app`).
3. Dile a Telegram dónde está tu backend:
   ```powershell
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://abc-123.ngrok-free.app/api/webhooks/telegram"
   ```
   (reemplaza `$TELEGRAM_BOT_TOKEN` con tu token real y la URL de ngrok).
4. Envíale una nota de voz a tu bot en Telegram. Te debería responder con un link al editor.

## Solución de problemas

- **"No se pudo conectar con el backend"** en la landing → el backend no está corriendo. Vuelve al paso 1.
- **"404 not_found"** al abrir un link → el `quote_id` o `slug` no existe en Supabase. Verifica en el dashboard de Supabase.
- **Errores rojos en la terminal al hacer `npm install`** → borra la carpeta `node_modules` y vuelve a correr `npm install`. Si persiste, envíame el error.
- **Tailwind no aplica estilos** → asegúrate de que `index.css` se importa en `main.tsx` (ya está) y de que el archivo `index.html` está en la raíz de `web/`.

## Personalización rápida

- Colores y tipografía: `tailwind.config.js` y `src/index.css`
- Textos de la landing: `src/pages/Landing.tsx`
- Prompt de Gemini: `../backend/src/services/gemini.ts`
- Mensajes de Telegram al contratista: `../backend/src/routes/telegram.ts`

## What's NOT here (yet)

- Tests
- Storybook
- Dark mode
- i18n (español only)
- React Router (las rutas se manejan con `window.location.pathname` para mantenerlo simple)
