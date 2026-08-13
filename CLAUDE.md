# MyMusicLoving — Reglas del proyecto

Extensión de Google Chrome que agrega canciones desde YouTube a playlists de Spotify con un clic.

## Stack y restricciones técnicas

- **Manifest V3** obligatorio (V2 está deprecado).
- **JavaScript vainilla** (ES2022+). Sin frameworks, sin bundlers, sin build step. La extensión debe cargarse directamente con "Cargar descomprimida" en `chrome://extensions`.
- **CSS puro** con variables CSS para theming. Sin Tailwind ni librerías de UI.
- OAuth 2.0 con **Authorization Code + PKCE** usando `chrome.identity.launchWebAuthFlow`. NUNCA usar Implicit Grant (deprecado) ni Client Secret en el cliente.
- Persistencia con `chrome.storage.local` (tokens, playlist por defecto, historial) y `chrome.storage.sync` solo para preferencias ligeras.

## Estructura de carpetas

```
MyMusicLoving/
├── manifest.json
├── src/
│   ├── background/        # Service worker: OAuth, llamadas a Spotify API
│   │   └── service-worker.js
│   ├── content/           # Content script inyectado en youtube.com
│   │   ├── content.js     # Detección de video, botón ❤️, modal de candidatos
│   │   └── content.css
│   ├── popup/             # Popup de la extensión (config + historial)
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── lib/
│       ├── spotify-api.js # Cliente de la Web API de Spotify
│       ├── title-parser.js# Limpieza de títulos de YouTube
│       └── storage.js     # Wrapper de chrome.storage
├── icons/                 # 16, 32, 48, 128 px
├── docs/                  # ARQUITECTURA.md, HISTORIAS_USUARIO.md
└── README.md
```

## Reglas de código

1. **Toda la comunicación con la API de Spotify vive en el service worker.** El content script y el popup se comunican con él vía `chrome.runtime.sendMessage`. Nunca hacer fetch a Spotify desde el content script.
2. **Manejo de tokens:** refresh automático cuando el access token expira (revisar `expires_at` antes de cada llamada). Si el refresh falla, pedir re-autenticación con notificación amable.
3. **Selectores de YouTube frágiles:** centralizar TODOS los selectores del DOM de YouTube en un solo objeto `SELECTORS` al inicio de `content.js`, con comentario de fecha. YouTube es una SPA: escuchar el evento `yt-navigate-finish` para detectar cambios de video, no solo `DOMContentLoaded`.
4. **Errores siempre visibles para el usuario:** ningún fallo silencioso. Toast de error con mensaje humano ("No encontré esa canción en Spotify 😕"), nunca stack traces.
5. **Nada de dependencias externas ni CDNs** en el content script (política de CSP de MV3).
6. **Idioma:** UI en español, código y comentarios en inglés.
7. Funciones pequeñas, JSDoc en las funciones públicas de `lib/`.

## Seguridad

- El Client ID de Spotify va en un archivo `config.js` (incluido en `.gitignore.example` como referencia; el ID de Spotify no es secreto, pero mantener el patrón).
- No pedir más scopes de Spotify que los necesarios: `playlist-modify-public playlist-modify-private playlist-read-private`.
- No registrar (log) tokens ni datos del usuario en consola en la versión final.

## Diseño / UX

- Estética: **sencillo, bonito, funcional**. Minimalista, bordes redondeados (12px), sombras suaves, transiciones de 150-200ms.
- Paleta: verde Spotify `#1DB954` para acciones positivas, fondo oscuro `#121212` en modal y popup (YouTube dark-friendly), texto `#FFFFFF`/`#B3B3B3`.
- El botón ❤️ se integra junto a los controles de like/share de YouTube sin romper el layout.
- Todo modal se cierra con `Esc` y clic fuera.

## Flujo de trabajo

- Implementar las historias de usuario en el orden definido en `docs/HISTORIAS_USUARIO.md` (por fases).
- Al terminar cada HU, indicar cómo probarla manualmente en Chrome.
- Commits atómicos por HU: `feat(HU-XX): descripción corta`.
