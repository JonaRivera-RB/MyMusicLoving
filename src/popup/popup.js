const authView = document.getElementById("auth-view");
const tabs = document.getElementById("tabs");
const playlistView = document.getElementById("playlist-view");
const historyView = document.getElementById("history-view");

/**
 * Envía un mensaje al service worker devolviendo siempre un objeto con `ok`,
 * para que un canal caído no deje la vista colgada en "Cargando…".
 */
async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return { ok: false, error: "No se pudo contactar la extensión. Ciérrala y ábrela de nuevo." };
  }
}

function skeletonRows(count) {
  return `<div class="skeleton-list">${"<div class=\"skeleton-row\"></div>".repeat(count)}</div>`;
}

// ---------- Sesión ----------

function renderLoading() {
  authView.innerHTML = `<p class="status-text">Cargando…</p>`;
}

function showTabs(show) {
  tabs.hidden = !show;
  playlistView.hidden = !show;
  historyView.hidden = !show;
}

function switchTab(tab) {
  tabs.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("tab--active", btn.dataset.tab === tab);
  });
  playlistView.hidden = tab !== "playlist";
  historyView.hidden = tab !== "history";
  if (tab === "playlist") renderPlaylistView();
  if (tab === "history") renderHistoryView();
}

tabs.addEventListener("click", (event) => {
  const btn = event.target.closest(".tab");
  if (btn) switchTab(btn.dataset.tab);
});

function renderLoggedOut(error) {
  showTabs(false);
  authView.innerHTML = `
    ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
    <button id="connect-btn" class="btn btn--primary" type="button">Conectar con Spotify</button>
  `;
  document.getElementById("connect-btn").addEventListener("click", handleConnect);
}

function renderLoggedIn(profile) {
  authView.innerHTML = `
    <div class="profile">
      ${
        profile.avatar_url
          ? `<img class="profile__avatar" src="${escapeHtml(profile.avatar_url)}" alt="" />`
          : `<div class="profile__avatar profile__avatar--placeholder">🎵</div>`
      }
      <span class="profile__name">${escapeHtml(profile.display_name)}</span>
    </div>
    <button id="disconnect-btn" class="btn btn--secondary" type="button">Desconectar</button>
  `;
  document.getElementById("disconnect-btn").addEventListener("click", handleDisconnect);
  showTabs(true);
  switchTab("playlist");
}

async function handleConnect() {
  renderLoading();
  const response = await sendMessage({ type: "LOGIN" });
  if (response?.ok) {
    renderLoggedIn(response.profile);
  } else {
    renderLoggedOut(response?.error ?? "No se pudo conectar con Spotify.");
  }
}

async function handleDisconnect() {
  renderLoading();
  await sendMessage({ type: "LOGOUT" });
  renderLoggedOut();
}

// ---------- Playlist por defecto (HU-08) ----------

let playlistsCache = [];
let currentDefault = null;

async function renderPlaylistView() {
  playlistView.innerHTML = skeletonRows(4);

  const [settingsRes, playlistsRes] = await Promise.all([
    sendMessage({ type: "GET_SETTINGS" }),
    sendMessage({ type: "GET_PLAYLISTS" }),
  ]);

  currentDefault = settingsRes.ok ? settingsRes.settings : null;

  if (!playlistsRes.ok) {
    playlistView.innerHTML = `<p class="error-text">${escapeHtml(playlistsRes.error ?? "No se pudieron cargar tus playlists.")}</p>`;
    return;
  }

  playlistsCache = playlistsRes.playlists;
  drawPlaylistView();
}

/**
 * Dibuja el marco fijo de la vista: buscador, contenedor de la lista y botón.
 * El buscador se crea una sola vez y solo se redibuja la lista, porque
 * reemplazar el propio input en cada tecla le hacía perder el foco.
 */
function drawPlaylistView() {
  playlistView.innerHTML = `
    ${
      playlistsCache.length > 6
        ? `<input id="playlist-filter" class="input" type="text" placeholder="Buscar playlist…" />`
        : ""
    }
    <div id="playlist-list"></div>
    <button id="create-playlist-btn" class="btn btn--secondary" type="button">Crear playlist MyMusicLoving</button>
    <p id="playlist-error" class="error-text" hidden></p>
  `;

  playlistView.querySelector("#playlist-filter")?.addEventListener("input", (event) => {
    drawPlaylistList(event.target.value);
  });
  playlistView.querySelector("#create-playlist-btn").addEventListener("click", handleCreateDefault);

  drawPlaylistList("");
}

function currentFilterText() {
  return playlistView.querySelector("#playlist-filter")?.value ?? "";
}

function setPlaylistError(message) {
  const el = playlistView.querySelector("#playlist-error");
  if (!el) return;
  el.textContent = message ?? "";
  el.hidden = !message;
}

