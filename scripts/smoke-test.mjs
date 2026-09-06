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

const log = (message) => console.log(`✓ ${message}`);
await request('/api/auth/login', { method: 'POST' });
log('登录鉴权');
const resetResponse = await fetch(base + '/api/tasks', { method: 'POST', headers: { cookie, origin: base } });
if (resetResponse.ok) log('重置演示状态');
else if (resetResponse.status !== 404) throw new Error(`POST /api/tasks -> ${resetResponse.status}`);
const initial = await request('/api/tasks');
if (!initial.task) throw new Error('任务快照缺失');
log(`读取任务：${initial.task.title}`);
const answers = {
  format: 'Count 矩阵', comparison: '处理组 vs 对照组', organism: '人类', deliverable: '可发表结果',
};
const clarification = await request('/api/tasks/task_demo_rnaseq/clarifications', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers }),
});
if (clarification.task?.status !== 'awaiting_approval') throw new Error('澄清未进入待审批');
log('提交澄清并生成计划');
const approved = await request('/api/workflows/workflow_demo/approve', { method: 'POST' });
if (!approved.task) throw new Error('审批响应缺失');
log('审批分析计划');
const run = await request('/api/runs', { method: 'POST' });
if (!run.runId) throw new Error('运行 ID 缺失');
log(`创建运行：${run.runId}`);
const eventResponse = await fetch(`${base}/api/runs/${run.runId}/events?after=0`, { headers: { cookie } });
if (!eventResponse.ok) throw new Error(`事件流 -> ${eventResponse.status}`);
const reader = eventResponse.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
const deadline = Date.now() + 1800;
while (Date.now() < deadline) {
  const result = await Promise.race([reader.read(), new Promise(resolve => setTimeout(() => resolve({ done: true }), 250))]);
  if (result.done) break;
  buffer += decoder.decode(result.value, { stream: true });
  if (buffer.includes('run.started')) break;
}
await reader.cancel();
if (!buffer.includes('run.started')) throw new Error('未收到 run.started 事件');
log('收到 SSE 运行事件');
await request(`/api/runs/${run.runId}/cancel`, { method: 'POST' });
log('取消运行');
console.log('冒烟测试通过');
