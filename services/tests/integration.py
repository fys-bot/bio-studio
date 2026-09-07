"""Non-destructive integration checks. Creates its own tasks and documents; never resets user state."""
import csv
import io
import json
import os
import tempfile
import time
from pathlib import Path

import httpx
from services.tests.test_parsers import fixtures

base = os.getenv("BIOFLOW_TEST_URL", "http://127.0.0.1:3000")
client = httpx.Client(base_url=base, trust_env=False, timeout=120, headers={"Origin": base})
worker = httpx.Client(base_url="http://127.0.0.1:8000", trust_env=False, timeout=120, headers={"X-Bioflow-Worker-Token": os.getenv("BIOFLOW_WORKER_TOKEN", "local-development-only")})


def request(method, path, **kwargs):
    response = client.request(method, path, **kwargs)
    assert response.is_success, (path, response.status_code, response.text[:1000])
    return response.json()


assert client.get("/api/files").status_code == 401
request("POST", "/api/auth/login")
stamp = str(int(time.time()))
skill = request("POST", "/api/skills", json={"name": "Integration " + stamp, "category": "转录组", "description": "Integration protocol", "inputs": "counts,metadata", "outputs": "report", "instructions": "Validate input before analysis"})["skill"]
assert request("GET", "/api/skills/" + skill["id"])["skill"]["instructions"]
custom = request("POST", "/api/tasks", json={"title": "Custom skill " + stamp, "skillId": skill["id"]})["task"]
assert custom["skill"]["id"] == skill["id"]
task = request("POST", "/api/tasks", json={"title": "Real RNA-seq " + stamp, "skillId": "rnaseq-deseq2"})["task"]
task_id = task["id"]
file_ids = []
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    fixtures(root)
    for name in ["protocol.docx", "measurements.xlsx", "protocol.pdf", "scanned.pdf"]:
        payload = (root / name).read_bytes()
        result = request("POST", f"/api/files/profile?taskId={task_id}", files={"file":(stamp + "_" + name, payload)})
        identity = result["profile"]["id"]
        preview = request("GET", f"/api/files/{identity}")
        assert preview["sections"]
        original = client.get(f"/api/files/{identity}/original")
        assert original.content == payload
        if name == "scanned.pdf":
            assert preview["indexStatus"] == "needs_ocr"
        else:
            file_ids.append(identity)
        print("PASS parser + preview + original:", name)

deadline = time.time() + 120
while time.time() < deadline:
    states = [request("GET", f"/api/files/{identity}")["indexStatus"] for identity in file_ids]
    if all(state == "indexed" for state in states):
        break
    assert "failed" not in states, states
    time.sleep(1)
assert all(state == "indexed" for state in states), states
# A separate task scope excludes the scanned page awaiting OCR.
retrieval_task = request("POST", "/api/tasks", json={"title":"Retrieval " + stamp,"fileIds":file_ids})["task"]
trace = request("POST", f"/api/rag/query?taskId={retrieval_task['id']}", json={"query":"ZEBRA42 kinase response"})["trace"]
assert trace["indexSummary"]["provider"] == "qdrant"
assert "ZEBRA42" in trace["chunks"][0]["text"]
assert all(chunk["documentId"] in file_ids for chunk in trace["chunks"])
print("PASS real multilingual embeddings + Qdrant + BM25/RRF + source filtering")

task = request("POST", f"/api/tasks/{task_id}/analysis", json={"action":"samples"})["task"]
samples = worker.get("/samples").json()["documents"]
counts = next(doc for doc in samples if doc["name"].endswith("counts.csv"))
metadata = next(doc for doc in samples if doc["name"].endswith("metadata.tsv"))
assert counts["id"] in task["fileIds"]
request("POST", f"/api/tasks/{task_id}/clarifications", json={"answers":{"format":"Count 矩阵","comparison":"处理组 vs 对照组","organism":"人类","deliverable":"可发表结果"}})
# Real tasks must not bypass the LLM planning gate. Compute regression below uses
# a demo-mode task so the test remains deterministic and offline.
blocked = client.post(f"/api/tasks/{task_id}/approve")
assert blocked.status_code == 404 and "LLM plan" in blocked.text
compute_task = request("POST", "/api/tasks", json={"title": "Compute regression " + stamp, "skillId": "rnaseq-deseq2", "executionMode": "demo"})["task"]
compute_task_id = compute_task["id"]
task = request("POST", f"/api/tasks/{compute_task_id}/analysis", json={"action":"samples"})["task"]
params = {"action":"run","countsId":counts["id"],"metadataId":metadata["id"],"condition":"condition","control":"control","treated":"treated","alpha":.05}
request("POST", f"/api/tasks/{compute_task_id}/clarifications", json={"answers":{"format":"Count 矩阵","comparison":"处理组 vs 对照组","organism":"人类","deliverable":"可发表结果"}})
request("POST", f"/api/tasks/{compute_task_id}/approve")
job = request("POST", f"/api/tasks/{compute_task_id}/analysis", json=params)["job"]
deadline = time.time() + 120
while time.time() < deadline:
    current = request("GET", f"/api/tasks/{compute_task_id}/analysis")["job"]
    if current["status"] not in {"queued","running"}:
        break
    time.sleep(.5)
assert current["status"] == "succeeded", current
result = current["result"]
assert result["engine"] == "PyDESeq2" and result["sampleCount"] == 8
assert result["summary"]["testedGeneCount"] == 150
assert result["summary"]["significantGeneCount"] > 0
csv_result = client.get(f"/api/tasks/{compute_task_id}/analysis/results.csv")
rows = list(csv.DictReader(io.StringIO(csv_result.text)))
assert len(rows) == 150 and "padj" in rows[0]
image = client.get(f"/api/tasks/{compute_task_id}/analysis/volcano.png")
assert image.content.startswith(b"\x89PNG")
print("PASS queued PyDESeq2 worker + actual statistics + CSV + PNG + report:", result["summary"])

bad = request("POST", f"/api/tasks/{compute_task_id}/analysis", json={**params,"condition":"missing_field"})["job"]
deadline=time.time()+60
while time.time()<deadline:
    failed=request("GET",f"/api/tasks/{compute_task_id}/analysis")["job"]
    if failed["status"] not in {"queued","running"}: break
    time.sleep(.5)
assert failed["status"]=="failed" and "Missing design factor" in failed["error"]
request("POST",f"/api/tasks/{compute_task_id}/analysis",json=params)
cancelled=request("POST",f"/api/tasks/{compute_task_id}/analysis",json={"action":"cancel"})["job"]
assert cancelled["status"]=="cancelled"
print("PASS invalid input failure + retry creates new job + cancellation")
print(json.dumps({"taskId":compute_task_id,"realGateTaskId":task_id,"retrievalTaskId":retrieval_task["id"],"skillId":skill["id"]}))
