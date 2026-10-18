import { signOut } from "@/app/login/actions";
import type { CurrentPerson } from "@/lib/auth";
import { Chip } from "./chip";
import { LensSwitch } from "./lens-switch";
import { Bell } from "./bell";

const ROLE_LABEL = { production: "Production", supervisor: "Supervisor", artist: "Artist", viewer: "Viewer" } as const;

export function UserMenu({ person }: { person: CurrentPerson }) {
  const roleLabel = person.role === "supervisor" && person.discipline ? `${person.discipline} Supervisor` : ROLE_LABEL[person.role];
  return (
    <div className="flex items-center gap-3">
      {person.is_admin && <LensSwitch current={person.role} own={person.own_role} />}
      {!person.id.startsWith("viewer:") && <Bell personId={person.id} />}
      <span className="text-[13px] text-ink">{person.full_name}</span>
      <Chip tone={person.lens ? "amber" : "neutral"} label={person.lens ? `Viewing as ${roleLabel}` : roleLabel} tip={person.lens ? "You are an admin looking at the app the way this role sees it." : "Your role decides what you can change here."} />
      <form action={signOut}><button className="text-[12px] text-muted hover:text-ink">Sign out</button></form>
    </div>
  );
}
