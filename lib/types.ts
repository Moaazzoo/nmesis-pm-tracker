export type State = "not_started" | "ready" | "active" | "review" | "changes" | "blocked" | "done" | "cancelled";
export type StatusKey = "waiting" | "ready" | "in_progress" | "pending_review" | "comments" | "completed" | "on_hold" | "cancelled";
export type Role = "production" | "supervisor" | "artist" | "viewer";
export type Discipline = "CG" | "VFX";

export type Person = {
  id: string;
  full_name: string;
  role: Role;
  discipline: Discipline | null;
  is_admin: boolean;
  profile_id: string | null;
};

export type ChipTone = "green" | "amber" | "red" | "neutral" | "muted";
