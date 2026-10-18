import { TopBar } from "@/components/ui/topbar";
import { Page, Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { UserMenu } from "@/components/ui/user-menu";
import { requirePerson } from "@/lib/auth";
import { listPeople } from "@/lib/queries/setup";
import { addPerson, savePerson } from "@/lib/actions/people";

export const dynamic = "force-dynamic";
const IN = "rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink";

export default async function People({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const person = await requirePerson();
  const { error } = await searchParams;
  const people = await listPeople();
  const admin = person.is_admin;
  return (
    <>
      <TopBar crumb={[{ label: "People" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">People and roles</p>
        <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">Who does what</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] text-muted">Production runs the boards, supervisors approve or send back (CG or VFX), artists work their queue, viewers only look. A person exists before they have a login; link the login here once an admin has created it in Supabase.</p>
        {error && <p role="alert" className="mt-3 text-[13px] text-red">{decodeURIComponent(error)}</p>}
        {!admin && <p className="mt-3 text-[12px] text-faint">Only admins (Head of Production, Head of CGI) can change roles.</p>}
        <Panel className="mt-6">
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="py-2">
                {admin ? (
                  <form action={savePerson} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="full_name" defaultValue={p.full_name} className={`${IN} w-[180px]`} />
                    <select name="role" defaultValue={p.role} className={IN}><option value="production">Production</option><option value="supervisor">Supervisor</option><option value="artist">Artist</option><option value="viewer">Viewer</option></select>
                    <select name="discipline" defaultValue={p.discipline ?? ""} className={IN}><option value="">— discipline —</option><option value="CG">CG</option><option value="VFX">VFX</option></select>
                    <label className="flex items-center gap-1 text-muted"><input type="checkbox" name="is_admin" defaultChecked={p.is_admin} /> admin</label>
                    <label className="flex items-center gap-1 text-muted"><input type="checkbox" name="active" defaultChecked={p.active} /> active</label>
                    <input name="username" defaultValue={p.username ?? ""} placeholder="login username" className={`${IN} w-[150px]`} data-tip="The Supabase login to link (username before @nmesis.io)" />
                    {p.username ? <Chip tone="green" label="login linked" tip={`Signs in as ${p.username}`} /> : <Chip tone="muted" label="no login" tip="Can be assigned work; cannot sign in yet" />}
                    {p.ftrack_username && <span className="text-faint" data-tip="ftrack username used by the importer">{p.ftrack_username}</span>}
                    <button className="rounded-full border border-line-strong px-3 py-1 text-[11px] text-muted hover:text-ink">Save</button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[13px]"><span className="text-ink">{p.full_name}</span><Chip tone="neutral" label={p.role === "supervisor" && p.discipline ? `${p.discipline} supervisor` : p.role} />{p.is_admin && <Chip tone="green" label="admin" />}{!p.active && <Chip tone="muted" label="inactive" />}</div>
                )}
              </li>
            ))}
          </ul>
          {admin && <form action={addPerson} className="mt-4 flex items-center gap-2"><input name="full_name" placeholder="Add a person by full name" required className={`${IN} w-[240px]`} /><button className="rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a]">Add person</button><span className="text-[11px] text-faint">Starts as an artist without a login.</span></form>}
        </Panel>
      </Page>
    </>
  );
}
