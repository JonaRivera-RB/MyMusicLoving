/**
 * Cliente de la Web API de Spotify. Respeta el header Retry-After en 429
 * con un único reintento (ver ARQUITECTURA.md - Riesgos y mitigaciones).
 */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function spotifyFetch(accessToken, url, options = {}, retriesLeft = 1) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 429 && retriesLeft > 0) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After")) || 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    return spotifyFetch(accessToken, url, options, retriesLeft - 1);
  }

  return response;
}

function mapTrack(track) {
  const images = track.album?.images ?? [];
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album?.name ?? "",
    cover_url: images[images.length - 1]?.url ?? images[0]?.url ?? null,
    duration_ms: track.duration_ms,
    external_url: track.external_urls?.spotify ?? null,
  };
}

export async function searchTrack(accessToken, { artist, title }) {
  const query = artist ? `${artist} ${title}` : title;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "3",
  });
  const response = await spotifyFetch(
    accessToken,
    `https://api.spotify.com/v1/search?${params.toString()}`,
  );
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudo buscar la canción en Spotify.");
  }
  const data = await response.json();
  return (data.tracks?.items ?? []).map(mapTrack);
}

export async function getCurrentUser(accessToken) {
  const response = await spotifyFetch(accessToken, "https://api.spotify.com/v1/me");
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudo obtener tu perfil de Spotify.");
  }
  return response.json();
}

export async function getPlaylists(accessToken) {
  const response = await spotifyFetch(
    accessToken,
    "https://api.spotify.com/v1/me/playlists?limit=50",
  );
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudieron cargar tus playlists.");
  }
  const data = await response.json();
  return (data.items ?? []).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    image_url: playlist.images?.[0]?.url ?? null,
  }));
}

export async function createPlaylist(accessToken, userId, name) {
  const response = await spotifyFetch(
    accessToken,
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, public: false }),
    },
  );
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudo crear la playlist.");
  }
  const playlist = await response.json();
  return { id: playlist.id, name: playlist.name };
}

/**
 * Devuelve el `snapshot_id` de una playlist: cambia con cada modificación, así
 * que sirve para saber si una lista de canciones cacheada sigue vigente.
 * @returns {Promise<string>}
 */
export async function getPlaylistSnapshotId(accessToken, playlistId) {
  const response = await spotifyFetch(
    accessToken,
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=snapshot_id`,
  );
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudo consultar la playlist.");
  }
  const data = await response.json();
  return data.snapshot_id;
}

/**
 * Devuelve el conjunto de URIs de las canciones de una playlist, paginando
 * hasta el final. Pide solo el campo `uri` para que la respuesta sea mínima.
 * @returns {Promise<Set<string>>}
 */
export async function getPlaylistTrackUris(accessToken, playlistId) {
  const uris = new Set();
  let url =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks` +
    `?fields=items(track(uri)),next&limit=100`;

  while (url) {
    const response = await spotifyFetch(accessToken, url);
    if (!response.ok) {
      throw new HttpError(response.status, "No se pudieron leer las canciones de la playlist.");
    }
    const data = await response.json();
    for (const item of data.items ?? []) {
      if (item.track?.uri) uris.add(item.track.uri);
    }
    url = data.next;
  }

  return uris;
}

/**
 * Agrega una canción y devuelve el nuevo `snapshot_id` de la playlist.
 * @returns {Promise<string|null>}
 */
export async function addTrackToPlaylist(accessToken, playlistId, trackUri) {
  const response = await spotifyFetch(
    accessToken,
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [trackUri] }),
    },
  );
  if (!response.ok) {
    throw new HttpError(response.status, "No se pudo agregar la canción a la playlist.");
  }
  const data = await response.json();
  return data.snapshot_id ?? null;
}
