import { setLens } from "@/app/login/actions";
import type { Role } from "@/lib/types";

const LABELS: Record<Role, string> = { production: "Production", supervisor: "Supervisor", artist: "Artist", viewer: "Viewer" };

/** Admin-only: view the app as another role. Submits on change; no JavaScript needed beyond the form. */
export function LensSwitch({ current, own }: { current: Role; own: Role }) {
  return (
    <form action={setLens} className="flex items-center gap-2" data-tip="View the app as another role (admins only)">
      <span className="font-label text-[9px] text-faint">View as</span>
      <select name="lens" defaultValue={current === own ? "" : current} className="rounded-full border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink">
        <option value="">Myself ({LABELS[own]})</option>
        {(Object.keys(LABELS) as Role[]).filter((r) => r !== own).map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
      </select>
      <button type="submit" className="rounded-full border border-line-strong px-2 py-1 text-[11px] text-muted hover:text-ink">Go</button>
    </form>
  );
}
