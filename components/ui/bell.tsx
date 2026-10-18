import { loadUnread } from "@/lib/queries/activity";
import { describeActivity } from "@/lib/queries/activity-shape";
import { markRead } from "@/lib/actions/activity";

function fmt(ts: string) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

/** Unread activity for this person. Opening an item marks it read and jumps to the task. No JS needed. */
export async function Bell({ personId }: { personId: string }) {
  const items = await loadUnread(personId);
  return (
    <details className="tk-bell relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[12px] text-muted hover:text-ink" data-tip="Things that happened on your tasks since you last looked">
        <span aria-hidden>🔔</span>{items.length > 0 ? <span className="tnum rounded-full bg-green px-1.5 text-[10px] font-bold text-[#0a0c0a]">{items.length}</span> : <span className="text-faint">0</span>}
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-[380px] rounded-[14px] border border-line-strong bg-panel2 p-2 shadow-2xl">
        {items.length === 0 ? <p className="px-2 py-3 text-[12px] text-faint">Nothing new. You'll see status moves, feedback and versions on your tasks here.</p> : (
          <ul className="max-h-[360px] overflow-auto">
            {items.map((it) => (
              <li key={it.id}>
                <form action={markRead}>
                  <input type="hidden" name="id" value={it.id} /><input type="hidden" name="to" value={it.task_id ? `/p/${it.project_id}?task=${it.task_id}` : "/"} />
                  <button className="block w-full rounded-[10px] px-2 py-2 text-left hover:bg-[rgba(169,227,75,.08)]">
                    <span className="block text-[12px] text-ink">{describeActivity(it)}</span>
                    <span className="block text-[11px] text-faint">{it.project_name} · {fmt(it.at)}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && <form action={markRead} className="border-t border-line pt-2 text-right"><input type="hidden" name="to" value="/" /><button className="px-2 text-[11px] text-muted hover:text-ink">Mark all read</button></form>}
      </div>
    </details>
  );
}
