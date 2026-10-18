import { signOut } from "@/app/login/actions";
import type { CurrentPerson } from "@/lib/auth";
import { isViewerId } from "@/lib/auth";
import { listArtists } from "@/lib/queries/people";
import { Chip } from "./chip";
import { LensSwitch } from "./lens-switch";
import { Bell } from "./bell";

const ROLE_LABEL = { production: "Production", supervisor: "Supervisor", artist: "Artist", viewer: "Viewer" } as const;

export async function UserMenu({ person }: { person: CurrentPerson }) {
  const roleLabel = person.role === "supervisor" && person.discipline ? `${person.discipline} Supervisor` : ROLE_LABEL[person.role];
  const artists = person.own_is_admin ? await listArtists() : [];
  return (
    <div className="flex items-center gap-3">
      {person.own_is_admin && <LensSwitch current={person.role} own={person.own_role} artists={artists} lensPersonId={person.lens_person_id} />}
      {!isViewerId(person.id) && <Bell personId={person.id} />}
      <span className="text-[13px] text-ink">{person.full_name}</span>
      <Chip tone={person.lens ? "amber" : "neutral"} label={person.lens ? `Viewing as ${roleLabel}` : roleLabel} tip={person.lens ? "You are an admin looking at the app the way this role sees it — edit controls follow that role." : "Your role decides what you can change here."} />
      <form action={signOut}><button className="text-[12px] text-muted hover:text-ink">Sign out</button></form>
    </div>
  );
}
