// Filename derivation shared by the save/export flows (EditorStore) and the
// code-preview header (CodeEditor) — one home for the base-name rules so the
// preview can't drift from the names save and eject actually suggest.

/** Strip the path and any known screen suffix from filePath for a save base name. */
export function baseName(filePath: string | null): string {
  return (filePath?.split(/[/\\]/).pop() ?? '').replace(/\.(screen\.json|json|tsx|ts|jsx)$/i, '');
}

/** The screen title reduced to a filename-safe base (existing Save As convention). */
export function sanitizeTitle(title: string): string {
  return title.replace(/[^a-zA-Z0-9]/g, '');
}

/** Suggested base name: filePath stem, else the sanitized title, else 'screen'. */
export function suggestedBase(filePath: string | null, title: string): string {
  return baseName(filePath) || sanitizeTitle(title) || 'screen';
}
