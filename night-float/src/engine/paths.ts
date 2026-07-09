/**
 * Safe dot-path get/set into plain JSON-ish objects (PatientState). Used by
 * StateEffects ("devices.vent.fio2") and predicate vital paths. Guards against
 * prototype pollution and never throws on missing segments.
 */

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (FORBIDDEN.has(part)) return undefined;
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Sets a value at a dot path, creating intermediate plain objects for missing
 * segments (arrays are indexed with numeric segments but never grown).
 * Returns false when the path is unsafe or hits a non-object leaf.
 */
export function setPath(obj: unknown, path: string, value: unknown): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  const parts = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (FORBIDDEN.has(part)) return false;
    let next = cur[part];
    if (next == null || typeof next !== 'object') {
      if (Array.isArray(cur)) return false; // don't invent array slots
      next = {};
      cur[part] = next;
    }
    cur = next as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  if (FORBIDDEN.has(leaf)) return false;
  cur[leaf] = value;
  return true;
}
