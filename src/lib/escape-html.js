// Escapado de texto para plantillas de innerHTML.
// Script clásico (sin import/export) porque lo comparten el content script
// —que no admite módulos ES— y el popup, que lo carga antes de popup.js.

/**
 * Escapa un valor para interpolarlo con seguridad en HTML, tanto en nodos de
 * texto como dentro de atributos entrecomillados.
 * @param {unknown} value Valor a escapar. `null`/`undefined` devuelven "".
 * @returns {string} Texto seguro para interpolar.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
