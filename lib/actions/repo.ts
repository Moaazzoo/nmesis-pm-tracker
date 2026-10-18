import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { FieldRepo, TaskRepo } from "./tasks-core";
import type { DrawerRepo } from "./drawer-core";
import type { ReviewRepo } from "./review-core";
import type { Discipline } from "@/lib/types";

/** Supabase-backed repository used by every server action. Service role; permissions are checked in the cores. */
export function supabaseRepo(): TaskRepo & FieldRepo & DrawerRepo & ReviewRepo {
  const db = adminClient();
  return {
    async getTask(id) {
      const { data } = await db.from("tk_tasks").select("id, project_id, status_key, assignees:tk_assignments(person_id)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { id: data.id, project_id: data.project_id, status_key: data.status_key, assignees: ((data.assignees as unknown as { person_id: string }[]) ?? []).map((a) => a.person_id) };
    },
    async updateStatus(id, to, at, from) {
      let q = db.from("tk_tasks").update({ status_key: to, status_since: at.toISOString(), updated_at: at.toISOString() }).eq("id", id);
      if (from) q = q.eq("status_key", from);
      const { data, error } = await q.select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
    async versionTask(versionId) { const { data } = await db.from("tk_versions").select("task_id").eq("id", versionId).maybeSingle(); return data?.task_id ?? null; },
    async noteTask(noteId) { const { data } = await db.from("tk_notes").select("task_id").eq("id", noteId).maybeSingle(); return data?.task_id ?? null; },
    async setLatestVersionStatus(taskId, status) {
      const { data } = await db.from("tk_versions").select("id").eq("task_id", taskId).order("submitted_at", { ascending: false }).limit(1);
      if (data?.[0]) { const { error } = await db.from("tk_versions").update({ status }).eq("id", data[0].id); if (error) throw new Error(error.message); }
    },
    async insertStatusLog(r) {
      const { error } = await db.from("tk_status_log").insert({ task_id: r.taskId, from_status_key: r.from, to_status_key: r.to, by_person_id: r.by, at: r.at.toISOString() });
      if (error) throw new Error(error.message);
    },
    async insertNote(n: { taskId: string; versionId?: string | null; authorId: string; category: string; body: string; replyTo?: string | null }) {
      const { data, error } = await db.from("tk_notes").insert({ task_id: n.taskId, version_id: n.versionId ?? null, author_id: n.authorId, category: n.category, body: n.body, reply_to_id: n.replyTo ?? null }).select("id").single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    async siblingTasks(taskId) {
      const { data: t } = await db.from("tk_tasks").select("node_id").eq("id", taskId).maybeSingle();
      if (!t) return [];
      const { data } = await db.from("tk_tasks").select("id, name, type_id, node_id, status_key").eq("node_id", t.node_id).eq("archived", false);
      return (data ?? []) as { id: string; name: string; type_id: string | null; node_id: string; status_key: string }[];
    },
    async maxVersionNumber(taskId) {
      const { data } = await db.from("tk_versions").select("number").eq("task_id", taskId).order("number", { ascending: false }).limit(1);
      return data?.[0]?.number ?? 0;
    },
    async insertVersion(v) {
      const { data, error } = await db.from("tk_versions").insert({ task_id: v.taskId, number: v.number, submitted_by: v.submittedBy, link: v.link, note: v.note, status: "submitted", source: "app" }).select("id").single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    async taskDiscipline(taskId) {
      const { data } = await db.from("tk_tasks").select("type:tk_task_types(discipline)").eq("id", taskId).maybeSingle();
      return ((data?.type as unknown as { discipline: Discipline | null } | null)?.discipline) ?? null;
    },
    async insertActivity(a) {
      const { error } = await db.from("tk_activity").insert({ project_id: a.projectId, task_id: a.taskId, actor_id: a.actorId, action: a.action, payload: a.payload, unread_by: a.notify });
      if (error) throw new Error(error.message);
    },
    async listSupervisors(discipline: Discipline | null = null) {
      let q = db.from("tk_people").select("id").eq("role", "supervisor").eq("active", true);
      if (discipline) q = q.eq("discipline", discipline);
      const { data } = await q;
      return (data ?? []).map((p) => p.id);
    },
    async setAssignees(taskId, personIds) {
      const { data: cur } = await db.from("tk_assignments").select("person_id").eq("task_id", taskId);
      const have = new Set((cur ?? []).map((a) => a.person_id as string)); const want = new Set(personIds);
      const add = personIds.filter((p) => !have.has(p)); const remove = [...have].filter((p) => !want.has(p));
      if (add.length) { const ins = await db.from("tk_assignments").insert(add.map((person_id) => ({ task_id: taskId, person_id }))); if (ins.error) throw new Error(ins.error.message); }
      if (remove.length) { const del = await db.from("tk_assignments").delete().eq("task_id", taskId).in("person_id", remove); if (del.error) throw new Error(del.error.message); }
    },
    async setDue(taskId, due) {
      const { error } = await db.from("tk_tasks").update({ due_date: due, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw new Error(error.message);
    },
    async setCritical(taskId, critical) {
      const { error } = await db.from("tk_tasks").update({ critical, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw new Error(error.message);
    },
  };
}
