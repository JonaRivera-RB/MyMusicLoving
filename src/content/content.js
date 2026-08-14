// Selectores del DOM de YouTube — verificados 2026-07-09. YouTube es una SPA
// y puede cambiar estos selectores sin aviso; si algo deja de funcionar,
// revisar aquí primero.
const SELECTORS = {
  actionsContainer:
    "ytd-watch-metadata #top-level-buttons-computed, ytd-watch-metadata #actions",
  videoTitle: "ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string",
  // Best-effort: la sección "Música en este video" cambia de markup seguido.
  // Si no se encuentra, se hace fallback silencioso al título del video.
  musicSection: "ytd-video-description-music-section-renderer",
};

const BUTTON_ID = "mml-heart-button";
const MODAL_ID = "mml-modal";
const TOAST_ID = "mml-toast";

// El content script se inyecta en toda youtube.com (hace falta: en una SPA la
// inyección ocurre al cargar el documento, así que entrar por la home y luego
// abrir un video no dispararía ninguna otra). Pero observar todo el body sin
// límite en páginas donde el botón nunca se va a insertar cuesta CPU, así que
// solo observamos en /watch y con un tope de tiempo.
const OBSERVER_TIMEOUT_MS = 15_000;

let observer = null;
let observerTimeoutId = null;

// ---------- Mensajería con el service worker ----------

/**
 * Envía un mensaje al service worker. Si el canal está roto (la extensión se
 * actualizó o recargó con la pestaña abierta) devuelve un error legible en
 * lugar de rechazar la promesa y dejar el clic sin respuesta.
 */
async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return {
      ok: false,
      error: "MyMusicLoving se actualizó. Recarga la página de YouTube 🔄",
    };
  }
}

// ---------- Botón ❤️ ----------

function createHeartButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.className = "mml-heart-btn";
  button.type = "button";
  button.title = "Agregar a Spotify con MyMusicLoving";
  button.textContent = "❤️";
  button.addEventListener("click", handleHeartClick);
  return button;
}

function injectHeartButton() {
  const container = document.querySelector(SELECTORS.actionsContainer);
  if (!container) return false;
  if (document.getElementById(BUTTON_ID)) return true;

  container.appendChild(createHeartButton());
  return true;
}

function isWatchPage() {
  return window.location.pathname === "/watch";
}

function stopObserving() {
  observer?.disconnect();
  observer = null;
  clearTimeout(observerTimeoutId);
  observerTimeoutId = null;
}

