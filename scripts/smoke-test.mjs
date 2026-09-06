const base = process.argv[2] || 'http://127.0.0.1:3000';
let cookie = '';

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: 'manual' });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
  return body;
}

async function expectStatus(path, status, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: 'manual' });
  if (response.status !== status) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}, expected ${status}`);
  return response;
}

async function waitForTaskStatus(status, timeout = 6000) {
  const deadline = Date.now() + timeout;
  let current = null;
  while (Date.now() < deadline) {
    current = await request('/api/tasks');
    if (current.task?.status === status) return current.task;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`任务未在 ${timeout}ms 内进入 ${status}，当前为 ${current?.task?.status}`);
}

async function readEvents(runId, after = 0, duration = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), duration);
  const response = await fetch(`${base}/api/runs/${runId}/events?after=${after}`, {
    headers: cookie ? { cookie } : {},
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`事件流 -> ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
    }
  } catch (error) {
    if (error?.name !== 'AbortError') throw error;
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
  return [...buffer.matchAll(/data: (.+)\n/g)].map((match) => JSON.parse(match[1]));
}

async function preparePlan() {
  const answers = { format: 'Count 矩阵', comparison: '处理组 vs 对照组', organism: '人类', deliverable: '可发表结果' };
  const clarification = await request('/api/tasks/task_demo_rnaseq/clarifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ answers }),
  });
  if (clarification.task?.status !== 'awaiting_approval') throw new Error('澄清未进入待审批');
  const approved = await request('/api/workflows/workflow_demo/approve', { method: 'POST', headers: { origin: base } });
  if (!approved.task) throw new Error('审批响应缺失');
}

async function resetAndPrepare() {
  await request('/api/tasks', { method: 'POST', headers: { origin: base } });
  await preparePlan();
}

const log = (message) => console.log(`✓ ${message}`);
await expectStatus('/api/tasks', 401);
await request('/api/auth/login', { method: 'POST' });
log('登录鉴权');
await request('/api/tasks', { method: 'POST', headers: { origin: base } });
log('重置演示状态');
const initial = await request('/api/tasks');
if (!initial.task) throw new Error('任务快照缺失');
log(`读取任务：${initial.task.title}`);
await expectStatus('/api/tasks/task_demo_rnaseq/clarifications', 400, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ answers: { format: '' } }),
});
log('错误澄清请求返回 400');
await preparePlan();
log('提交澄清并审批计划');

const config = await request('/api/demo/config');
if (config.config?.failAt !== 'design') throw new Error('默认失败节点配置缺失');
log('读取演示配置');
await expectStatus('/api/demo/config', 403, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ failAt: 'none' }),
});
log('跨域写请求被拒绝');
await request('/api/demo/config', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ runnerDelayMs: 500, codeChunkMs: 1 }),
});
log('更新可配置演示参数');

const run = await request('/api/runs', { method: 'POST', headers: { origin: base } });
if (!run.runId) throw new Error('运行 ID 缺失');
log(`创建失败演示运行：${run.runId}`);
const events = await readEvents(run.runId, 0, 1800);
const eventTypes = new Set(events.map((event) => event.type));
for (const type of ['run.started', 'intent.detected', 'retrieval.started', 'retrieval.hit', 'evidence.reranked', 'grounding.bound']) {
  if (!eventTypes.has(type)) throw new Error(`缺少 SSE 事件：${type}`);
}
log(`SSE 事件完整：${[...eventTypes].join('、')}`);
const failed = await waitForTaskStatus('failed');
if (failed.nodes?.find((node) => node.id === 'design')?.status !== 'failed') throw new Error('失败节点状态缺失');
log('失败分支和失败节点可追溯');
const retry = await request(`/api/runs/${run.runId}/nodes/design/retry`, { method: 'POST', headers: { origin: base } });
if (retry.status !== 'running') throw new Error('局部重试未启动');
const succeeded = await waitForTaskStatus('succeeded');
if (succeeded.artifacts?.length !== 3) throw new Error('重试后结果产物不完整');
log('局部重试并生成 3 个结果产物');

await resetAndPrepare();
await request('/api/demo/config', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ failAt: 'none', runnerDelayMs: 500 }),
});
const successRun = await request('/api/runs', { method: 'POST', headers: { origin: base } });
await waitForTaskStatus('succeeded');
log(`成功分支完成：${successRun.runId}`);

await resetAndPrepare();
const cancelRun = await request('/api/runs', { method: 'POST', headers: { origin: base } });
await request(`/api/runs/${cancelRun.runId}/cancel`, { method: 'POST', headers: { origin: base } });
const cancelled = await waitForTaskStatus('cancelled');
if (cancelled.status !== 'cancelled') throw new Error('取消状态未持久化');
log('取消分支完成');

await request('/api/tasks', { method: 'POST', headers: { origin: base } });
console.log('冒烟测试通过');
