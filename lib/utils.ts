export { cn } from "cn"

/** Copia dell'oggetto senza una chiave. */
export function senza<T extends Record<string, unknown>>(obj: T, chiave: string): T {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== chiave)) as T;
}
