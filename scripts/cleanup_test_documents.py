"""Remove integration-test documents and jobs while preserving interview demo samples."""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "runtime"
DATABASE = DATA_ROOT / "research.sqlite"
GENERATED_NAME = re.compile(r"^\d{10}_(?:protocol|measurements|scanned)\.", re.IGNORECASE)
GENERATED_TASK = re.compile(
    r"^(?:Custom skill|Real RNA-seq|Retrieval|Compute regression) \d{10}$"
)


def main() -> None:
    state_path = ROOT / "data" / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    generated_task_ids = {
        task["id"]
        for task in state.get("taskList", [])
        if GENERATED_TASK.fullmatch(task.get("title", ""))
    }

    removed_files: list[Path] = []
    removed_document_ids: set[str] = set()
    removed_jobs: list[str] = []
    with sqlite3.connect(DATABASE) as connection:
        records = connection.execute(
            "SELECT id, body FROM records WHERE kind='document'"
        ).fetchall()
        for document_id, raw_body in records:
            body = json.loads(raw_body)
            if not GENERATED_NAME.match(body.get("name", "")):
                continue
            removed_document_ids.add(document_id)
            if body.get("path"):
                removed_files.append(Path(body["path"]))

        jobs = connection.execute("SELECT id, body FROM records WHERE kind='job'").fetchall()
        for job_id, raw_body in jobs:
            body = json.loads(raw_body)
            if body.get("taskId") in generated_task_ids:
                removed_jobs.append(job_id)

        connection.executemany(
            "DELETE FROM records WHERE kind='document' AND id=?",
            [(document_id,) for document_id in sorted(removed_document_ids)],
        )
        connection.executemany(
            "DELETE FROM records WHERE kind='job' AND id=?",
            [(job_id,) for job_id in removed_jobs],
        )

    for file_path in removed_files:
        file_path.unlink(missing_ok=True)
    for job_id in removed_jobs:
        job_dir = DATA_ROOT / "jobs" / job_id
        if job_dir.exists():
            for child in job_dir.iterdir():
                child.unlink(missing_ok=True)
            job_dir.rmdir()

    print(
        json.dumps(
            {
                "removedDocuments": len(removed_document_ids),
                "removedJobs": len(removed_jobs),
                "preservedDemoDocuments": 3,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
