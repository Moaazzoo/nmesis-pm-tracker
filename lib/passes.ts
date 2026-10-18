/** "Lighting-2P" → base "Lighting", pass 2. Tolerates spaces around the dash and trailing spaces. */
export function parsePass(name: string): { base: string; pass_no: number | null } {
  const trimmed = name.trim();
  const m = trimmed.match(/^(.*?)\s*-\s*(\d+)\s*P$/i);
  if (!m) return { base: trimmed, pass_no: null };
  return { base: m[1].trim(), pass_no: Number(m[2]) };
}

type PassTask = { id: string; name: string; type_id: string; node_id: string };

/** The task that is the next pass of the same type under the same unit, if any. */
export function nextPass<T extends PassTask>(tasks: T[], task: T): T | null {
  const { pass_no } = parsePass(task.name);
  if (pass_no === null) return null;
  const { base } = parsePass(task.name);
  return (
    tasks.find((t) => {
      if (t.id === task.id || t.node_id !== task.node_id || t.type_id !== task.type_id) return false;
      const p = parsePass(t.name);
      return p.pass_no === pass_no + 1 && p.base.toLowerCase() === base.toLowerCase();
    }) ?? null
  );
}
