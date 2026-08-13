// Limpieza de títulos de YouTube para buscarlos en Spotify.
// Script clásico (sin import/export): se carga antes de content.js en el
// mismo content_scripts[].js del manifest y comparten el scope global.
// Pruebas manuales documentadas en title-parser.test.html.

const NOISE_PATTERNS = [
  /\(\s*[^()]*\b(?:official|oficial)\b[^()]*\)/gi,
  /\[\s*[^[\]]*\b(?:official|oficial)\b[^[\]]*\]/gi,
  /\(\s*[^()]*\b(?:lyrics?|letra)\b[^()]*\)/gi,
  /\|\s*lyrics/gi,
  /\(\s*visualizer\s*\)/gi,
  /\[\s*4k\s*\]/gi,
  /\[\s*hd\s*\]/gi,
  /\(\s*hd\s*\)/gi,
  /#\S+/g,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
];

function stripNoise(rawTitle) {
  let title = rawTitle;
  for (const pattern of NOISE_PATTERNS) {
    title = title.replace(pattern, "");
  }
  return title
    .replace(/\bft\.?\b/gi, "feat.")
    .replace(/^[\s|–-]+/, "")
    .replace(/[\s|–-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitArtistAndTitle(cleanedTitle) {
  const separators = [" - ", " – ", " — "];
  for (const separator of separators) {
    const index = cleanedTitle.indexOf(separator);
    if (index > 0) {
      return {
        artist: cleanedTitle.slice(0, index).trim(),
        title: cleanedTitle.slice(index + separator.length).trim(),
      };
    }
  }
  return { artist: null, title: cleanedTitle };
}

function parseYoutubeTitle(rawTitle) {
  const cleaned = stripNoise(rawTitle);
  return splitArtistAndTitle(cleaned);
}
