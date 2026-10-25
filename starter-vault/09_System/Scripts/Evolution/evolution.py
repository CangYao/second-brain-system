"""Bounded task, experience, review and proposal ledger; Python standard library only.

No network/model calls, target-file edits, arbitrary commands or implicit approvals.
The ledger proves recorded transitions and fingerprints, not semantic truth or human identity.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import uuid

KINDS = ("tasks", "experiences", "reviews", "proposals")
DIMENSIONS = {"structure", "evidence", "outcome"}
RESULTS = {"passed", "failed", "blocked", "not_run"}
TASK_TYPES = {"video_import", "book_update", "daily_record", "thought_record", "knowledge_record",
              "inbox_process", "personal_model_update", "vault_ask", "research", "system_change"}
OPS = {
    "begin": ({"key", "title", "task_type", "scope", "sources"}, {"used_experience_ids"}),
    "finish": ({"task_id", "outcome", "summary", "artifacts", "checks", "distillation"}, set()),
    "lesson": ({"key", "title", "task_type", "tags", "when", "action", "exceptions", "evidence"}, set()),
    "search": ({"task_type", "query"}, {"include_candidates"}),
    "activate": ({"experience_id", "record_sha256", "explicit_approval", "approval_evidence", "validation_evidence"}, set()),
    "review": ({"key", "subject", "reason", "evidence"}, set()),
    "resolve_review": ({"review_id", "disposition", "explanation", "evidence"}, {"explicit_approval"}),
    "propose": ({"key", "title", "target", "expected_after_sha256", "diff", "reason", "evidence", "verification_plan", "rollback_plan"}, set()),
    "decide": ({"proposal_id", "proposal_sha256", "decision", "approval_evidence"}, {"explicit_approval"}),
    "verify_proposal": ({"proposal_id", "checks", "evidence"}, set()),
    "show": ({"id"}, set()), "status": (set(), set()),
}


class Rejected(ValueError):
    pass


def need(condition, message):
    if not condition:
        raise Rejected(message)


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def file_digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def text(value, field, limit=4000):
    need(isinstance(value, str) and bool(value.strip()) and len(value) <= limit,
         f"{field}: nonempty text up to {limit} characters required")
    return value.strip()


def strings(value, field, empty=False):
    need(isinstance(value, list) and len(value) <= 80 and (empty or bool(value)), f"{field}: bounded list required")
    return [text(item, field, 2000) for item in value]


def key(value):
    need(isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}", value), "Invalid record key")
    return value


def sha(value):
    need(isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{64}", value), "Invalid SHA-256")
    return value.lower()


def no_links(path):
    for item in (path, *path.parents):
        need(not item.is_symlink() and not os.path.isjunction(item), "Symlink/junction path rejected")


def within(path, root):
    return path == root or root in path.parents


def atomic_json(path, value):
    no_links(path)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def check_results(value, completed=False):
    need(isinstance(value, list) and 3 <= len(value) <= 40, "Provide separate structure/evidence/outcome checks")
    dimensions, cleaned = set(), []
    for item in value:
        need(isinstance(item, dict) and set(item) == {"name", "dimension", "result", "evidence"}, "Invalid check fields")
        need(item["dimension"] in DIMENSIONS and item["result"] in RESULTS, "Invalid check state")
        dimensions.add(item["dimension"])
        cleaned.append({"name": text(item["name"], "check name", 200), "dimension": item["dimension"],
                        "result": item["result"], "evidence": strings(item["evidence"], "check evidence")})
    need(dimensions == DIMENSIONS, "All three check dimensions required")
    if completed:
        need(all(c["result"] == "passed" for c in cleaned), "Unpassed checks cannot be completed")
    return cleaned


class Ledger:
    def __init__(self, workspace, run_root):
        self.workspace, self.run_root = Path(workspace).absolute(), Path(run_root).absolute()
        no_links(self.workspace)
        no_links(self.run_root)
        need(self.workspace.is_dir(), "Workspace not found")
        self.folder = self.workspace / "09_System" / "Evolution"
        self.path = self.folder / ".records.json"
        no_links(self.path)

    def load(self):
        need(self.path.is_file(), "Approved .records.json not initialized")
        need(self.path.stat().st_size <= 8 * 1024 * 1024, "Ledger exceeds phase 1 size budget")
        data = json.loads(self.path.read_text(encoding="utf-8-sig"))
        need(set(data) == {"schema_version", "revision", *KINDS, "events"} and data["schema_version"] == 1,
             "Unsupported ledger schema")
        need(type(data["revision"]) is int and data["revision"] >= 0, "Invalid revision")
        ids = []
        for kind in (*KINDS, "events"):
            need(isinstance(data[kind], list), "Invalid collection")
        for kind in KINDS:
            for record in data[kind]:
                need(isinstance(record, dict) and isinstance(record.get("id"), str), "Invalid record")
                ids.append(record["id"])
        need(len(ids) == len(set(ids)), "Duplicate record IDs")
        return data

    @contextmanager
    def locked(self):
        no_links(self.path)
        lock = self.folder / ".evolution.lock"
        try:
            stream = lock.open("x", encoding="utf-8")
        except FileExistsError as exc:
            raise Rejected("Ledger busy; inspect lock without blind deletion") from exc
        try:
            stream.write(str(os.getpid()))
            stream.close()
            yield
        finally:
            stream.close()
            lock.unlink()

    def relative(self, value, existing=True):
        value = text(value, "relative path", 1000).replace("\\", "/")
        parts = PurePosixPath(value).parts
        need(parts and not PurePosixPath(value).is_absolute() and ".." not in parts and
             not any(":" in p for p in parts), "Workspace-relative path required")
        need(parts[0].casefold() not in {".git", ".obsidian", ".agents", ".codex", "05_personal", "00_inbox"}, "Protected target")
        need(not any(p.startswith(".") for p in parts), "Hidden target protected")
        need(not value.casefold().startswith(("09_system/backups/", "09_system/evolution/")), "Ledger/backup target protected")
        target = self.workspace.joinpath(*parts)
        no_links(target)
        need(within(target.resolve(), self.workspace.resolve()), "Target escapes workspace")
        if existing:
            need(target.is_file(), "Target file not found")
        return target

    def lookup(self, data, identifier, kind=None):
        for group in ((kind,) if kind else KINDS):
            for record in data[group]:
                if record["id"] == identifier:
                    return record
        raise Rejected("Record not found")

    def existing(self, data, kind, value):
        identifier = kind.rstrip("s") + "_" + key(value)
        return next((r for r in data[kind] if r["id"] == identifier), None)

    def add(self, data, kind, value, fields):
        need(self.existing(data, kind, value) is None, "Record already exists")
        record = {"id": kind.rstrip("s") + "_" + key(value), "created": now(), "updated": now(), **fields}
        data[kind].append(record)
        return record

    def artifacts(self, values):
        result = []
        for value in strings(values, "artifacts"):
            path = Path(value)
            if not path.is_absolute():
                path = self.relative(value)
            no_links(path)
            resolved = path.resolve()
            if within(resolved, self.workspace.resolve()):
                self.relative(str(resolved.relative_to(self.workspace.resolve())))
            else:
                need(within(resolved, self.run_root.resolve()), "Artifact outside task Temp root")
            need(path.is_file() and path.stat().st_size > 0, "Nonempty existing artifact required")
            result.append({"path": str(path), "sha256": file_digest(path), "bytes": path.stat().st_size})
        return result

    def handle(self, operation, args):
        need(operation in OPS, "Unknown operation")
        required, optional = OPS[operation]
        need(isinstance(args, dict) and required <= args.keys() and args.keys() <= required | optional, "Missing/unknown arguments")
        if operation in {"status", "search", "show"}:
            return self.dispatch(self.load(), operation, args)
        with self.locked():
            data = self.load()
            before = digest(data)
            result = self.dispatch(data, operation, args)
            if digest(data) != before:
                data["revision"] += 1
                data["events"].append({"sequence": len(data["events"]) + 1, "at": now(),
                                       "operation": operation, "record_id": result.get("id")})
                atomic_json(self.path, data)
            return result

    def dispatch(self, data, operation, a):
        if operation == "status":
            return {"revision": data["revision"], "counts": {k: len(data[k]) for k in KINDS},
                    "pending_reviews": [r["id"] for r in data["reviews"] if r["lifecycle"] == "open"],
                    "pending_proposals": [r["id"] for r in data["proposals"] if r["lifecycle"] in {"proposed", "deferred", "approved"}],
                    "active_experiences": [r["id"] for r in data["experiences"] if r["lifecycle"] == "active"]}
        if operation == "show":
            record = self.lookup(data, a["id"])
            return {"record": record, "record_sha256": digest(record), "trust": "UNTRUSTED_DATA"}
        if operation == "begin":
            need(a["task_type"] in TASK_TYPES, "Unknown task type")
            scope = strings(a["scope"], "scope")
            for item in scope:
                self.relative(item, existing=False)
            used = strings(a.get("used_experience_ids", []), "used_experience_ids", empty=True)
            for identifier in used:
                experience = self.lookup(data, identifier, "experiences")
                need(experience["lifecycle"] == "active", "Only active experiences can be adopted")
                need(experience["task_type"] == a["task_type"], "Adopted experience has a different task scope")
            fields = {"title": text(a["title"], "title", 240), "task_type": a["task_type"], "scope": scope,
                      "sources": strings(a["sources"], "sources"), "used_experience_ids": used, "lifecycle": "running"}
            record = self.existing(data, "tasks", a["key"])
            if record:
                need(all(record.get(k) == v for k, v in fields.items() if k != "lifecycle"), "Task key has different intent")
                return {"id": record["id"], "created": False, "lifecycle": record["lifecycle"]}
            record = self.add(data, "tasks", a["key"], fields)
            return {"id": record["id"], "created": True, "lifecycle": "running"}
        if operation == "finish":
            record = self.lookup(data, a["task_id"], "tasks")
            need(a["outcome"] in {"completed", "partial", "blocked", "failed"}, "Invalid outcome")
            checks = check_results(a["checks"], a["outcome"] == "completed")
            need(a["distillation"] in {"none", "reuse", "candidate", "review", "proposal"}, "Invalid distillation")
            payload = {"lifecycle": a["outcome"], "summary": text(a["summary"], "summary"),
                       "artifacts": self.artifacts(a["artifacts"]), "checks": checks, "distillation": a["distillation"]}
            if record["lifecycle"] != "running":
                need(all(record.get(k) == v for k, v in payload.items()), "Closed task cannot be overwritten")
                return {"id": record["id"], "changed": False, "lifecycle": record["lifecycle"]}
            run = self.run_root / record["id"]
            no_links(run)
            run.mkdir(parents=True, exist_ok=True)
            atomic_json(run / "result.json", {"task_id": record["id"], **payload})
            record.update(payload, updated=now(), run_reference=str(run / "result.json"))
            return {"id": record["id"], "changed": True, "lifecycle": record["lifecycle"]}
        if operation == "lesson":
            need(a["task_type"] in TASK_TYPES, "Unknown task type")
            fields = {"title": text(a["title"], "title", 240), "task_type": a["task_type"],
                      "tags": strings(a["tags"], "tags"), "when": text(a["when"], "when"),
                      "action": text(a["action"], "action"), "exceptions": text(a["exceptions"], "exceptions"),
                      "evidence": strings(a["evidence"], "evidence")}
            record = self.existing(data, "experiences", a["key"])
            if record:
                if all(record[k] == v for k, v in fields.items()):
                    return {"id": record["id"], "changed": False, "lifecycle": record["lifecycle"]}
                need(record["task_type"] == fields["task_type"], "Experience scope cannot change under same ID")
                history = {k: v for k, v in record.items() if k != "history"}
                record.setdefault("history", []).append(history)
                record.update(fields, lifecycle="candidate", updated=now())
                record.pop("activation", None)
            else:
                record = self.add(data, "experiences", a["key"], {**fields, "lifecycle": "candidate", "history": []})
            if any(r["subject"] == record["id"] and r["lifecycle"] == "open" for r in data["reviews"]):
                record["lifecycle"] = "review"
            return {"id": record["id"], "changed": True, "lifecycle": record["lifecycle"], "record_sha256": digest(record)}
        if operation == "search":
            need(a["task_type"] in TASK_TYPES, "Unknown task type")
            query = text(a["query"], "query", 500).casefold()
            include = a.get("include_candidates", False)
            need(type(include) is bool, "include_candidates must be boolean")
            terms = set(re.findall(r"[a-z0-9_-]+|[\u3400-\u9fff]", query))
            terms.update(query[i:i+2] for i in range(len(query)-1) if re.fullmatch(r"[\u3400-\u9fff]{2}", query[i:i+2]))
            hits = []
            for record in data["experiences"]:
                if record["task_type"] != a["task_type"] or record["lifecycle"] not in ({"active", "candidate"} if include else {"active"}):
                    continue
                corpus = " ".join([record["title"], record["when"], *record["tags"]]).casefold()
                score = sum(len(t) for t in terms if t in corpus)
                if score:
                    hits.append({k: record[k] for k in ("id", "title", "lifecycle", "when", "action", "exceptions", "evidence")} | {"score": score})
            return {"mode": "candidate_preview" if include else "active_only", "trust": "UNTRUSTED_DATA",
                    "hits": sorted(hits, key=lambda h: (-h["score"], h["id"]))[:5]}
        if operation == "activate":
            record = self.lookup(data, a["experience_id"], "experiences")
            need(record["lifecycle"] == "candidate", "Only candidates can be activated")
            need(sha(a["record_sha256"]) == digest(record), "Stale experience approval")
            need(a["explicit_approval"] is True, "Explicit approval required")
            need(not any(r["subject"] == record["id"] and r["lifecycle"] == "open" for r in data["reviews"]), "Open reviews must be resolved")
            record.update(lifecycle="active", updated=now(), activation={
                "approval_evidence": text(a["approval_evidence"], "approval_evidence"),
                "validation_evidence": strings(a["validation_evidence"], "validation_evidence")})
            return {"id": record["id"], "lifecycle": "active"}
        if operation == "review":
            subject = text(a["subject"], "subject")
            experience = next((r for r in data["experiences"] if r["id"] == subject), None)
            if not experience:
                self.relative(subject)
            fields = {"subject": subject, "reason": text(a["reason"], "reason"), "evidence": strings(a["evidence"], "evidence")}
            record = self.existing(data, "reviews", a["key"])
            if record:
                need(all(record[k] == v for k, v in fields.items()), "Review key has different evidence")
                return {"id": record["id"], "created": False, "lifecycle": record["lifecycle"]}
            if experience:
                fields["previous_lifecycle"] = experience["lifecycle"]
                experience.update(lifecycle="review", updated=now())
            record = self.add(data, "reviews", a["key"], {**fields, "lifecycle": "open"})
            return {"id": record["id"], "created": True, "lifecycle": "open"}
        if operation == "resolve_review":
            record = self.lookup(data, a["review_id"], "reviews")
            need(record["lifecycle"] == "open", "Review is already resolved")
            need(a["disposition"] in {"keep", "revise", "deprecate"}, "Invalid disposition")
            if a["disposition"] == "deprecate":
                need(a.get("explicit_approval") is True, "Deprecation requires explicit approval")
            record.update(lifecycle="resolved", disposition=a["disposition"], explanation=text(a["explanation"], "explanation"),
                          resolution_evidence=strings(a["evidence"], "evidence"), updated=now())
            experience = next((r for r in data["experiences"] if r["id"] == record["subject"]), None)
            other = any(r["id"] != record["id"] and r["subject"] == record["subject"] and r["lifecycle"] == "open" for r in data["reviews"])
            if experience and not other:
                previous = record.get("previous_lifecycle", "candidate")
                restored = previous if previous in {"active", "candidate", "deprecated"} else "candidate"
                if restored == "active" and "activation" not in experience:
                    restored = "candidate"
                state = restored if a["disposition"] == "keep" else "deprecated" if a["disposition"] == "deprecate" else "candidate"
                experience.update(lifecycle=state, updated=now())
            return {"id": record["id"], "lifecycle": "resolved", "disposition": a["disposition"]}
        if operation == "propose":
            target = self.relative(a["target"])
            fields = {"title": text(a["title"], "title", 240), "target": target.relative_to(self.workspace).as_posix(),
                      "before_sha256": file_digest(target), "expected_after_sha256": sha(a["expected_after_sha256"]),
                      "diff": text(a["diff"], "diff", 24000), "reason": text(a["reason"], "reason"),
                      "evidence": strings(a["evidence"], "evidence"), "verification_plan": text(a["verification_plan"], "verification_plan"),
                      "rollback_plan": text(a["rollback_plan"], "rollback_plan")}
            need(fields["before_sha256"] != fields["expected_after_sha256"], "Proposal must describe an actual change")
            record = self.existing(data, "proposals", a["key"])
            if record:
                need(all(record[k] == v for k, v in fields.items()), "Proposal key has different content")
                return {"id": record["id"], "created": False, "proposal_sha256": digest(record)}
            record = self.add(data, "proposals", a["key"], {**fields, "lifecycle": "proposed"})
            return {"id": record["id"], "created": True, "proposal_sha256": digest(record)}
        if operation == "decide":
            record = self.lookup(data, a["proposal_id"], "proposals")
            need(record["lifecycle"] in {"proposed", "deferred"}, "Proposal cannot be decided in this state")
            need(a["decision"] in {"approve", "reject", "defer"}, "Invalid decision")
            need(sha(a["proposal_sha256"]) == digest(record), "Stale proposal approval")
            if a["decision"] == "approve":
                need(a.get("explicit_approval") is True, "Explicit approval required")
                need(file_digest(self.relative(record["target"])) == record["before_sha256"], "Target changed since proposal")
            record.update(lifecycle={"approve": "approved", "reject": "rejected", "defer": "deferred"}[a["decision"]],
                          decision_evidence=text(a["approval_evidence"], "approval_evidence"), updated=now())
            return {"id": record["id"], "lifecycle": record["lifecycle"], "target_written": False}
        if operation == "verify_proposal":
            record = self.lookup(data, a["proposal_id"], "proposals")
            need(record["lifecycle"] == "approved", "Unapproved proposal cannot be verified as applied")
            checks = check_results(a["checks"], True)
            need(file_digest(self.relative(record["target"])) == record["expected_after_sha256"], "Target does not match approved result")
            record.update(lifecycle="verified", checks=checks, verification_evidence=strings(a["evidence"], "evidence"), updated=now())
            return {"id": record["id"], "lifecycle": "verified", "target_written": False}
        raise Rejected("Unsupported operation")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--initialize", action="store_true")
    options = parser.parse_args()
    try:
        registry = Path(options.registry).absolute()
        entries = json.loads(registry.read_text(encoding="utf-8-sig"))
        tools = [r for r in entries if r.get("tool_name") == "video-intake"]
        need(len(tools) == 1, "Registry video-intake entry must be unique")
        workspace = Path(tools[0]["canonical_path"]).parents[2]
        need(Path(__file__).resolve().parents[3] == workspace.resolve(), "Entry is outside registered workspace")
        run_root = Path(options.run_root).absolute()
        need(not within(run_root.resolve(), workspace.resolve()) and not within(workspace.resolve(), run_root.resolve()), "Run root must be disjoint from the Vault")
        engine = Ledger(workspace, run_root)
        if options.initialize:
            need(not engine.path.exists(), "Existing governance store retained; initialization refused")
            engine.folder.mkdir(parents=True, exist_ok=True)
            no_links(engine.path)
            with engine.path.open("x", encoding="utf-8", newline="\n") as stream:
                json.dump({"schema_version": 1, "revision": 0, **{kind: [] for kind in KINDS}, "events": []}, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
            print(json.dumps({"status": "initialized", "api_version": 1, "private_history_imported": False}))
            return 0
        raw = sys.stdin.buffer.read(256 * 1024 + 1)
        need(len(raw) <= 256 * 1024, "Request exceeds 256 KiB")
        request = json.loads(raw.decode("utf-8-sig"))
        need(isinstance(request, dict) and set(request) == {"api_version", "operation", "arguments"}, "Invalid request envelope")
        need(type(request["api_version"]) is int and request["api_version"] == 1, "Unsupported API version")
        result = engine.handle(request["operation"], request["arguments"])
        print(json.dumps({"status": "success", "api_version": 1, "result": result}, ensure_ascii=True))
        return 0
    except (Rejected, OSError, ValueError, KeyError, TypeError, StopIteration) as exc:
        print(json.dumps({"status": "rejected", "error": str(exc)[:600]}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
