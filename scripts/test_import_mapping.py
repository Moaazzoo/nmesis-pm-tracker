import json, os, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import import_ftrack as imp  # noqa: E402

META = json.load(open(os.path.join(HERE, "..", "research", "payloads", "meta.json")))
ALL_STATUS_NAMES = [s["name"] for s in META["statuses"]]


class StatusMapping(unittest.TestCase):
    def test_every_defined_status_maps(self):
        task_keys = {"waiting", "ready", "in_progress", "pending_review", "comments", "completed", "on_hold", "cancelled"}
        version_statuses = {"Approved", "Seen", "VFX Sup Approved", "WIP", "CG Sup Approved", "Client Approved",
                            "Not Ready For Review", "Reference", "Dept Approved", "Pending Review", "In Progress",
                            "Sup Approved", "Pushed", "Final", "Milestone"}
        for name in ALL_STATUS_NAMES:
            key = imp.map_status(name)
            vkey = imp.map_version_status(name)
            self.assertTrue(key in task_keys or vkey is not None, f"unmapped status: {name!r}")

    def test_spec_examples(self):
        self.assertEqual(imp.map_status("Waiting for another progress"), "waiting")
        self.assertEqual(imp.map_status("Awaiting 1st Pass"), "waiting")
        self.assertEqual(imp.map_status("Awaiting another task"), "waiting")
        self.assertEqual(imp.map_status("Ready to Resume"), "ready")
        self.assertEqual(imp.map_status("Rendering"), "in_progress")
        self.assertEqual(imp.map_status("Pending VFX Sup Feedback"), "pending_review")
        self.assertEqual(imp.map_status("Pending Client Feedback "), "pending_review")
        self.assertEqual(imp.map_status("Client Approved"), "completed")
        self.assertEqual(imp.map_status("Final"), "completed")
        self.assertEqual(imp.map_status("On Hold"), "on_hold")
        self.assertEqual(imp.map_status("Cancelled"), "cancelled")

    def test_unknown_status_is_none(self):
        self.assertIsNone(imp.map_status("Totally Made Up"))

    def test_version_statuses(self):
        self.assertEqual(imp.map_version_status("VFX Sup Approved"), "approved")
        self.assertEqual(imp.map_version_status("Client Approved"), "client_approved")
        self.assertEqual(imp.map_version_status("Seen"), "submitted")
        self.assertEqual(imp.map_version_status("Not Ready For Review"), "submitted")
        self.assertIsNone(imp.map_version_status("Totally Made Up"))


class LabelMapping(unittest.TestCase):
    def test_live_labels(self):
        self.assertEqual(imp.map_label("Task Definition"), ("Task Definition", "Task Definition"))
        self.assertEqual(imp.map_label("Artist Note"), ("Artist Note", "Artist Note"))
        self.assertEqual(imp.map_label("VFX Sup Feedback"), ("Supervisor Feedback", "VFX Sup Feedback"))
        self.assertEqual(imp.map_label("CG Sup Feedback"), ("Supervisor Feedback", "CG Sup Feedback"))
        self.assertEqual(imp.map_label("Department Sup Feedback"), ("Supervisor Feedback", "Department Sup Feedback"))
        self.assertEqual(imp.map_label("Art Director Feedback"), ("Supervisor Feedback", "Art Director Feedback"))
        self.assertEqual(imp.map_label("Client Feedback"), ("Client Feedback", "Client Feedback"))
        self.assertEqual(imp.map_label("Production Note"), ("Production Note", "Production Note"))
        self.assertEqual(imp.map_label("Production Feedback"), ("Production Note", "Production Feedback"))
        self.assertEqual(imp.map_label("Round Note"), ("Production Note", "Round Note"))
        self.assertEqual(imp.map_label("Missing Assets "), ("Production Note", "Missing Assets"))
        self.assertEqual(imp.map_label(None), ("Production Note", None))


class Structure(unittest.TestCase):
    def test_node_kind(self):
        self.assertEqual(imp.node_kind("Asset Build"), ("unit", "asset"))
        self.assertEqual(imp.node_kind("Shot"), ("unit", "shot"))
        self.assertEqual(imp.node_kind("Scene"), ("unit", "scene"))
        self.assertEqual(imp.node_kind("Folder"), ("group", None))
        self.assertEqual(imp.node_kind("Sequence"), ("group", None))

    def test_milestone_kind(self):
        self.assertEqual(imp.milestone_kind("Client Review: Mid-Res-Infographic|1|"), "client_review")
        self.assertEqual(imp.milestone_kind("CR: KVs"), "client_review")
        self.assertEqual(imp.milestone_kind("Delivery: Config-M9"), "delivery")
        self.assertEqual(imp.milestone_kind("Final Delivery: Infographics (S08DM)"), "delivery")
        self.assertEqual(imp.milestone_kind("Review: Previz 02"), "internal")
        self.assertEqual(imp.milestone_kind("PROD: Approval"), "internal")

    def test_parse_pass(self):
        self.assertEqual(imp.parse_pass("Lighting-2P"), ("Lighting", 2))
        self.assertEqual(imp.parse_pass("Matte Painting - 1P"), ("Matte Painting", 1))
        self.assertEqual(imp.parse_pass("Rigging "), ("Rigging", None))
        self.assertEqual(imp.parse_pass("Comp-1P"), ("Comp", 1))

    def test_type_mapping(self):
        self.assertEqual(imp.map_type("Lighting"), "Lighting")
        self.assertEqual(imp.map_type("Rigging "), "Rigging")        # legacy type, imported as inactive
        self.assertEqual(imp.map_type("Matte Painting"), "Matte Painting")
        self.assertEqual(imp.map_type("Totally Made Up"), None)


if __name__ == "__main__":
    unittest.main()
