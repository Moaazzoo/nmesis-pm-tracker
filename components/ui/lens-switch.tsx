import { setLens } from "@/app/login/actions";
import type { Role } from "@/lib/types";

const LABELS: Record<Role, string> = { production: "Production", supervisor: "Supervisor", artist: "Artist", viewer: "Viewer" };

/** Admin-only: view the app as another role; for the artist lens, as a specific artist. Plain form, no JavaScript needed. */
export function LensSwitch({ current, own, artists, lensPersonId }: { current: Role; own: Role; artists: { id: string; full_name: string }[]; lensPersonId: string | null }) {
  return (
    <form action={setLens} className="flex items-center gap-2" data-tip="View the app as another role (admins only)">
      <span className="font-label text-[9px] text-faint">View as</span>
      <select name="lens" defaultValue={current === own ? "" : current} className="rounded-full border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink">
        <option value="">Myself ({LABELS[own]})</option>
        {(Object.keys(LABELS) as Role[]).filter((r) => r !== own).map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
      </select>
      <select name="person_id" defaultValue={lensPersonId ?? ""} className="rounded-full border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink" aria-label="Which artist">
        <option value="">any artist</option>
        {artists.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
      </select>
      <button type="submit" className="rounded-full border border-line-strong px-2 py-1 text-[11px] text-muted hover:text-ink">Go</button>
    </form>
  );
}