function drawPlaylistList(filterText) {
  const container = playlistView.querySelector("#playlist-list");
  if (!container) return;

  const filtered = playlistsCache.filter((p) =>
    p.name.toLowerCase().includes(filterText.toLowerCase()),
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p class="status-text">Sin playlists.</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="playlist-list">
      ${filtered
        .map((p) => {
          const isDefault = p.id === currentDefault?.default_playlist_id;
          return `
        <li class="playlist-row ${isDefault ? "playlist-row--active" : ""}" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">
          ${
            p.image_url
              ? `<img class="playlist-row__cover" src="${escapeHtml(p.image_url)}" alt="" />`
              : `<div class="playlist-row__cover playlist-row__cover--placeholder">🎵</div>`
          }
          <span class="playlist-row__name">${escapeHtml(p.name)}</span>
          ${isDefault ? `<span class="playlist-row__badge">✓</span>` : ""}
        </li>`;
        })
        .join("")}
    </ul>
  `;

  container.querySelectorAll(".playlist-row").forEach((row) => {
    row.addEventListener("click", () => handleSetDefault(row.dataset.id, row.dataset.name));
  });
}

async function handleSetDefault(id, name) {
  currentDefault = { ...(currentDefault ?? {}), default_playlist_id: id, default_playlist_name: name };
  setPlaylistError(null);
  drawPlaylistList(currentFilterText());

  const response = await sendMessage({ type: "SET_DEFAULT_PLAYLIST", payload: { id, name } });
  if (!response.ok) {
    setPlaylistError(response.error ?? "No se pudo guardar la playlist por defecto.");
  }
}

async function handleCreateDefault() {
  const btn = playlistView.querySelector("#create-playlist-btn");
  btn.disabled = true;
  btn.textContent = "Creando…";
  setPlaylistError(null);

  const response = await sendMessage({ type: "CREATE_DEFAULT_PLAYLIST" });
  if (response.ok) {
    await renderPlaylistView();
    return;
  }

  btn.disabled = false;
  btn.textContent = "Crear playlist MyMusicLoving";
  setPlaylistError(response.error ?? "No se pudo crear la playlist.");
}

// ---------- Historial (HU-09) ----------

function formatRelativeDate(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "hace instantes";
  if (diffMs < hour) return `hace ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `hace ${Math.floor(diffMs / hour)} h`;

  const days = Math.floor(diffMs / day);
  if (days < 7) return `hace ${days} día${days === 1 ? "" : "s"}`;

  const weeks = Math.floor(days / 7);
  return `hace ${weeks} semana${weeks === 1 ? "" : "s"}`;
}

async function renderHistoryView() {
  historyView.innerHTML = skeletonRows(4);
  const response = await sendMessage({ type: "GET_HISTORY" });
  if (!response.ok) {
    historyView.innerHTML = `<p class="error-text">${escapeHtml(response.error ?? "No se pudo cargar el historial.")}</p>`;
    return;
  }
  drawHistoryView(response.history);
}

function drawHistoryView(history) {
  if (history.length === 0) {
    historyView.innerHTML = `<p class="status-text">Aún no has agregado canciones.</p>`;
    return;
  }

  historyView.innerHTML = `
    <ul class="history-list">
      ${history
        .map(
          (entry) => `
        <li class="history-row">
          ${
            entry.cover_url
              ? `<img class="history-row__cover" src="${escapeHtml(entry.cover_url)}" alt="" />`
              : `<div class="history-row__cover history-row__cover--placeholder">🎵</div>`
          }
          <div class="history-row__info">
            <span class="history-row__name">${escapeHtml(entry.name)}</span>
            <span class="history-row__meta">${escapeHtml(entry.artist)} · ${escapeHtml(entry.playlist_name)}</span>
            <span class="history-row__date">${formatRelativeDate(entry.added_at)}</span>
          </div>
          <div class="history-row__links">
            ${entry.external_url ? `<a href="${escapeHtml(entry.external_url)}" target="_blank" rel="noopener">Spotify</a>` : ""}
            ${entry.yt_video_id ? `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(entry.yt_video_id)}" target="_blank" rel="noopener">YouTube</a>` : ""}
          </div>
        </li>`,
        )
        .join("")}
    </ul>
    <button id="clear-history-btn" class="btn btn--secondary" type="button">Limpiar historial</button>
  `;

  historyView.querySelector("#clear-history-btn").addEventListener("click", handleClearHistoryClick);
}

function handleClearHistoryClick() {
  const btn = document.getElementById("clear-history-btn");
  btn.outerHTML = `
    <div class="confirm-row">
      <span>¿Seguro?</span>
      <button id="clear-confirm-btn" class="btn btn--primary" type="button">Sí, limpiar</button>
      <button id="clear-cancel-btn" class="btn btn--secondary" type="button">Cancelar</button>
    </div>
  `;
  document.getElementById("clear-confirm-btn").addEventListener("click", handleClearHistoryConfirm);
  document.getElementById("clear-cancel-btn").addEventListener("click", renderHistoryView);
}

async function handleClearHistoryConfirm() {
  await sendMessage({ type: "CLEAR_HISTORY" });
  renderHistoryView();
}

// ---------- Init ----------

async function init() {
  renderLoading();
  const response = await sendMessage({ type: "AUTH_STATUS" });
  if (response?.ok && response.authenticated) {
    renderLoggedIn(response.profile);
  } else {
    renderLoggedOut();
  }
}

init();
