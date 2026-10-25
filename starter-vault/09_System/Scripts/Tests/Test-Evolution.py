"""Behavioral regression tests. All mutations stay in the explicitly supplied Temp root."""
from __future__ import annotations
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
from unittest.mock import patch
import uuid

ENTRY = Path(__file__).resolve().parents[1] / "Evolution" / "evolution.py"
spec = importlib.util.spec_from_file_location("evolution", ENTRY)
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
TEST_ROOT = None
POWERSHELL = None


def checks(result="passed"):
    return [{"name": name, "dimension": name, "result": result, "evidence": ["fixture observation"]}
            for name in ("structure", "evidence", "outcome")]


class EvolutionTests(unittest.TestCase):
    def setUp(self):
        self.root = TEST_ROOT / (self._testMethodName + "-" + uuid.uuid4().hex[:8])
        self.workspace = self.root / "workspace"
        self.records = self.workspace / "09_System" / "Evolution"
        self.records.mkdir(parents=True)
        self.target = self.workspace / "09_System" / "example.md"
        self.target.write_bytes(b"original\n")
        self.store = self.records / ".records.json"
        api.atomic_json(self.store, {"schema_version": 1, "revision": 0, **{k: [] for k in api.KINDS}, "events": []})
        self.engine = api.Ledger(self.workspace, self.root / "runs")

    def lesson(self, value="case"):
        return self.engine.handle("lesson", {"key": value, "title": "抖音采集失败分层处理", "task_type": "video_import",
            "tags": ["抖音", "采集"], "when": "抖音页面导航失败", "action": "先核对失败阶段", "exceptions": "不适用于验证码与登录限制",
            "evidence": ["real event reference represented by fixture"]})

    def activate(self, identifier):
        current = self.engine.handle("show", {"id": identifier})
        return self.engine.handle("activate", {"experience_id": identifier, "record_sha256": current["record_sha256"],
            "explicit_approval": True, "approval_evidence": "TEST FIXTURE ONLY: simulated approval",
            "validation_evidence": ["TEST FIXTURE ONLY: behavior reproduced"]})

    def proposal(self):
        return self.engine.handle("propose", {"key": "change", "title": "fixture change", "target": "09_System/example.md",
            "expected_after_sha256": api.hashlib.sha256(b"revised\n").hexdigest(), "diff": "-original\n+revised",
            "reason": "fixture evidence", "evidence": ["fixture"], "verification_plan": "compare bytes and behavior",
            "rollback_plan": "restore only this fixture"})

    def approve(self, result):
        return self.engine.handle("decide", {"proposal_id": result["id"], "proposal_sha256": result["proposal_sha256"],
            "decision": "approve", "explicit_approval": True, "approval_evidence": "TEST FIXTURE ONLY: approval"})

    def begin(self):
        return self.engine.handle("begin", {"key": "task", "title": "fixture task", "task_type": "video_import",
            "scope": ["09_System/example.md"], "sources": ["fixture source"]})

    def test_candidates_are_preview_only_and_scope_is_filtered(self):
        item = self.lesson()
        query = {"task_type": "video_import", "query": "抖音采集"}
        self.assertEqual(self.engine.handle("search", query)["hits"], [])
        self.assertEqual(self.engine.handle("search", query | {"include_candidates": True})["hits"][0]["id"], item["id"])
        self.activate(item["id"])
        self.assertEqual(len(self.engine.handle("search", query)["hits"]), 1)
        self.assertEqual(self.engine.handle("search", query | {"task_type": "book_update"})["hits"], [])

    def test_duplicate_lesson_does_not_inflate_history_or_revision(self):
        item = self.lesson()
        before = self.store.read_bytes()
        self.assertFalse(self.lesson()["changed"])
        self.assertEqual(self.store.read_bytes(), before)
        self.assertEqual(self.engine.handle("show", {"id": item["id"]})["record"]["history"], [])

    def test_activation_requires_explicit_current_approval(self):
        item = self.lesson()
        args = {"experience_id": item["id"], "record_sha256": item["record_sha256"], "explicit_approval": False,
                "approval_evidence": "fixture", "validation_evidence": ["fixture"]}
        with self.assertRaisesRegex(api.Rejected, "Explicit"):
            self.engine.handle("activate", args)
        with self.assertRaisesRegex(api.Rejected, "Stale"):
            self.engine.handle("activate", args | {"explicit_approval": True, "record_sha256": "0" * 64})

    def test_review_removes_effective_experience_and_preserves_history(self):
        item = self.lesson()
        self.activate(item["id"])
        review = self.engine.handle("review", {"key": "new-evidence", "subject": item["id"], "reason": "new conflicting evidence", "evidence": ["fixture"]})
        self.assertEqual(self.engine.handle("search", {"task_type": "video_import", "query": "抖音"})["hits"], [])
        record = self.engine.handle("show", {"id": item["id"]})["record"]
        update = {k: record[k] for k in ("title", "task_type", "tags", "when", "action", "exceptions", "evidence")}
        update.update(key="case", action="revised bounded action")
        self.engine.handle("lesson", update)
        self.engine.handle("resolve_review", {"review_id": review["id"], "disposition": "keep", "explanation": "reviewed changed lesson", "evidence": ["fixture"]})
        changed = self.engine.handle("show", {"id": item["id"]})["record"]
        self.assertEqual(changed["lifecycle"], "candidate")
        self.assertEqual(changed["history"][0]["action"], "先核对失败阶段")

    def test_multiple_open_reviews_do_not_restore_active_early(self):
        item = self.lesson()
        self.activate(item["id"])
        one = self.engine.handle("review", {"key": "one", "subject": item["id"], "reason": "one", "evidence": ["fixture"]})
        self.engine.handle("review", {"key": "two", "subject": item["id"], "reason": "two", "evidence": ["fixture"]})
        self.engine.handle("resolve_review", {"review_id": one["id"], "disposition": "keep", "explanation": "one only", "evidence": ["fixture"]})
        self.assertEqual(self.engine.handle("show", {"id": item["id"]})["record"]["lifecycle"], "review")

    def test_deprecation_requires_approval_and_keeps_record(self):
        item = self.lesson()
        review = self.engine.handle("review", {"key": "retire", "subject": item["id"], "reason": "obsolete", "evidence": ["fixture"]})
        args = {"review_id": review["id"], "disposition": "deprecate", "explanation": "replaced", "evidence": ["fixture"]}
        with self.assertRaisesRegex(api.Rejected, "approval"):
            self.engine.handle("resolve_review", args)
        self.engine.handle("resolve_review", args | {"explicit_approval": True})
        self.assertEqual(self.engine.handle("show", {"id": item["id"]})["record"]["lifecycle"], "deprecated")

    def test_task_completion_requires_all_dimensions_and_real_artifact(self):
        task = self.begin()
        args = {"task_id": task["id"], "outcome": "completed", "summary": "fixture", "artifacts": ["09_System/example.md"],
                "checks": checks(), "distillation": "none"}
        bad = copy.deepcopy(args)
        bad["checks"][2]["result"] = "not_run"
        with self.assertRaisesRegex(api.Rejected, "Unpassed"):
            self.engine.handle("finish", bad)
        with self.assertRaisesRegex(api.Rejected, "not found"):
            self.engine.handle("finish", args | {"artifacts": ["missing.md"]})
        self.engine.handle("finish", args)
        closed = self.engine.handle("show", {"id": task["id"]})["record"]
        self.assertEqual(closed["artifacts"][0]["sha256"], api.file_digest(self.target))
        self.assertTrue(Path(closed["run_reference"]).is_file())
        before = self.store.read_bytes()
        self.assertFalse(self.engine.handle("finish", args)["changed"])
        self.assertEqual(self.store.read_bytes(), before)

    def test_partial_task_preserves_unexecuted_outcome(self):
        task = self.begin()
        self.engine.handle("finish", {"task_id": task["id"], "outcome": "partial", "summary": "visual coverage missing",
            "artifacts": ["09_System/example.md"], "checks": checks("not_run"), "distillation": "candidate"})
        record = self.engine.handle("show", {"id": task["id"]})["record"]
        self.assertEqual(record["lifecycle"], "partial")
        self.assertEqual(record["checks"][2]["result"], "not_run")

    def test_task_identity_cannot_be_silently_reused(self):
        self.begin()
        before = self.store.read_bytes()
        self.assertFalse(self.begin()["created"])
        self.assertEqual(self.store.read_bytes(), before)
        with self.assertRaisesRegex(api.Rejected, "different intent"):
            self.engine.handle("begin", {"key": "task", "title": "different task", "task_type": "video_import", "scope": ["09_System/example.md"], "sources": ["fixture"]})

    def test_candidate_cannot_be_declared_as_adopted_experience(self):
        item = self.lesson()
        with self.assertRaisesRegex(api.Rejected, "active"):
            self.engine.handle("begin", {"key": "task", "title": "fixture", "task_type": "video_import", "scope": ["09_System/example.md"],
                "sources": ["fixture"], "used_experience_ids": [item["id"]]})

    def test_active_experience_cannot_be_adopted_for_an_unrelated_task(self):
        item = self.lesson()
        self.activate(item["id"])
        with self.assertRaisesRegex(api.Rejected, "different task scope"):
            self.engine.handle("begin", {"key": "book", "title": "book fixture", "task_type": "book_update",
                "scope": ["09_System/example.md"], "sources": ["fixture"], "used_experience_ids": [item["id"]]})

    def test_proposal_approval_binds_current_content_and_target(self):
        proposal = self.proposal()
        before = self.target.read_bytes()
        with self.assertRaisesRegex(api.Rejected, "Stale"):
            self.approve(proposal | {"proposal_sha256": "0" * 64})
        self.target.write_text("independent change\n", encoding="utf-8")
        with self.assertRaisesRegex(api.Rejected, "Target changed"):
            self.approve(proposal)
        self.assertEqual(self.target.read_text(encoding="utf-8"), "independent change\n")
        self.assertEqual(before, b"original\n")

    def test_proposal_verification_requires_approval_expected_bytes_and_checks(self):
        proposal = self.proposal()
        args = {"proposal_id": proposal["id"], "checks": checks(), "evidence": ["fixture"]}
        with self.assertRaisesRegex(api.Rejected, "Unapproved"):
            self.engine.handle("verify_proposal", args)
        self.assertFalse(self.approve(proposal)["target_written"])
        self.assertEqual(self.target.read_bytes(), b"original\n")
        with self.assertRaisesRegex(api.Rejected, "Target does not match"):
            self.engine.handle("verify_proposal", args)
        # Simulated, explicitly approved fixture edit; the runtime never applies patches.
        self.target.write_bytes(b"revised\n")
        self.assertEqual(self.engine.handle("verify_proposal", args)["lifecycle"], "verified")

    def test_unknown_fields_and_paths_fail_without_mutation(self):
        before = self.store.read_bytes()
        with self.assertRaisesRegex(api.Rejected, "arguments"):
            self.engine.handle("status", {"execute": "anything"})
        for target in ("../outside", "C:/outside", ".git/config", "05_Personal/Profile.md", "09_System/Backups/old.md", "09_System/Evolution/records.json"):
            with self.subTest(target=target), self.assertRaises(api.Rejected):
                self.engine.relative(target, existing=False)
        self.assertEqual(before, self.store.read_bytes())

    def test_external_artifact_is_not_read(self):
        outside = self.root / "outside.txt"
        outside.write_text("unrelated", encoding="utf-8")
        with self.assertRaisesRegex(api.Rejected, "outside"):
            self.engine.artifacts([str(outside)])

    def test_existing_lock_is_preserved_and_no_write_occurs(self):
        lock = self.records / ".evolution.lock"
        lock.write_text("another operation", encoding="utf-8")
        before = self.store.read_bytes()
        with self.assertRaisesRegex(api.Rejected, "busy"):
            self.lesson()
        self.assertEqual(lock.read_text(encoding="utf-8"), "another operation")
        self.assertEqual(self.store.read_bytes(), before)

    def test_junction_detection_rejects_target(self):
        with patch.object(api.os.path, "isjunction", side_effect=lambda p: Path(p) == self.target):
            with self.assertRaisesRegex(api.Rejected, "junction"):
                self.engine.relative("09_System/example.md")

    def test_corrupt_schema_is_not_rewritten(self):
        data = self.engine.load()
        data["schema_version"] = 999
        api.atomic_json(self.store, data)
        before = self.store.read_bytes()
        with self.assertRaisesRegex(api.Rejected, "schema"):
            self.lesson()
        self.assertEqual(before, self.store.read_bytes())


    def wrapper_fixture(self):
        scripts = self.workspace / '09_System' / 'Scripts' / 'Evolution'
        scripts.mkdir(parents=True)
        for name in ('evolution.py', 'Invoke-Evolution.ps1'):
            shutil.copyfile(ENTRY.parent / name, scripts / name)
        registry = self.root / 'tools' / 'Config' / 'tool-registry.json'
        registry.parent.mkdir(parents=True)
        api.atomic_json(registry, [
            {'tool_name': 'python', 'canonical_path': str(Path(sys.executable))},
            {'tool_name': 'video-intake', 'canonical_path': str(self.workspace / '09_System' / 'Scripts' / 'Video-Intake.cjs')}])
        config = self.workspace / '09_System' / 'Config' / 'local.json'
        config.parent.mkdir(parents=True, exist_ok=True)
        api.atomic_json(config, {'tools_root':str(self.root/'tools'),'registry_file':'tool-registry.local.json'})
        return scripts / 'Invoke-Evolution.ps1', registry

    def invoke_wrapper(self, entry, registry, request, constrained=False, oem=False, pipe=False):
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        setup = "$ErrorActionPreference='Stop'\n"
        if oem:
            # Child-only fixture: intentionally use a legacy pipe encoding.
            setup += '$OutputEncoding = [Text.Encoding]::GetEncoding(936)\n'
        if constrained:
            setup += "$ExecutionContext.SessionState.LanguageMode='ConstrainedLanguage'\n"
        payload = quote(json.dumps(request, ensure_ascii=False)) if isinstance(request, dict) else quote(request)
        command = '& ' + quote(entry) + ' -RegistryPath ' + quote(registry)
        command = payload + ' | ' + command if pipe else command + ' -RequestJson ' + payload
        result = subprocess.run([str(POWERSHELL), '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', setup+command],
                                capture_output=True, timeout=30)
        response = json.loads(result.stdout.decode('ascii'))
        self.assertNotIn(b'ConstrainedLanguage', result.stderr)
        return result, response

    def test_formal_wrapper_preserves_unicode_in_restricted_and_oem_pipes(self):
        entry, registry = self.wrapper_fixture()
        arguments = {'key':'unicode', 'title':'中文经验😀', 'task_type':'video_import', 'tags':['抖音'],
                     'when':'页面导航失败', 'action':'只作一次有界重试', 'exceptions':'验证码不重试',
                     'evidence':['TEST FIXTURE ONLY 中文证据']}
        for constrained in (False, True):
            for oem in (False, True):
                for pipe in (False, True):
                    with self.subTest(constrained=constrained, oem=oem, pipe=pipe):
                        process, response = self.invoke_wrapper(entry, registry,
                            {'api_version':1,'operation':'lesson','arguments':arguments}, constrained, oem, pipe)
                        self.assertEqual(process.returncode, 0, process.stderr.decode('utf-8',errors='replace'))
                        self.assertEqual(response['status'],'success')
                        stored = self.engine.load()['experiences'][0]
                        for field in ('title','when','action','exceptions','evidence','tags'):
                            self.assertEqual(stored[field], arguments[field])
                        process, response = self.invoke_wrapper(entry, registry,
                            {'api_version':1,'operation':'show','arguments':{'id':stored['id']}}, constrained, oem, pipe)
                        self.assertEqual(process.returncode,0)
                        self.assertEqual(response['result']['record']['title'], arguments['title'])

    def test_formal_wrapper_rejects_invalid_input_without_writes(self):
        entry, registry = self.wrapper_fixture()
        before = self.store.read_bytes()
        for request in ('not-json', {'api_version':1,'operation':'search','arguments':{'task_type':'video_import','query':'抖音','unexpected':'值'}}):
            process, response = self.invoke_wrapper(entry, registry, request, constrained=True, oem=True)
            self.assertEqual(process.returncode,1)
            self.assertEqual(response['status'],'rejected')
            self.assertEqual(self.store.read_bytes(),before)
        process, response = self.invoke_wrapper(entry, registry.with_name('missing.json'),
            {'api_version':1,'operation':'status','arguments':{}}, constrained=True)
        self.assertEqual(process.returncode,1)
        self.assertEqual(response['status'],'rejected')
        self.assertEqual(self.store.read_bytes(),before)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--temp-root", required=True)
    parser.add_argument("--powershell", required=True, help="Existing Registry-resolved PowerShell 7.5+ executable")
    args = parser.parse_args()
    POWERSHELL = Path(args.powershell)
    if not POWERSHELL.is_file():
        raise SystemExit('Existing PowerShell unavailable; no installation')
    TEST_ROOT = Path(args.temp_root).absolute()
    api.no_links(TEST_ROOT)
    need_temp = "Temp" in TEST_ROOT.parts and "SecondBrain" in TEST_ROOT.parts
    if not need_temp or api.within(TEST_ROOT.resolve(), ENTRY.parents[3].resolve()):
        raise SystemExit("Tests require an external Temp/SecondBrain task directory")
    TEST_ROOT.mkdir(parents=True, exist_ok=True)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(EvolutionTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {"tests": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
              "passed": result.wasSuccessful(), "scope": "isolated fixtures, no production approvals",
              "details": [{"test": str(test), "traceback": trace} for test, trace in result.failures + result.errors]}
    api.atomic_json(TEST_ROOT / "test-results.json", report)
    raise SystemExit(0 if result.wasSuccessful() else 1)
