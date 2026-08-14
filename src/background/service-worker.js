import { SPOTIFY_CONFIG } from "../lib/config.js";
import { get, set, remove } from "../lib/storage.js";
import { generateRandomString, generateCodeChallenge } from "../lib/pkce.js";
import {
  HttpError,
  searchTrack,
  getCurrentUser,
  getPlaylists,
  createPlaylist,
  addTrackToPlaylist,
  getPlaylistSnapshotId,
  getPlaylistTrackUris,
} from "../lib/spotify-api.js";

function buildAuthUrl(redirectUri, codeChallenge, state) {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CONFIG.CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: SPOTIFY_CONFIG.SCOPES.join(" "),
    state,
  });
  return `${SPOTIFY_CONFIG.AUTH_ENDPOINT}?${params.toString()}`;
}

async function saveTokens({ access_token, refresh_token, expires_in }) {
  const { auth: previousAuth } = await get("auth");
  await set({
    auth: {
      access_token,
      refresh_token: refresh_token ?? previousAuth?.refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    },
  });
}

async function exchangeCodeForTokens(code, redirectUri, codeVerifier) {
  const response = await fetch(SPOTIFY_CONFIG.TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: SPOTIFY_CONFIG.CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) {
    throw new Error("No se pudieron obtener los tokens de Spotify.");
  }
  return response.json();
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch(SPOTIFY_CONFIG.TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: SPOTIFY_CONFIG.CLIENT_ID,
    }),
  });
  if (!response.ok) {
    throw new Error("No se pudo renovar la sesión de Spotify.");
  }
  return response.json();
}

// Spotify rota el refresh_token en cada renovación con PKCE: el anterior queda
// invalidado. Si dos mensajes concurrentes (p. ej. GET_SETTINGS + GET_PLAYLISTS
// desde el popup) renuevan a la vez, el segundo usa un token ya consumido,
// falla y desconecta al usuario. Este candado comparte una única renovación.
let refreshInFlight = null;

async function runRefresh(refreshToken) {
  try {
    const tokens = await refreshAccessToken(refreshToken);
    await saveTokens(tokens);
    const { auth: refreshed } = await get("auth");
    return refreshed.access_token;
  } catch {
    await remove("auth");
    return null;
  }
}

/**
 * Devuelve un access_token válido, renovándolo si está por expirar.
 * Si el refresh falla (token revocado, etc.), limpia la sesión y devuelve null
 * para que quien llame pida reconexión con un mensaje amable.
 */
async function ensureValidAccessToken() {
  const { auth } = await get("auth");
  if (!auth) return null;

  const isExpiringSoon =
    Date.now() >= auth.expires_at - SPOTIFY_CONFIG.TOKEN_REFRESH_BUFFER_MS;
  if (!isExpiringSoon) return auth.access_token;

  if (!refreshInFlight) {
    refreshInFlight = runRefresh(auth.refresh_token).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function fetchProfile(accessToken) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("No se pudo obtener tu perfil de Spotify.");
  }
  const profile = await response.json();
  return {
    display_name: profile.display_name || profile.id,
    avatar_url: profile.images?.[0]?.url ?? null,
  };
}

async function login() {
  const redirectUri = chrome.identity.getRedirectURL("callback");
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);
  const authUrl = buildAuthUrl(redirectUri, codeChallenge, state);

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) {
    throw new Error("Conexión cancelada.");
  }

  const responseParams = new URL(responseUrl).searchParams;
  const oauthError = responseParams.get("error");
  if (oauthError) {
    throw new Error(`Spotify rechazó la conexión: ${oauthError}`);
  }
  if (responseParams.get("state") !== state) {
    throw new Error("Estado OAuth inválido, intenta de nuevo.");
  }

  const code = responseParams.get("code");
  const tokens = await exchangeCodeForTokens(code, redirectUri, codeVerifier);
  await saveTokens(tokens);

  return fetchProfile(tokens.access_token);
}

async function logout() {
  await remove("auth");
}

async function getAuthStatus() {
  const accessToken = await ensureValidAccessToken();
  if (!accessToken) return { authenticated: false };

  try {
    const profile = await fetchProfile(accessToken);
    return { authenticated: true, profile };
  } catch {
    return { authenticated: false };
  }
}

async function requireAccessToken() {
  const accessToken = await ensureValidAccessToken();
  if (!accessToken) {
    throw new Error("Reconecta tu cuenta de Spotify para continuar.");
  }
  return accessToken;
}

async function ensureDefaultPlaylist(accessToken) {
  const { settings } = await get("settings");
  if (settings?.default_playlist_id) {
    return { id: settings.default_playlist_id, name: settings.default_playlist_name };
  }

  const user = await getCurrentUser(accessToken);
  const playlist = await createPlaylist(accessToken, user.id, "MyMusicLoving");
  await set({
    settings: {
      ...(settings ?? {}),
      default_playlist_id: playlist.id,
      default_playlist_name: playlist.name,
    },
  });
  return playlist;
}

