import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { FieldRepo, TaskRepo } from "./tasks-core";

/** Supabase-backed repository used by every server action. Service role; permissions are checked in the cores. */
export function supabaseRepo(): TaskRepo & FieldRepo {
  const db = adminClient();
  return {
    async getTask(id) {
      const { data } = await db.from("tk_tasks").select("id, project_id, status_key, assignees:tk_assignments(person_id)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { id: data.id, project_id: data.project_id, status_key: data.status_key, assignees: ((data.assignees as unknown as { person_id: string }[]) ?? []).map((a) => a.person_id) };
    },
    async updateStatus(id, to, at) {
      const { error } = await db.from("tk_tasks").update({ status_key: to, status_since: at.toISOString(), updated_at: at.toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async insertStatusLog(r) {
      const { error } = await db.from("tk_status_log").insert({ task_id: r.taskId, from_status_key: r.from, to_status_key: r.to, by_person_id: r.by, at: r.at.toISOString() });
      if (error) throw new Error(error.message);
    },
    async insertNote(n) {
      const { data, error } = await db.from("tk_notes").insert({ task_id: n.taskId, author_id: n.authorId, category: n.category, body: n.body }).select("id").single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    async insertActivity(a) {
      const { error } = await db.from("tk_activity").insert({ project_id: a.projectId, task_id: a.taskId, actor_id: a.actorId, action: a.action, payload: a.payload, unread_by: a.notify });
      if (error) throw new Error(error.message);
    },
    async listSupervisors() {
      const { data } = await db.from("tk_people").select("id").eq("role", "supervisor").eq("active", true);
      return (data ?? []).map((p) => p.id);
    },
    async setAssignees(taskId, personIds) {
      const del = await db.from("tk_assignments").delete().eq("task_id", taskId);
      if (del.error) throw new Error(del.error.message);
      if (personIds.length) {
        const ins = await db.from("tk_assignments").insert(personIds.map((person_id) => ({ task_id: taskId, person_id })));
        if (ins.error) throw new Error(ins.error.message);
      }
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
