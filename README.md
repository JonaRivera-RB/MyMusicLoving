<img src="icons/icon-128.png" width="72" align="right" alt="">

# MyMusicLoving

Extensión de Google Chrome que agrega la canción del video de YouTube que estás
viendo a una playlist de Spotify con un clic.

- Botón ❤️ integrado junto a los controles de like/share de YouTube.
- Detecta la canción desde la sección "Música en este video" o limpiando el
  título del video.
- Modal para confirmar entre hasta 3 candidatos de Spotify (con carátula,
  artista, álbum y duración) antes de agregar nada.
- Playlist por defecto configurable, e historial de las últimas 200 canciones.

## Este repositorio como banco de pruebas

Además de ser una extensión que uso, este repositorio es mi base para comparar
herramientas de programación agéntica: **Claude Code**, **Cursor**, **Codex** y
**Kiro**.

La idea es tener el proyecto especificado *antes* de escribir código, para que
lo que varíe entre una herramienta y otra sea la herramienta, no el encargo.
La especificación se escribió primero y no se toca:

| Documento | Qué fija |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas no negociables: MV3, JS vainilla sin build step, PKCE, dónde vive cada responsabilidad, idioma y estética |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Componentes, flujos, modelo de datos y riesgos previstos |
| [docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md) | 10 historias en 3 fases, cada una con criterios de aceptación verificables |

Las condiciones que se mantienen iguales para todas:

- Mismo alcance y mismo orden: las 10 HU por fases, sin adelantarse.
- Una HU está hecha cuando cumple sus criterios de aceptación, no cuando corre.
- Sin dependencias ni build step: nada queda escondido detrás de un bundler.
- Cada cambio se prueba a mano en Chrome y se documenta cómo hacerlo.

Lo que me interesa medir no es cuál escribe código más rápido, sino cuál
respeta una especificación que ya existe, cuál encuentra sus propios errores y
cuál distingue un bug real de uno inventado.

### Registro

**MVP (HU-01 a HU-10) — Claude Code.** Las 10 historias implementadas por fases
a partir de [PROMPT_INICIAL.md](PROMPT_INICIAL.md), con prueba manual en Chrome
al cerrar cada una.

**Auditoría y correcciones — Claude Code.** Revisión del código ya escrito.
Encontró que dos renovaciones simultáneas del token cerraban la sesión (Spotify
rota el `refresh_token` con PKCE), que el buscador de playlists perdía el foco a
la primera tecla, que el texto venido de Spotify se interpolaba sin escapar, que
el modal dejaba pasar los atajos de teclado de YouTube y que el `MutationObserver`
seguía activo en páginas donde nunca iba a insertar el botón. Cada corrección se
verificó con una prueba que falla contra el código anterior.

**Preparación de release — Claude Code.** Iconos, política de privacidad, script
de empaquetado con validaciones previas, README y repositorio.

Las entradas de Cursor, Codex y Kiro se añadirán conforme cada herramienta
trabaje sobre este mismo código y la misma especificación.

## Requisitos

