---
title: Política de privacidad — MyMusicLoving
permalink: /privacidad/
---

# Política de privacidad — MyMusicLoving

**Última actualización: 13 de agosto de 2026**

MyMusicLoving es una extensión de Google Chrome que permite agregar la canción
del video de YouTube que estás viendo a una playlist de Spotify.

Esta política explica qué datos maneja la extensión y qué hace con ellos.
El resumen es simple: **la extensión no tiene servidores propios y no recopila
ni transmite tus datos a nadie más que a Spotify.**

## Qué datos maneja la extensión

Todo se guarda **únicamente en tu navegador**, mediante `chrome.storage.local`:

| Dato | Para qué se usa |
|---|---|
| Tokens de acceso y de renovación de Spotify | Autorizar las llamadas a la API de Spotify en tu nombre |
| ID y nombre de tu playlist por defecto | Saber dónde agregar las canciones |
| Historial de canciones agregadas (máx. 200) | Mostrarte la pestaña "Historial" del popup |

El historial guarda, por cada entrada: título de la canción, artista, álbum,
URL de la portada, nombre de la playlist de destino, ID del video de YouTube y
la fecha en que la agregaste.

Además, mientras estás en una página de YouTube, la extensión lee el **título
del video** y, si existe, la sección "Música en este video", para construir la
búsqueda en Spotify. Esa información no se almacena salvo que agregues la
canción, en cuyo caso queda en el historial local descrito arriba.

## A dónde se envían tus datos

Los datos salen de tu navegador **solo hacia Spotify**, a estos dominios:

- `accounts.spotify.com` — para iniciar sesión y renovar tu sesión (OAuth 2.0
  con PKCE).
- `api.spotify.com` — para buscar canciones, listar tus playlists y agregar
  canciones a ellas.

El uso que Spotify haga de esos datos se rige por su propia política de
privacidad: https://www.spotify.com/legal/privacy-policy/

## Qué NO hace la extensión

- **No** tiene servidores propios ni envía datos al desarrollador.
- **No** recopila analítica, telemetría ni estadísticas de uso.
- **No** vende, alquila ni comparte tus datos con terceros.
- **No** usa cookies de seguimiento ni publicidad.
- **No** lee ni modifica páginas fuera de `youtube.com`.
- **No** accede a tu historial de navegación.

## Permisos que solicita y por qué

| Permiso | Motivo |
|---|---|
| `storage` | Guardar tu sesión de Spotify, tu playlist por defecto y tu historial en tu propio navegador |
| `identity` | Abrir la pantalla oficial de consentimiento de Spotify para iniciar sesión |
| `https://api.spotify.com/*` | Buscar canciones y agregarlas a tus playlists |
| `https://accounts.spotify.com/*` | Intercambiar y renovar los tokens de tu sesión |
| Acceso a `https://www.youtube.com/*` | Mostrar el botón ❤️ y leer el título del video que estás viendo |

Los permisos de Spotify se limitan a los estrictamente necesarios:
`playlist-modify-public`, `playlist-modify-private` y `playlist-read-private`.
La extensión **no** pide acceso a tu reproducción, tu biblioteca ni tus datos
personales de Spotify.

## Cómo borrar tus datos

- **Cerrar sesión:** el botón "Desconectar" del popup borra los tokens de
  Spotify de tu navegador.
- **Borrar el historial:** el botón "Limpiar historial" de la pestaña
  "Historial" lo elimina por completo.
- **Borrarlo todo:** desinstalar la extensión elimina todo su almacenamiento
  local de forma permanente.

Para revocar el acceso de MyMusicLoving a tu cuenta de Spotify, entra a
https://www.spotify.com/account/apps/ y retira el permiso desde ahí.

## Menores de edad

La extensión no está dirigida a menores de 13 años y no recopila
deliberadamente datos de ellos.

## Cambios en esta política

Si esta política cambia, se actualizará la fecha del encabezado y la nueva
versión quedará publicada en esta misma dirección.

## Contacto

Para dudas sobre privacidad: **jonathanriveramb@gmail.com**
