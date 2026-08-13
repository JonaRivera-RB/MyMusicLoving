// Copia este archivo a src/lib/config.js y pon tu Client ID.
// Se obtiene creando una app en https://developer.spotify.com/dashboard
//
// El Client ID no es secreto (PKCE no usa Client Secret), pero config.js no se
// versiona para poder cambiarlo por entorno sin ensuciar los diffs.

export const SPOTIFY_CONFIG = {
  CLIENT_ID: "TU_CLIENT_ID_DE_SPOTIFY",
  SCOPES: [
    "playlist-modify-public",
    "playlist-modify-private",
    "playlist-read-private",
  ],
  AUTH_ENDPOINT: "https://accounts.spotify.com/authorize",
  TOKEN_ENDPOINT: "https://accounts.spotify.com/api/token",
  TOKEN_REFRESH_BUFFER_MS: 60_000,
};