async function recordHistory(entry) {
  const { history } = await get("history");
  const updated = [
    { ...entry, added_at: new Date().toISOString() },
    ...(history ?? []),
  ].slice(0, 200);
  await set({ history: updated });
}

// Spotify no tiene un endpoint "¿está esta canción en esta playlist?", así que
// hay que paginar la playlist entera. Para no repetirlo en cada canción se
// cachea el resultado y se valida con el snapshot_id, que Spotify cambia en
// cada modificación. La cache vive en memoria: si el service worker se
// suspende, simplemente se vuelve a pedir.
const playlistUrisCache = new Map();

async function getPlaylistUris(accessToken, playlistId) {
  const snapshotId = await getPlaylistSnapshotId(accessToken, playlistId);
  const cached = playlistUrisCache.get(playlistId);
  if (cached && cached.snapshotId === snapshotId) return cached.uris;

  const uris = await getPlaylistTrackUris(accessToken, playlistId);
  playlistUrisCache.set(playlistId, { snapshotId, uris });
  return uris;
}

async function addTrack({ track, playlistId, playlistName, ytVideoId }) {
  const accessToken = await requireAccessToken();

  const targetPlaylist = playlistId
    ? { id: playlistId, name: playlistName }
    : await ensureDefaultPlaylist(accessToken);

  const uris = await getPlaylistUris(accessToken, targetPlaylist.id);
  if (uris.has(track.uri)) {
    return { duplicate: true, playlist_name: targetPlaylist.name };
  }

  const snapshotId = await addTrackToPlaylist(accessToken, targetPlaylist.id, track.uri);
  // Reflejar el alta en la cache para no repaginar en la siguiente canción.
  uris.add(track.uri);
  playlistUrisCache.set(targetPlaylist.id, { snapshotId, uris });

  await recordHistory({
    ...track,
    playlist_id: targetPlaylist.id,
    playlist_name: targetPlaylist.name,
    yt_video_id: ytVideoId,
  });

  return { playlist_name: targetPlaylist.name };
}

async function setDefaultPlaylist({ id, name }) {
  const { settings } = await get("settings");
  await set({
    settings: { ...(settings ?? {}), default_playlist_id: id, default_playlist_name: name },
  });
}

async function createDefaultPlaylist() {
  const accessToken = await requireAccessToken();
  const user = await getCurrentUser(accessToken);
  const playlist = await createPlaylist(accessToken, user.id, "MyMusicLoving");
  await setDefaultPlaylist({ id: playlist.id, name: playlist.name });
  return playlist;
}

async function getHistory() {
  const { history } = await get("history");
  return history ?? [];
}

async function clearHistory() {
  await set({ history: [] });
}

function toFriendlyError(err) {
  if (err instanceof HttpError) {
    switch (err.status) {
      case 401:
        return "Tu sesión expiró, reconecta tu cuenta de Spotify.";
      case 403:
        return "No tienes permiso para hacer esto en Spotify.";
      case 429:
        return "Spotify está ocupado, espera un momento e intenta de nuevo.";
      default:
        return err.message;
    }
  }
  if (err instanceof TypeError) {
    return "No hay conexión con Spotify, revisa tu internet e intenta de nuevo.";
  }
  return err.message;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case "LOGIN":
          sendResponse({ ok: true, profile: await login() });
          break;
        case "LOGOUT":
          await logout();
          sendResponse({ ok: true });
          break;
        case "AUTH_STATUS":
          sendResponse({ ok: true, ...(await getAuthStatus()) });
          break;
        case "SEARCH_TRACK": {
          const accessToken = await requireAccessToken();
          const candidates = await searchTrack(accessToken, message.query);
          sendResponse({ ok: true, candidates });
          break;
        }
        case "GET_PLAYLISTS": {
          const accessToken = await requireAccessToken();
          sendResponse({ ok: true, playlists: await getPlaylists(accessToken) });
          break;
        }
        case "GET_SETTINGS": {
          const { settings } = await get("settings");
          sendResponse({ ok: true, settings: settings ?? null });
          break;
        }
        case "ADD_TRACK":
          sendResponse({ ok: true, ...(await addTrack(message.payload)) });
          break;
        case "SET_DEFAULT_PLAYLIST":
          await setDefaultPlaylist(message.payload);
          sendResponse({ ok: true });
          break;
        case "CREATE_DEFAULT_PLAYLIST":
          sendResponse({ ok: true, playlist: await createDefaultPlaylist() });
          break;
        case "GET_HISTORY":
          sendResponse({ ok: true, history: await getHistory() });
          break;
        case "CLEAR_HISTORY":
          await clearHistory();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: `Mensaje desconocido: ${message.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: toFriendlyError(err) });
    }
  })();
  return true;
});
