#!/usr/bin/env python3
"""ftrack → tracker seed JSON. Read-only against ftrack.

  python3 scripts/import_ftrack.py project <ftrack_project_id> [--out data/seed/<code>.json] [--allow-unmapped]
  python3 scripts/import_ftrack.py pull-versions <ftrack_project_id> [--out data/seed/<code>.versions.json]

Every mapping is an explicit table below; anything not in a table is reported under
"unmapped" and makes the command exit 2 (unless --allow-unmapped).
"""
import json, re, sys, os, urllib.request
from collections import Counter

CREDS_PATH = "/Volumes/Extreme SSD/NMESIS-Production-Dashboard/sync/.ftrack-credentials"

# ---------------------------------------------------------------- mapping tables
TASK_STATUS = {
    "waiting": ["Waiting for another progress", "Awaiting 1st Pass", "Awaiting another task", "Milestone"],
    "ready": ["Ready to start", "Ready to Resume"],
    "in_progress": ["In Progress", "Rendering", "Awaiting Export"],
    "pending_review": ["Pending Review", "Pending VFX Sup Feedback", "Pending Department Sup Feedback", "Pending Client Feedback"],
    "comments": ["Comments"],
    "completed": ["Completed", "Client Approved", "Final", "Approved"],
    "on_hold": ["On Hold", "Pushed"],
    "cancelled": ["Cancelled"],
}
VERSION_STATUS = {
    "approved": ["Approved", "VFX Sup Approved", "CG Sup Approved", "Dept Approved", "Sup Approved"],
    "client_approved": ["Client Approved"],
    "submitted": ["Seen", "WIP", "In Progress", "Pending Review", "Not Ready For Review", "Reference"],
    "needs_changes": ["Comments"],
}
LABELS = {  # ftrack note label → tracker category
    "Task Definition": "Task Definition",
    "Artist Note": "Artist Note",
    "VFX Sup Feedback": "Supervisor Feedback",
    "CG Sup Feedback": "Supervisor Feedback",
    "Department Sup Feedback": "Supervisor Feedback",
    "Art Director Feedback": "Supervisor Feedback",
    "Client Feedback": "Client Feedback",
}
TRACKER_TYPES = ["Layout", "Modeling", "Shading", "Animation", "FX", "Lighting", "Compositing", "Editing",
                 "Storyboard", "Matchmove", "Art Direction",
                 # legacy types still on real tasks; imported as inactive types
                 "Rigging", "Matte Painting", "Prep", "Pre-Prod", "Rendering"]
UNIT_KINDS = {"Scene": "scene", "Shot": "shot", "Asset Build": "asset"}
GROUP_TYPES = {"Folder", "Sequence", "Episode"}

_task_status_index = {n.strip().lower(): k for k, names in TASK_STATUS.items() for n in names}
_version_status_index = {n.strip().lower(): k for k, names in VERSION_STATUS.items() for n in names}


def map_status(name):
    if name is None:
        return None
    return _task_status_index.get(name.strip().lower())


def map_version_status(name):
    if name is None:
        return None
    return _version_status_index.get(name.strip().lower())


def map_label(name):
    if name is None:
        return ("Production Note", None)
    clean = name.strip()
    return (LABELS.get(clean, "Production Note"), clean)


def map_type(name):
    if name is None:
        return None
    clean = name.strip()
    return clean if clean in TRACKER_TYPES else None


def node_kind(object_type_name):
    if object_type_name in UNIT_KINDS:
        return ("unit", UNIT_KINDS[object_type_name])
    if object_type_name in GROUP_TYPES:
        return ("group", None)
    return (None, None)


def milestone_kind(name):
    n = (name or "").strip().lower()
    if n.startswith("client review") or n.startswith("cr:"):
        return "client_review"
    if "delivery:" in n or n.startswith("delivery"):
        return "delivery"
    return "internal"


def parse_pass(name):
    trimmed = (name or "").strip()
    m = re.match(r"^(.*?)\s*-\s*(\d+)\s*P$", trimmed, re.I)
    if not m:
        return (trimmed, None)
    return (m.group(1).strip(), int(m.group(2)))


# ---------------------------------------------------------------- ftrack client
def _creds():
    c = {}
    for line in open(CREDS_PATH):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            c[k.strip()] = v.strip().strip('"').strip("'")
    return c


