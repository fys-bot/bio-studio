import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export type NodeStatus = 'succeeded' | 'running' | 'blocked' | 'failed' | 'queued' | 'cancelled';
export type RunEvent = { id:number; runId:string; type:string; nodeId?:string; payload:Record<string,unknown>; createdAt:string };

const initialNodes = [
  { id:'input', label:'读取 RNA-seq 计数矩阵', kind:'input', status:'succeeded' as NodeStatus, x:50, y:220, detail:'counts.csv · 24 个样本' },
  { id:'qc', label:'样本质量控制', kind:'analysis', status:'succeeded' as NodeStatus, x:280, y:120, detail:'2 个警告已处理' },
  { id:'design', label:'构建设计矩阵', kind:'gate', status:'failed' as NodeStatus, x:280, y:320, detail:'缺少 condition 列', error:'请映射 metadata.condition 后重试' },
  { id:'de', label:'DESeq2 差异表达', kind:'analysis', status:'blocked' as NodeStatus, x:540, y:220, detail:'等待上游步骤完成' },
  { id:'volcano', label:'火山图 · 显著基因', kind:'artifact', status:'blocked' as NodeStatus, x:800, y:120, detail:'SVG + 交互式图表' },
  { id:'report', label:'科研分析报告', kind:'artifact', status:'blocked' as NodeStatus, x:800, y:320, detail:'方法、结果与证据' },
];

type State = { task: any; events: RunEvent[]; running:boolean; cancelled:boolean; nextEvent:number };
const g = globalThis as typeof globalThis & { __bioflow?:State };
const statePath=path.join(process.cwd(),'data','state.json');
const defaultState=():State=>({ task:{ id:'task_demo_rnaseq', title:'RNA-seq 差异表达分析', goal:'比较处理组与对照组，识别候选差异基因', status:'clarifying', progress:0, nodes:initialNodes.map((n:any)=>({...n,status:n.id==='input'?'succeeded':'blocked',detail:n.id==='input'?n.detail:'等待计划审批'})), edges:[['input','qc'],['input','design'],['qc','de'],['design','de'],['de','volcano'],['de','report']], artifacts:[], clarification:{status:'pending',answers:{}} }, events:[], running:false, cancelled:false, nextEvent:1 });
function persist(s:State){ try { fs.mkdirSync(path.dirname(statePath),{recursive:true}); fs.writeFileSync(statePath,JSON.stringify(s,null,2)); } catch { /* read-only deploys use process memory */ } }
function state(): State { if (!g.__bioflow) { try { g.__bioflow=JSON.parse(fs.readFileSync(statePath,'utf8')) as State; } catch { g.__bioflow=defaultState(); } } return g.__bioflow; }

export function snapshot() { return state().task; }
export function eventsAfter(id:number) { return state().events.filter(e=>e.id>id); }
export function pushEvent(runId:string,type:string,payload:Record<string,unknown>,nodeId?:string) { const s=state(); const event={id:s.nextEvent++,runId,type,nodeId,payload,createdAt:new Date().toISOString()}; s.events.push(event); persist(s); return event; }
export function createRun() { const s=state(); const runId=randomUUID(); if(s.running) return {runId:'run_demo_001',status:'running'}; s.running=true; s.cancelled=false; s.task.status='running'; persist(s); pushEvent(runId,'run.started',{message:'Workflow run started'}); setTimeout(()=>{ if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='design'?{...n,status:'running',detail:'Validating metadata schema'}:n); persist(s); pushEvent(runId,'node.updated',{status:'running',detail:'Validating metadata schema'},'design'); setTimeout(()=>{if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='design'?{...n,status:'failed',detail:'Missing condition column'}:n); s.task.status='failed'; persist(s); pushEvent(runId,'node.updated',{status:'failed',error:'Missing condition column'},'design'); s.running=false;},700)},300); return {runId,status:'running'}; }
export function retryNode(runId:string,nodeId:string) { const s=state(); s.running=true; s.task.status='running'; s.task.nodes=s.task.nodes.map((n:any)=>n.id===nodeId?{...n,status:'succeeded',detail:'condition → mapped'}:n.id==='de'?{...n,status:'running',detail:'Running DESeq2'}:n); persist(s); pushEvent(runId,'node.retry',{attempt:2},nodeId); setTimeout(()=>{ if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='de'?{...n,status:'succeeded',detail:'1,842 genes tested · FDR < 0.05'}:n.id==='volcano'?{...n,status:'succeeded',detail:'SVG + interactive chart'}:n.id==='report'?{...n,status:'succeeded',detail:'Markdown report ready'}:n); s.task.progress=100; s.task.status='succeeded'; s.task.artifacts=[{id:'artifact_volcano',kind:'chart',name:'volcano_plot.svg',nodeId:'volcano'},{id:'artifact_report',kind:'report',name:'analysis_report.md',nodeId:'report'}]; persist(s); pushEvent(runId,'artifact.created',{name:'volcano_plot.svg',kind:'chart'},'volcano'); pushEvent(runId,'run.completed',{message:'All artifacts ready'}); s.running=false; },1200); return {runId,status:'running'}; }
export function cancelRun(runId:string) { const s=state(); s.cancelled=true; s.running=false; s.task.status='cancelled'; s.task.nodes=s.task.nodes.map((n:any)=>n.status==='running'||n.status==='queued'?{...n,status:'cancelled'}:n); persist(s); pushEvent(runId,'run.cancelled',{message:'Cancellation requested'}); return {runId,status:'cancelled'}; }
export function submitClarifications(answers:Record<string,string>){const s=state();s.task.clarification={status:'answered',answers};s.task.status='awaiting_approval';persist(s);pushEvent('planning','plan.generated',{steps:6,estimated:'2m 30s'});return s.task;}
export function approvePlan(){const s=state();s.task.status='queued';persist(s);pushEvent('planning','plan.approved',{approvedBy:'demo-researcher'});return s.task;}
