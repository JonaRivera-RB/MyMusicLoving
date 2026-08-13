# Arquitectura — MyMusicLoving

Extensión de Chrome (Manifest V3) que permite agregar la canción del video de YouTube que estás viendo a una playlist de Spotify con un clic.

## Visión general

```
┌─────────────────────────── Chrome ───────────────────────────┐
│                                                               │
│  youtube.com                      Extensión MyMusicLoving     │
│  ┌───────────────┐   mensajes    ┌─────────────────────────┐  │
│  │ Content Script│◄────────────►│  Service Worker (MV3)    │  │
│  │  · botón ❤️   │  runtime      │  · OAuth PKCE            │  │
│  │  · lee título │               │  · Spotify Web API       │  │
│  │  · modal      │               │  · refresh de tokens     │  │
│  └───────────────┘               └───────────┬─────────────┘  │
│  ┌───────────────┐                           │ fetch          │
│  │    Popup      │◄──────────────────────────┤                │
│  │  · config     │        chrome.storage     ▼                │
│  │  · historial  │       ┌──────────┐   Spotify Web API       │
│  └───────────────┘       │ storage  │   accounts.spotify.com  │
│                          └──────────┘   api.spotify.com       │
└───────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Content Script (`src/content/`)
Se inyecta en `https://www.youtube.com/watch*`.

Responsabilidades:
- Detectar el video actual y sus cambios de navegación (evento `yt-navigate-finish`, porque YouTube es SPA).
- Extraer metadatos, en orden de preferencia:
  1. Sección **"Música en este video"** de la descripción (artista + canción ya separados → matching casi perfecto).
  2. Título del video + nombre del canal como fallback.
- Renderizar el **botón ❤️** junto a los controles de like/share.
- Mostrar el **modal de candidatos** (2-3 resultados de Spotify con carátula, artista, álbum) para que el usuario confirme.
- Mostrar **toasts** de confirmación/error.

No hace llamadas de red: todo pasa por mensajes al service worker.

### 2. Service Worker (`src/background/service-worker.js`)
Cerebro de la extensión. Responsabilidades:
- **OAuth 2.0 + PKCE** contra `accounts.spotify.com` usando `chrome.identity.launchWebAuthFlow`. Guarda `access_token`, `refresh_token`, `expires_at` en `chrome.storage.local`.
- **Refresh automático** del token antes de cada llamada si está por expirar.
- **Cliente de Spotify Web API** (`src/lib/spotify-api.js`):
  - `GET /v1/search` — buscar canción (type=track, limit=3, market=from_token)
  - `GET /v1/me/playlists` — listar playlists del usuario
  - `POST /v1/users/{id}/playlists` — crear la playlist "MyMusicLoving" si no existe
  - `POST /v1/playlists/{id}/tracks` — agregar canción
- Router de mensajes: `SEARCH_TRACK`, `ADD_TRACK`, `GET_PLAYLISTS`, `GET_SETTINGS`, `SET_DEFAULT_PLAYLIST`, `CREATE_DEFAULT_PLAYLIST`, `AUTH_STATUS`, `LOGIN`, `LOGOUT`, `GET_HISTORY`, `CLEAR_HISTORY`.

### 3. Popup (`src/popup/`)
Panel al hacer clic en el ícono de la extensión:
- Estado de sesión (conectar / desconectar Spotify, avatar y nombre del usuario).
- **Selector de playlist por defecto** (con opción de crear "MyMusicLoving" automáticamente).
- **Historial** de canciones agregadas (carátula, título, artista, fecha, link a Spotify).

### 4. Librerías compartidas (`src/lib/`)
- `title-parser.js`: limpieza de títulos de YouTube. Elimina patrones tipo `(Official Video)`, `[HD]`, `| lyrics`, `#shorts`, emojis, `ft./feat.` normalizado, y separa `Artista - Canción` cuando existe el guion.
- `storage.js`: wrapper con promesas sobre `chrome.storage`.
- `spotify-api.js`: cliente con manejo de rate limits (respetar header `Retry-After` en 429).
- `escape-html.js`: escapado de texto para las plantillas de `innerHTML`. Script clásico (sin `import`/`export`) porque lo comparten el content script, que no admite módulos ES, y el popup.

## Flujos clave

### Flujo A — Autenticación (primera vez)
1. Usuario abre el popup → "Conectar con Spotify".
2. Service worker genera `code_verifier` + `code_challenge` (PKCE).
3. `launchWebAuthFlow` abre la pantalla de consentimiento de Spotify.
4. Callback con `code` → intercambio por tokens en `accounts.spotify.com/api/token`.
5. Tokens guardados en `chrome.storage.local`. Popup muestra el perfil.

### Flujo B — Agregar canción (camino feliz)
1. Usuario ve un video → content script detecta metadatos y muestra el botón ❤️.
2. Clic en ❤️ → mensaje `SEARCH_TRACK` al service worker.
3. Service worker limpia el título, busca en Spotify, responde con hasta 3 candidatos.
4. Content script muestra el modal → usuario elige uno.
5. Mensaje `ADD_TRACK` → service worker agrega a la playlist por defecto.
6. Toast de confirmación ("✅ Agregada a MyMusicLoving") + registro en historial.

### Flujo C — Cambiar de playlist puntualmente
En el modal de candidatos hay un link "cambiar playlist ▾" que despliega las playlists del usuario para ese envío puntual, sin cambiar la default.

## Modelo de datos (chrome.storage.local)

```json
{
  "auth": { "access_token": "…", "refresh_token": "…", "expires_at": 1730000000 },
  "settings": { "default_playlist_id": "37i9…", "default_playlist_name": "MyMusicLoving" },
  "history": [
    {
      "track_id": "4uLU…", "name": "Song", "artist": "Artist",
      "cover_url": "https://…", "spotify_url": "https://open.spotify.com/track/…",
      "playlist_name": "MyMusicLoving", "added_at": "2026-07-09T18:30:00Z",
      "yt_video_id": "dQw4w9WgXcQ"
    }
  ]
}
```
El historial se limita a los últimos 200 registros (FIFO).

## Permisos del manifest

```json
{
  "permissions": ["storage", "identity"],
  "host_permissions": ["https://api.spotify.com/*", "https://accounts.spotify.com/*"],
  "content_scripts": [{ "matches": ["https://www.youtube.com/*"] }]
}
```
Principio: pedir lo mínimo necesario.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| YouTube cambia su DOM | Selectores centralizados en un objeto único; fallback a `document.title` |
| Matching incorrecto | Confirmación humana con 2-3 candidatos (decisión de producto) |
| Token expirado | Refresh automático; si falla, toast pidiendo reconectar |
| Refresh concurrente | Spotify rota el `refresh_token` con PKCE: dos renovaciones a la vez invalidarían la sesión. `ensureValidAccessToken()` comparte una única renovación en curso (`refreshInFlight`) |
| Texto de Spotify en el DOM | Nombres de canción, artista y playlist son texto de usuario: se interpolan siempre con `escapeHtml()` |
| Rate limit de Spotify (429) | Respetar `Retry-After`, reintento único |
| Modo Development de Spotify (25 usuarios) | Suficiente para uso personal; Extended Quota solo si se publica |
| ID de extensión distinto al publicar | Fijar `"key"` en el manifest desde el borrador de la Web Store antes del primer release (ver README) |

## Requisitos previos (setup manual, una sola vez)

1. Crear app en https://developer.spotify.com/dashboard
2. Redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/callback` (el ID se obtiene al cargar la extensión en Chrome la primera vez).
3. Copiar el Client ID a `src/lib/config.js`.