function waitForActionsContainer() {
  stopObserving();
  if (!isWatchPage()) return;
  if (injectHeartButton()) return;

  observer = new MutationObserver(() => {
    // Si YouTube navegó fuera de /watch mientras esperábamos, ya no aplica.
    if (!isWatchPage() || injectHeartButton()) stopObserving();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Red de seguridad: si el contenedor no aparece (YouTube cambió su DOM),
  // dejamos de observar en vez de escuchar el resto de la sesión.
  observerTimeoutId = setTimeout(stopObserving, OBSERVER_TIMEOUT_MS);
}

function handleNavigate() {
  const oldButton = document.getElementById(BUTTON_ID);
  if (oldButton) oldButton.remove();
  closeModal();
  waitForActionsContainer();
}

// ---------- Extracción de contexto del video (HU-04) ----------

function getRawVideoTitle() {
  const el = document.querySelector(SELECTORS.videoTitle);
  if (el?.textContent?.trim()) return el.textContent.trim();
  return document.title.replace(/\s*-\s*YouTube$/, "").trim();
}

function tryExtractFromMusicSection() {
  try {
    const section = document.querySelector(SELECTORS.musicSection);
    if (!section) return null;

    const texts = Array.from(section.querySelectorAll("yt-formatted-string"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    if (texts.length < 2) return null;

    // Heurística: primera línea = canción, segunda = artista.
    return { title: texts[0], artist: texts[1] };
  } catch {
    return null;
  }
}

function getVideoContext() {
  const fromMusicSection = tryExtractFromMusicSection();
  if (fromMusicSection) return fromMusicSection;

  return parseYoutubeTitle(getRawVideoTitle());
}

function getCurrentVideoId() {
  return new URL(window.location.href).searchParams.get("v");
}

// ---------- Flujo de búsqueda + confirmación (HU-05 / HU-06) ----------

async function handleHeartClick() {
  const status = await sendMessage({ type: "AUTH_STATUS" });
  if (!status.ok) {
    showToast(status.error ?? "No se pudo hablar con Spotify.", "error");
    return;
  }
  if (!status.authenticated) {
    showToast("Conecta tu cuenta de Spotify desde el ícono de la extensión 🎧", "error");
    return;
  }

  const context = getVideoContext();
  await runSearch(context);
}

async function runSearch(query) {
  openModal({ state: "loading" });
  const response = await sendMessage({ type: "SEARCH_TRACK", query });

  if (!response.ok) {
    closeModal();
    showToast(response.error ?? "No se pudo buscar la canción en Spotify.", "error");
    return;
  }

  if (response.candidates.length === 0) {
    openModal({ state: "empty", query });
    return;
  }

  openModal({ state: "candidates", candidates: response.candidates, selectedIndex: 0 });
}

async function confirmCandidate(candidate, overridePlaylist) {
  openModal({ state: "adding" });

  const response = await sendMessage({
    type: "ADD_TRACK",
    payload: {
      track: candidate,
      playlistId: overridePlaylist?.id,
      playlistName: overridePlaylist?.name,
      ytVideoId: getCurrentVideoId(),
    },
  });

  closeModal();

  if (!response.ok) {
    showToast(response.error ?? "No se pudo agregar la canción.", "error");
    return;
  }

  if (response.duplicate) {
    showToast(
      `Ya estaba en ${response.playlist_name} 🎵`,
      "info",
      candidate.cover_url,
      candidate.external_url,
    );
    return;
  }

  showToast(
    `✅ Agregada a ${response.playlist_name}`,
    "success",
    candidate.cover_url,
    candidate.external_url,
  );
}

// ---------- Modal de candidatos ----------

let modalState = null;

function closeModal() {
  document.getElementById(MODAL_ID)?.remove();
  window.removeEventListener("keydown", handleModalKeydown, true);
  modalState = null;
}

function openModal(state) {
  modalState = state;
  renderModal();
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderModal() {
  let overlay = document.getElementById(MODAL_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.className = "mml-modal-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    // En captura sobre window: es el primer punto del recorrido del evento, así
    // ninguna tecla llega a los atajos de YouTube mientras el modal está abierto
    // (escribir "k" pausaba el video, los números saltaban de minuto).
    window.addEventListener("keydown", handleModalKeydown, true);
  }

  overlay.innerHTML = `<div class="mml-modal">${renderModalBody()}</div>`;
  wireModalEvents(overlay);
}

function renderModalBody() {
  if (!modalState) return "";

  if (modalState.state === "loading" || modalState.state === "adding") {
    const label = modalState.state === "loading" ? "Buscando en Spotify…" : "Agregando…";
    return `<div class="mml-modal__spinner-row"><div class="mml-spinner"></div><span>${label}</span></div>`;
  }

  if (modalState.state === "empty") {
    return `
      <p class="mml-modal__title">Sin resultados</p>
      <p class="mml-modal__hint">No encontré esa canción en Spotify. Prueba buscar manualmente:</p>
      <input id="mml-manual-search" class="mml-input" type="text" placeholder="Artista - canción" />
      <button id="mml-retry-btn" class="mml-btn mml-btn--primary" type="button">Buscar de nuevo</button>
    `;
  }

  const { candidates, selectedIndex, playlistPickerOpen, playlists, targetPlaylist } = modalState;

  const cards = candidates
    .map((candidate, index) => {
      const selected = index === selectedIndex;
      return `
        <li class="mml-candidate ${selected ? "mml-candidate--selected" : ""}" data-index="${index}">
          ${
            candidate.cover_url
              ? `<img class="mml-candidate__cover" src="${escapeHtml(candidate.cover_url)}" alt="" />`
              : `<div class="mml-candidate__cover mml-candidate__cover--placeholder">🎵</div>`
          }
          <div class="mml-candidate__info">
            <span class="mml-candidate__name">${escapeHtml(candidate.name)}${index === 0 ? " · mejor coincidencia" : ""}</span>
            <span class="mml-candidate__meta">${escapeHtml(candidate.artist)} · ${escapeHtml(candidate.album)} · ${formatDuration(candidate.duration_ms)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  const playlistLabel = escapeHtml(targetPlaylist?.name ?? "tu playlist por defecto");

  return `
    <p class="mml-modal__title">Elige la canción correcta</p>
    <ul class="mml-candidate-list">${cards}</ul>
    <div class="mml-modal__footer">
      <span class="mml-modal__playlist-label">Se agregará a: <strong>${playlistLabel}</strong></span>
      <button id="mml-change-playlist" class="mml-link" type="button">cambiar playlist ▾</button>
    </div>
    ${playlistPickerOpen ? renderPlaylistPicker(playlists) : ""}
  `;
}

function renderPlaylistPicker(playlists) {
  if (!playlists) {
    return `<div class="mml-playlist-picker"><div class="mml-spinner mml-spinner--small"></div></div>`;
  }
  const items = playlists
    .map(
      (playlist) => `
        <li class="mml-playlist-picker__item" data-playlist-id="${escapeHtml(playlist.id)}" data-playlist-name="${escapeHtml(playlist.name)}">
          ${escapeHtml(playlist.name)}
        </li>`,
    )
    .join("");
  return `<ul class="mml-playlist-picker">${items}</ul>`;
}

function wireModalEvents(overlay) {
  overlay.querySelectorAll(".mml-candidate").forEach((el) => {
    el.addEventListener("click", () => {
      const index = Number(el.dataset.index);
      confirmCandidate(modalState.candidates[index], modalState.targetPlaylist);
    });
  });

  overlay.querySelector("#mml-retry-btn")?.addEventListener("click", () => {
    const value = overlay.querySelector("#mml-manual-search")?.value?.trim();
    if (value) runSearch({ artist: null, title: value });
  });

  overlay.querySelector("#mml-change-playlist")?.addEventListener("click", async () => {
    modalState.playlistPickerOpen = !modalState.playlistPickerOpen;
    renderModal();
    if (!modalState.playlistPickerOpen || modalState.playlists) return;

    const response = await sendMessage({ type: "GET_PLAYLISTS" });
    if (!modalState) return; // el usuario cerró el modal mientras cargaban

    if (!response.ok) {
      modalState.playlistPickerOpen = false;
      renderModal();
      showToast(response.error ?? "No se pudieron cargar tus playlists.", "error");
      return;
    }

    modalState.playlists = response.playlists;
    renderModal();
  });

  overlay.querySelectorAll(".mml-playlist-picker__item").forEach((el) => {
    el.addEventListener("click", () => {
      modalState.targetPlaylist = {
        id: el.dataset.playlistId,
        name: el.dataset.playlistName,
      };
      modalState.playlistPickerOpen = false;
      renderModal();
    });
  });
}

function handleModalKeydown(event) {
  if (!modalState) return;

  // El modal se apropia del teclado mientras está abierto. No usamos
  // preventDefault salvo en las teclas que sí manejamos, para no romper la
  // escritura en el campo de búsqueda manual.
  event.stopPropagation();

  if (event.key === "Escape") {
    closeModal();
    return;
  }

  if (modalState.state !== "candidates") return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    modalState.selectedIndex = Math.min(modalState.selectedIndex + 1, modalState.candidates.length - 1);
    renderModal();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    modalState.selectedIndex = Math.max(modalState.selectedIndex - 1, 0);
    renderModal();
  } else if (event.key === "Enter") {
    event.preventDefault();
    confirmCandidate(modalState.candidates[modalState.selectedIndex], modalState.targetPlaylist);
  }
}

// ---------- Toasts ----------

function showToast(message, variant = "info", coverUrl, externalUrl) {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = `mml-toast mml-toast--${variant}`;
  toast.innerHTML = `
    ${
      coverUrl
        ? `<img class="mml-toast__cover" src="${escapeHtml(coverUrl)}" alt="" />`
        : `<span class="mml-toast__icon">${variant === "error" ? "⚠️" : "✅"}</span>`
    }
    <div class="mml-toast__body">
      <span class="mml-toast__message">${escapeHtml(message)}</span>
      ${externalUrl ? `<a class="mml-toast__link" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener">Abrir en Spotify</a>` : ""}
    </div>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("mml-toast--visible"));
  setTimeout(() => {
    toast.classList.remove("mml-toast--visible");
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

document.addEventListener("yt-navigate-finish", handleNavigate);
waitForActionsContainer();
