export function hostWindow() {
  if (window.opener) return window.opener;
  if (window.parent && window.parent !== window) return window.parent;
  return null;
}

export function notifySelection(wordId) {
  const host = hostWindow();
  if (host) {
    host.postMessage({ type: "WORD_SELECTED", wordId }, "*");
  }
}