- Google Chrome 102 o superior.
- Una cuenta de Spotify (funciona con cuentas gratuitas).
- Una app registrada en el [dashboard de Spotify](https://developer.spotify.com/dashboard).

## Instalación para desarrollo

**1. Copia la configuración**

```bash
cp src/lib/config.example.js src/lib/config.js
```

**2. Carga la extensión en Chrome**

Ve a `chrome://extensions`, activa "Modo de desarrollador" y pulsa
**"Cargar descomprimida"** apuntando a la raíz de este repositorio.

**3. Averigua tu redirect URI**

Depende del ID que Chrome le asignó a tu copia local. Abre la consola del
service worker (en `chrome://extensions`, enlace "service worker" bajo la
extensión) y ejecuta:

```js
chrome.identity.getRedirectURL("callback")
// -> https://<extension-id>.chromiumapp.org/callback
```

**4. Configura la app de Spotify**

En el dashboard de Spotify, edita tu app y añade esa URL exacta en
**Redirect URIs**. Copia el **Client ID** y pégalo en `src/lib/config.js`.

Mientras la app esté en *Development Mode*, Spotify solo permite 25 usuarios:
añade tu propia cuenta en **User Management** o el login fallará.

**5. Recarga la extensión** y abre cualquier video de YouTube.

> Al recargar la extensión, recarga también las pestañas de YouTube abiertas:
> el content script anterior queda huérfano hasta que se recarga la página.

## Estructura

```
MyMusicLoving/
├── manifest.json
├── icons/                  # icon.svg (fuente) + PNG 16/32/48/128
├── scripts/
│   ├── build-icons.sh      # regenera los PNG desde el SVG
│   └── package.sh          # genera el ZIP para la Chrome Web Store
├── src/
│   ├── background/         # service worker: OAuth y llamadas a Spotify
│   ├── content/            # botón ❤️, modal y toasts en YouTube
│   ├── popup/              # configuración e historial
│   └── lib/                # cliente de Spotify, PKCE, parser, storage
└── docs/                   # arquitectura, historias de usuario, privacidad
```

Toda la comunicación con la API de Spotify vive en el service worker; el
content script y el popup hablan con él por `chrome.runtime.sendMessage`.
Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Pruebas

No hay framework de tests (la extensión no tiene build step). Las pruebas son:

- **Parser de títulos:** abre `src/lib/title-parser.test.html` directamente en
  Chrome. Valida `parseYoutubeTitle()` contra 11 títulos reales de YouTube.
- **Manuales:** los criterios de aceptación de
  [docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md).

## Publicar en la Chrome Web Store

**1. Genera el paquete**

```bash
./scripts/package.sh    # -> dist/mymusicloving-<version>.zip
```

El script valida que exista `config.js` con un Client ID real y que estén los
cuatro iconos, y excluye docs, scripts, `config.example.js` y los archivos de
prueba.

**2. Fija el ID de la extensión ⚠️ (hazlo antes del primer release público)**

`chrome.identity.getRedirectURL()` deriva la redirect URI del ID de la
extensión, y ese ID **cambia** entre tu copia local y la versión publicada. Si
no lo fijas, el login de Spotify fallará para todos tus usuarios.

1. Sube el ZIP como borrador en el
   [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (sin
   publicarlo todavía).
2. En el ítem, ve a **Package → View public key**.
3. Copia esa clave y añádela a `manifest.json` como campo `"key"` (al mismo
   nivel que `"name"`).
4. Recarga la extensión localmente: ahora tu ID local es idéntico al de
   producción.
5. Registra la redirect URI de ese ID en el dashboard de Spotify.
6. Vuelve a empaquetar con `./scripts/package.sh` y sube ese ZIP.

**3. Solicita Extended Quota Mode a Spotify**

En *Development Mode* tu app está limitada a 25 usuarios añadidos a mano. Para
abrirla al público hay que pedir
[Extended Quota Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
desde el dashboard. Piden una descripción de la app y un video demo del flujo,
y el proceso tarda semanas: empieza pronto.

**4. Ficha de la Store**

- **Política de privacidad (obligatoria):** ya publicada en
  **https://jonarivera-rb.github.io/MyMusicLoving/privacidad/** — pega ese
  enlace en la pestaña "Privacy" del dashboard. La fuente es
  [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md); GitHub Pages la sirve desde la
  carpeta `/docs` de `main`, así que se actualiza sola con cada push.
- **Screenshots:** 1280×800 o 640×400, entre 1 y 5. Las útiles son el botón ❤️
  en un video, el modal de candidatos, el toast de confirmación y el popup con
  el historial.
- **Icono de tienda:** 128×128, ya está en `icons/icon-128.png`.
- **Justificación de permisos:** hay una tabla lista para copiar en
  [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md#permisos-que-solicita-y-por-qué).
- **Uso de datos:** declara que la extensión *no* recopila datos. Nada sale del
  navegador salvo hacia Spotify, y no hay servidores propios.

## Licencia

MIT — ver [LICENSE](LICENSE).

Este proyecto no está afiliado a Spotify AB ni a Google LLC.
