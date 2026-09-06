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

/** 演示环境重置任务，便于每次面试从澄清步骤开始。生产环境不应暴露此能力。 */
export function resetDemoState() { const fresh = defaultState(); g.__bioflow = fresh; persist(fresh); return fresh.task; }

export function snapshot() { return state().task; }
export function eventsAfter(id:number) { return state().events.filter(e=>e.id>id); }
export function pushEvent(runId:string,type:string,payload:Record<string,unknown>,nodeId?:string) { const s=state(); const event={id:s.nextEvent++,runId,type,nodeId,payload,createdAt:new Date().toISOString()}; s.events.push(event); persist(s); return event; }
function emitCode(runId:string){const s=state();const code=`import pandas as pd\nfrom deseq2 import DESeqDataSet\n\ncounts = pd.read_csv("counts.csv")\nmetadata = pd.read_csv("sample_metadata.tsv")\n\n# Validate before execution\nassert "condition" in metadata.columns\n\nresults = run_differential_expression(counts, metadata)\n`;[...code].forEach((char,i)=>setTimeout(()=>{if(!s.cancelled)pushEvent(runId,'code.delta',{artifactId:'artifact_code',text:char},'de')},i*8));}
export function createRun() { const s=state(); const runId=randomUUID(); if(s.running) return {runId:'run_demo_001',status:'running'}; s.running=true; s.cancelled=false; s.task.status='running'; persist(s); pushEvent(runId,'run.started',{message:'工作流已开始运行'}); setTimeout(()=>{if(s.cancelled)return;pushEvent(runId,'intent.detected',{domain:'bulk RNA-seq',comparison:'处理组 vs 对照组'});pushEvent(runId,'retrieval.started',{sources:['项目文件','技能包','文献知识库']});setTimeout(()=>{if(s.cancelled)return;pushEvent(runId,'retrieval.hit',{projectFiles:2,skills:3,literature:12});pushEvent(runId,'evidence.reranked',{kept:4,confidence:0.91});pushEvent(runId,'grounding.bound',{parameters:['物种','实验设计','FDR']});},280)},100); setTimeout(()=>{ if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='design'?{...n,status:'running',detail:'正在校验元数据结构'}:n); persist(s); pushEvent(runId,'node.updated',{status:'running',detail:'正在校验元数据结构'},'design'); setTimeout(()=>{if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='design'?{...n,status:'failed',detail:'缺少 condition 字段'}:n); s.task.status='failed'; persist(s); pushEvent(runId,'node.updated',{status:'failed',error:'缺少 condition 字段'},'design'); s.running=false;},700)},500); return {runId,status:'running'}; }
export function retryNode(runId:string,nodeId:string) { const s=state(); s.running=true; s.task.status='running'; s.task.nodes=s.task.nodes.map((n:any)=>n.id===nodeId?{...n,status:'succeeded',detail:'condition → 已完成映射'}:n.id==='de'?{...n,status:'running',detail:'正在运行 DESeq2'}:n); persist(s); pushEvent(runId,'node.retry',{attempt:2},nodeId); emitCode(runId); setTimeout(()=>{ if(s.cancelled)return; s.task.nodes=s.task.nodes.map((n:any)=>n.id==='de'?{...n,status:'succeeded',detail:'已检验 1,842 个基因 · FDR < 0.05'}:n.id==='volcano'?{...n,status:'succeeded',detail:'SVG + 交互式图表'}:n.id==='report'?{...n,status:'succeeded',detail:'Markdown 报告已就绪'}:n); s.task.progress=100; s.task.status='succeeded'; s.task.artifacts=[{id:'artifact_volcano',kind:'chart',name:'volcano_plot.svg',nodeId:'volcano'},{id:'artifact_report',kind:'report',name:'analysis_report.md',nodeId:'report'},{id:'artifact_code',kind:'code',name:'analysis.py',nodeId:'de'}]; persist(s); pushEvent(runId,'artifact.created',{name:'volcano_plot.svg',kind:'chart'},'volcano'); pushEvent(runId,'run.completed',{message:'全部结果产物已就绪'}); s.running=false; },1200); return {runId,status:'running'}; }
export function cancelRun(runId:string) { const s=state(); s.cancelled=true; s.running=false; s.task.status='cancelled'; s.task.nodes=s.task.nodes.map((n:any)=>n.status==='running'||n.status==='queued'?{...n,status:'cancelled'}:n); persist(s); pushEvent(runId,'run.cancelled',{message:'Cancellation requested'}); return {runId,status:'cancelled'}; }
export function submitClarifications(answers:Record<string,string>){const s=state();s.task.clarification={status:'answered',answers};s.task.status='awaiting_approval';persist(s);pushEvent('planning','plan.generated',{steps:6,estimated:'2m 30s'});return s.task;}
export function approvePlan(){const s=state();s.task.status='queued';persist(s);pushEvent('planning','plan.approved',{approvedBy:'demo-researcher'});return s.task;}
