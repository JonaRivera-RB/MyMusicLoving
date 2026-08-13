# Historias de Usuario — MyMusicLoving

Decisiones de producto ya tomadas:
- Playlist **fija por defecto** ("MyMusicLoving"), con opción de cambiarla (global o puntualmente).
- El usuario **confirma entre 2-3 candidatos** antes de agregar (precisión sobre velocidad).
- Extras del MVP: **notificación bonita de confirmación** e **historial de canciones agregadas**.

Orden de implementación: Fase 1 → Fase 2 → Fase 3. No avanzar de fase sin que la anterior funcione end-to-end.

---

## Fase 1 — Fundación (auth + esqueleto)

### HU-01 · Conectar mi cuenta de Spotify
**Como** usuario, **quiero** conectar mi cuenta de Spotify desde la extensión, **para** poder agregar canciones a mis playlists.

Criterios de aceptación:
- [ ] En el popup hay un botón "Conectar con Spotify" cuando no hay sesión.
- [ ] Al hacer clic se abre el consentimiento oficial de Spotify (OAuth PKCE vía `launchWebAuthFlow`).
- [ ] Tras autorizar, el popup muestra mi nombre y avatar de Spotify.
- [ ] Los tokens quedan en `chrome.storage.local` y sobreviven al cierre del navegador.
- [ ] Existe botón "Desconectar" que borra tokens y vuelve al estado inicial.

### HU-02 · Sesión que no molesta
**Como** usuario, **quiero** que la sesión se renueve sola, **para** no tener que reconectar cada hora.

Criterios de aceptación:
- [ ] Si el access token expiró, se renueva automáticamente con el refresh token antes de cualquier llamada.
- [ ] Si el refresh falla, veo un toast amable pidiendo reconectar (nunca un error técnico).

### HU-03 · Ver el botón ❤️ en YouTube
**Como** usuario, **quiero** ver un botón ❤️ junto a los controles del video, **para** guardar la canción sin salir de YouTube.

Criterios de aceptación:
- [ ] El botón aparece en páginas `youtube.com/watch` junto a like/share, integrado al estilo de YouTube.
- [ ] Aparece también al navegar entre videos sin recargar (SPA: `yt-navigate-finish`).
- [ ] Si no estoy conectado a Spotify, el clic abre un aviso que me lleva a conectar.
- [ ] El botón no rompe ni tapa elementos de YouTube.

---

## Fase 2 — Núcleo (buscar, confirmar, agregar)

### HU-04 · Detección inteligente de la canción
**Como** usuario, **quiero** que la extensión identifique bien la canción del video, **para** que la búsqueda en Spotify sea certera.

Criterios de aceptación:
- [ ] Si el video tiene sección "Música en este video", se usan ese artista y título.
- [ ] Si no, se limpia el título del video: fuera `(Official Video)`, `[4K]`, `| Lyrics`, `#hashtags`, emojis, etc.
- [ ] Se detecta el patrón `Artista - Canción` cuando existe.
- [ ] `title-parser.js` tiene pruebas manuales documentadas con al menos 10 títulos reales de ejemplo.

### HU-05 · Confirmar entre candidatos ⭐ (decisión de producto)
**Como** usuario, **quiero** ver 2-3 opciones de Spotify y elegir la correcta, **para** no agregar versiones equivocadas (covers, remixes, lives).

Criterios de aceptación:
- [ ] Al hacer clic en ❤️ se abre un modal con hasta 3 candidatos: carátula, título, artista, álbum y duración.
- [ ] El mejor match aparece primero y resaltado.
- [ ] Puedo elegir con clic o con teclado (↑ ↓ Enter), y cerrar con Esc o clic fuera.
- [ ] Si no hay resultados, el modal ofrece editar la búsqueda manualmente y reintentar.
- [ ] El modal muestra a qué playlist se agregará, con link "cambiar playlist ▾" para ese envío puntual.

### HU-06 · Agregar a mi playlist por defecto
**Como** usuario, **quiero** que la canción confirmada se agregue a mi playlist por defecto, **para** tener mi música organizada en un solo lugar.

Criterios de aceptación:
- [ ] Al confirmar un candidato, la canción se agrega a la playlist por defecto en menos de 2s (red normal).
- [ ] Si no existe playlist por defecto configurada, la extensión ofrece crear "MyMusicLoving" automáticamente.
- [ ] Los errores de la API (401, 403, 429, red) muestran mensajes humanos y accionables.

### HU-07 · Notificación bonita de confirmación ⭐ (extra elegido)
**Como** usuario, **quiero** una confirmación visual agradable al agregar una canción, **para** saber que todo salió bien sin interrumpir el video.

Criterios de aceptación:
- [ ] Toast con animación suave (entra/sale, ~3s) con carátula mini, "✅ Agregada a {playlist}" y link "Abrir en Spotify".
- [ ] No tapa los controles del reproductor de YouTube.
- [ ] Variante de error con el mismo estilo (ícono y color distintos).

---

## Fase 3 — Confort (configuración + historial)

### HU-08 · Elegir mi playlist por defecto
**Como** usuario, **quiero** elegir cuál de mis playlists es la default desde el popup, **para** adaptar la extensión a cómo organizo mi música.

Criterios de aceptación:
- [ ] El popup lista mis playlists (nombre + portada) con buscador si hay muchas.
- [ ] Puedo marcar una como default; el cambio aplica de inmediato.
- [ ] Botón "Crear playlist MyMusicLoving" si prefiero una nueva.

### HU-09 · Historial de canciones agregadas ⭐ (extra elegido)
**Como** usuario, **quiero** ver el historial de lo que he agregado, **para** recordar mis descubrimientos y volver a ellos.

Criterios de aceptación:
- [ ] Pestaña "Historial" en el popup: carátula, canción, artista, playlist destino y fecha relativa ("hace 2 días").
- [ ] Cada entrada tiene link para abrir la canción en Spotify y link al video de YouTube original.
- [ ] Se guardan máximo 200 entradas (las más antiguas se descartan).
- [ ] Botón "Limpiar historial" con confirmación.

### HU-10 · Pulido visual
**Como** usuario, **quiero** que todo se sienta sencillo, bonito y funcional, **para** disfrutar usar la extensión.

Criterios de aceptación:
- [ ] Popup y modal siguen la paleta definida en CLAUDE.md (dark, acento verde Spotify).
- [ ] Estados de carga con skeletons o spinner sutil (nunca pantallas en blanco).
- [ ] Íconos de la extensión en 16/32/48/128 px.
- [ ] Revisión final: cero errores en la consola en uso normal.

---

## Backlog futuro (NO implementar en MVP)
- Evitar duplicados en la playlist (avisar "ya está en tu playlist").
- Atajo de teclado global para agregar sin clic.
- Soporte para YouTube Music.
- Estadísticas del historial (artistas más agregados).