def query(expr):
    c = _creds()
    req = urllib.request.Request(
        c["FTRACK_SERVER"] + "/api",
        data=json.dumps([{"action": "query", "expression": expr}]).encode(),
        headers={"Content-Type": "application/json", "ftrack-user": c["FTRACK_API_USER"], "ftrack-api-key": c["FTRACK_API_KEY"]},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.loads(r.read())
    if isinstance(out, dict):
        raise RuntimeError(out.get("content"))
    return out[0]["data"]


def _d(v):  # ftrack datetime → ISO string (or None)
    if isinstance(v, dict):
        v = v.get("value")
    return v


def _day(v):
    v = _d(v)
    return v[:10] if v else None


def _chunks(seq, n=200):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ---------------------------------------------------------------- import
def import_project(pid, versions_only=False):
    statuses = {s["id"]: s["name"] for s in query("select id, name from Status")}
    types = {t["id"]: t["name"] for t in query("select id, name from Type")}
    otypes = {o["id"]: o["name"] for o in query("select id, name from ObjectType")}
    users = {u["id"]: u["username"] for u in query("select id, username from User")}
    labels = {c["id"]: c["name"] for c in query("select id, name from NoteCategory")}

    proj = query(f'select id, name, full_name, start_date, end_date, status, color from Project where id is "{pid}"')[0]
    ctx = query(f'select id, name, parent_id, object_type_id, sort, status_id, type_id, start_date, end_date, description from TypedContext where project_id is "{pid}"')
    by_id = {c["id"]: c for c in ctx}

    unmapped = {"statuses": Counter(), "types": Counter(), "labels": Counter(), "object_types": Counter()}
    nodes, tasks, milestones = [], [], []
    task_ids = set()
    for c in ctx:
        ot = otypes.get(c["object_type_id"], "?")
        if ot == "Task":
            key = map_status(statuses.get(c["status_id"]))
            if key is None:
                unmapped["statuses"][statuses.get(c["status_id"], c["status_id"])] += 1
            tname = types.get(c["type_id"])
            ttype = map_type(tname)
            if ttype is None and tname is not None:
                unmapped["types"][tname] += 1
            base, pass_no = parse_pass(c["name"])
            tasks.append({
                "ftrack_id": c["id"], "node_ftrack_id": c["parent_id"], "name": c["name"].strip(), "pass_no": pass_no,
                "type": ttype, "status_key": key or "waiting", "start_date": _day(c.get("start_date")),
                "due_date": _day(c.get("end_date")), "critical": False, "description": c.get("description") or None,
                "assignees": [],
            })
            task_ids.add(c["id"])
        elif ot == "Milestone":
            st = statuses.get(c["status_id"], "")
            milestones.append({"ftrack_id": c["id"], "name": c["name"].strip(), "kind": milestone_kind(c["name"]),
                               "due_date": _day(c.get("end_date")) or _day(c.get("start_date")),
                               "done": st in ("Completed", "Final")})
        else:
            kind, unit_kind = node_kind(ot)
            if kind is None:
                unmapped["object_types"][ot] += 1
                continue
            nodes.append({"ftrack_id": c["id"], "parent_ftrack_id": c["parent_id"] if c["parent_id"] != pid else None,
                          "kind": kind, "unit_kind": unit_kind, "name": c["name"].strip(), "sort": c.get("sort") or 0,
                          "is_deliverable": False, "content_type": None, "delivered_date": None})
    node_ids = {n["ftrack_id"] for n in nodes}

    # tasks whose parent is the project itself get a synthetic group so every task has a node
    orphans = [t for t in tasks if t["node_ftrack_id"] == pid or t["node_ftrack_id"] not in node_ids]
    if orphans:
        nodes.append({"ftrack_id": f"{pid}:ungrouped", "parent_ftrack_id": None, "kind": "unit", "unit_kind": None,
                      "name": "Ungrouped tasks", "sort": 9999, "is_deliverable": False, "content_type": None, "delivered_date": None})
        for t in orphans:
            t["node_ftrack_id"] = f"{pid}:ungrouped"

    # assignments
    for chunk in _chunks(sorted(task_ids)):
        ids = ", ".join(f'"{i}"' for i in chunk)
        for a in query(f'select context_id, resource_id from Appointment where type is "assignment" and context_id in ({ids})'):
            u = users.get(a["resource_id"])
            if u:
                for t in tasks:
                    if t["ftrack_id"] == a["context_id"]:
                        t["assignees"].append(u)

    # custom attributes on units
    unit_ids = {n["ftrack_id"] for n in nodes if n["kind"] == "unit"}
    conf_key = {c["id"]: c["key"] for c in query('select id, key from CustomAttributeConfiguration where key in ("is_deliverable","content_type","delivered_date")')}
    for chunk in _chunks(sorted(unit_ids)):
        ids = ", ".join(f'"{i}"' for i in chunk)
        conf_ids = ", ".join(f'"{i}"' for i in conf_key)
        for cav in query(f'select entity_id, value, configuration_id from CustomAttributeValue where entity_id in ({ids}) and configuration_id in ({conf_ids})'):
            key = conf_key.get(cav.get("configuration_id")); val = cav.get("value")
            if key is None:
                continue
            for n in nodes:
                if n["ftrack_id"] == cav["entity_id"]:
                    if key == "is_deliverable":
                        n["is_deliverable"] = bool(val) and str(val) not in ("0", "False", "false")
                    elif key == "content_type":
                        n["content_type"] = val or None
                    elif key == "delivered_date":
                        n["delivered_date"] = _day(val)

    # versions
    versions = []
    for v in query(f'select id, task_id, version, user_id, date, status_id, comment, asset.name, components.name, components.file_type from AssetVersion where project_id is "{pid}"'):
        if v.get("task_id") not in task_ids:
            continue
        sname = statuses.get(v["status_id"])
        vstat = map_version_status(sname)
        if vstat is None:
            unmapped["statuses"][sname or v["status_id"]] += 1
            vstat = "submitted"
        comps = v.get("components") or []
        movie = [c for c in comps if (c.get("file_type") or "").lower() in (".mov", ".mp4")]
        link = (movie or comps or [{}])[0].get("name")
        asset_name = (v.get("asset") or {}).get("name")
        versions.append({"ftrack_id": v["id"], "task_ftrack_id": v["task_id"], "number": v["version"], "asset_name": asset_name,
                         "submitted_by_username": users.get(v["user_id"]), "submitted_at": _d(v.get("date")),
                         "link": link, "status": vstat, "note": (v.get("comment") or "").strip() or None})
    version_task = {v["ftrack_id"]: v["task_ftrack_id"] for v in versions}

    if versions_only:
        return {"project": {"ftrack_id": pid, "code": proj["name"]}, "versions": versions,
                "unmapped": {k: dict(c) for k, c in unmapped.items()}}

    # status history
    status_log = []
    for chunk in _chunks(sorted(task_ids)):
        ids = ", ".join(f'"{i}"' for i in chunk)
        for s in query(f'select id, parent_id, date, from_status_id, status_id, user_id from TypedContextStatusChange where parent_id in ({ids})'):
            status_log.append({"ftrack_id": s["id"], "task_ftrack_id": s["parent_id"],
                               "from_status_key": map_status(statuses.get(s.get("from_status_id"))),
                               "to_status_key": map_status(statuses.get(s["status_id"])) or "waiting",
                               "by_username": users.get(s.get("user_id")), "at": _d(s.get("date"))})

    # notes (on tasks and on versions; notes on folders/units are counted, not imported)
    notes, skipped_notes = [], 0
    for n in query(f'select id, parent_id, parent_type, content, category_id, in_reply_to_id, user_id, date from Note where project_id is "{pid}"'):
        task_fid, version_fid = None, None
        if n["parent_type"] == "TypedContext" and n["parent_id"] in task_ids:
            task_fid = n["parent_id"]
        elif n["parent_type"] == "AssetVersion" and n["parent_id"] in version_task:
            task_fid, version_fid = version_task[n["parent_id"]], n["parent_id"]
        else:
            skipped_notes += 1
            continue
        category, source_label = map_label(labels.get(n.get("category_id")))
        notes.append({"ftrack_id": n["id"], "task_ftrack_id": task_fid, "version_ftrack_id": version_fid,
                      "author_username": users.get(n.get("user_id")), "category": category, "source_label": source_label,
                      "body": (n.get("content") or "").strip(), "reply_to_ftrack_id": n.get("in_reply_to_id"), "at": _d(n.get("date"))})

    return {
        "project": {"ftrack_id": pid, "code": proj["name"], "name": proj["full_name"], "client": None,
                    "start_date": _day(proj.get("start_date")), "end_date": _day(proj.get("end_date")), "color": proj.get("color")},
        "nodes": nodes, "tasks": tasks, "status_log": status_log, "notes": notes, "versions": versions,
        "milestones": milestones,
        "unmapped": {k: dict(c) for k, c in unmapped.items()},
        "report": {"skipped_notes_on_non_tasks": skipped_notes, "orphan_tasks": len(orphans)},
    }


def main(argv):
    if len(argv) < 2 or argv[0] not in ("project", "pull-versions"):
        print(__doc__); return 1
    cmd, pid = argv[0], argv[1]
    out = None; allow = "--allow-unmapped" in argv
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    data = import_project(pid, versions_only=(cmd == "pull-versions"))
    code = data["project"]["code"]
    out = out or os.path.join("data", "seed", f"{code}{'.versions' if cmd == 'pull-versions' else ''}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(data, open(out, "w"), indent=1)
    counts = {k: len(v) for k, v in data.items() if isinstance(v, list)}
    print(f"wrote {out}: {counts}")
    if data.get("report"): print("report:", data["report"])
    bad = {k: v for k, v in data["unmapped"].items() if v}
    if bad:
        print("UNMAPPED values (add them to the tables in scripts/import_ftrack.py):")
        for k, v in bad.items(): print(f"  {k}: {v}")
        if not allow: return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
