# Prompt inicial para Claude Code

Copia y pega esto en tu primera sesión de Claude Code dentro de la carpeta `MyMusicLoving`:

---

Lee primero `CLAUDE.md`, `docs/ARQUITECTURA.md` y `docs/HISTORIAS_USUARIO.md` — ahí está toda la definición del proyecto MyMusicLoving: una extensión de Chrome (Manifest V3, JS vainilla, sin build step) que agrega la canción del video de YouTube que estoy viendo a una playlist de Spotify.

Quiero que trabajemos por fases, en el orden de las historias de usuario:

1. Empieza por la **Fase 1** (HU-01 a HU-03): estructura de carpetas según la arquitectura, `manifest.json`, OAuth PKCE con `chrome.identity.launchWebAuthFlow`, popup básico con conectar/desconectar, y el botón ❤️ inyectado en YouTube.
2. Al terminar cada HU, dime exactamente cómo probarla manualmente en Chrome antes de continuar.
3. No avances a la Fase 2 hasta que yo confirme que la Fase 1 funciona.

Contexto de mi setup:
- Ya creé mi app en el Spotify Developer Dashboard. Mi Client ID es: `PEGA_TU_CLIENT_ID_AQUI`
- Todavía NO tengo el Extension ID (sale al cargar la extensión la primera vez), así que deja la Redirect URI parametrizada y recuérdame actualizarla en el dashboard de Spotify cuando la tenga.

Respeta estrictamente las reglas de `CLAUDE.md`: comunicación con Spotify solo desde el service worker, selectores de YouTube centralizados, errores siempre visibles con toasts, UI en español, estética dark minimalista con acento `#1DB954`.

---

## Checklist previo (hazlo TÚ antes de abrir Claude Code)

- [ ] Crear app en https://developer.spotify.com/dashboard → copiar el **Client ID**
- [ ] Tener Node.js 18+ y Claude Code instalado (`npm install -g @anthropic-ai/claude-code`)
- [ ] Copiar estos 4 archivos a la carpeta `MyMusicLoving` del escritorio:
  - `CLAUDE.md` (en la raíz)
  - `docs/ARQUITECTURA.md`
  - `docs/HISTORIAS_USUARIO.md`
  - este archivo (opcional, solo referencia)
- [ ] Abrir terminal: `cd ~/Desktop/MyMusicLoving` → `claude`
- [ ] Pegar el prompt de arriba con tu Client ID real

## Después de la primera carga de la extensión

1. Ve a `chrome://extensions` → activa "Modo de desarrollador" → "Cargar descomprimida" → selecciona la carpeta.
2. Copia el **ID de la extensión** que aparece en la tarjeta.
3. En el Spotify Dashboard, agrega la Redirect URI: `https://TU_EXTENSION_ID.chromiumapp.org/callback`
4. Díselo a Claude Code para que actualice `config.js` si hace falta.
