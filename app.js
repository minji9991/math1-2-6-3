import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const configured = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';

let studentId = '';
let sessionId = '';
// 서버에서 실제 열림 상태를 읽기 전에는 모두 잠금으로 둡니다.
let unlocked = {1:false,2:false,3:false,4:false,5:false,6:false,7:false};
let selectedDragToken = null;
const SESSION_KEY = 'polygon-angle-student-session-v21';

const loginLayer = $('#loginLayer');
const loginForm = $('#loginForm');
const loginMsg = $('#loginMsg');
const studentBadge = $('#studentBadge');
const saveBadge = $('#saveBadge');
const presenceBadge = $('#presenceBadge');

function norm(s){return String(s ?? '').replaceAll(' ','').replaceAll('−','-').replaceAll('×','*').replaceAll('°','').toLowerCase();}
function feedback(sel, text, good=true){const el=$(sel); if(!el)return; el.textContent=text; el.className='feedback '+(good?'good':'warn');}
function setSave(text){saveBadge.textContent=text;}
function svgEl(name, attrs={}){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
function polar(cx,cy,r,a){return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)};}
function polygonName(n){return ({4:'사각형',5:'오각형',6:'육각형'})[n] || `${n}각형`;}

async function saveEvent(eventType,payload={}){
  if(!configured || !sessionId) return;
  try{setSave('저장 중…');const {error}=await supabase.from('activity_events').insert({session_id:sessionId,student_id:studentId,event_type:eventType,payload});if(error)throw error;setSave('저장됨');}
  catch(e){console.error(e);setSave('저장 실패');}
}
async function saveAnswer(activityKey,answer){
  if(!configured || !sessionId) return;
  try{setSave('저장 중…');const {error}=await supabase.from('activity_answers').insert({session_id:sessionId,student_id:studentId,activity_key:activityKey,answer_json:answer});if(error)throw error;setSave('저장됨');}
  catch(e){console.error(e);setSave('저장 실패');}
}
async function heartbeat(){
  if(!configured || !sessionId) return;
  const {error}=await supabase.from('activity_sessions')
    .update({last_seen_at:new Date().toISOString()})
    .eq('id',sessionId);
  if(error){
    console.error('heartbeat error',error);
    presenceBadge.textContent='접속 확인 실패';
    presenceBadge.classList.remove('online');
    return false;
  }
  presenceBadge.textContent='접속 중';
  presenceBadge.classList.add('online');
  return true;
}
async function refreshControls(){
  if(!configured){
    unlocked={1:true,2:true,3:true,4:true,5:true,6:true,7:true};
    applyLocks();
    return true;
  }
  const {data,error}=await supabase.from('lesson_control').select('*').eq('id',1).maybeSingle();
  if(error){
    console.error('lesson_control read error',error);
    presenceBadge.textContent='활동 상태 연결 실패';
    return false;
  }
  if(!data){
    console.error('lesson_control row missing');
    presenceBadge.textContent='활동 상태 없음';
    return false;
  }
  for(let i=1;i<=7;i++) unlocked[i]=!!data[`step_${i}`];
  applyLocks();
  return true;
}
function applyLocks(){
  $$('.gated').forEach(sec=>{
    const step=Number(sec.dataset.step);const lock=!unlocked[step];sec.classList.toggle('locked',lock);
    const cover=$('.lock-cover',sec);if(cover)cover.hidden=!lock;
    $$('button,input,select,textarea',sec).forEach(el=>{
      if(el.dataset.keepEnabled==='1')return;
      if(lock){el.dataset.preDisabled=el.disabled?'1':'0';el.disabled=true;}
      else if(el.dataset.preDisabled!=='1'){el.disabled=false;}
    });
  });
}

async function enterStudentSession({restored=false}={}){
  studentBadge.textContent=`학번 ${studentId}`;
  setSave(configured?(restored?'접속 복원됨':'접속 저장됨'):'연습 모드');
  presenceBadge.textContent='연결 확인 중';
  loginLayer.classList.add('hidden');
  await refreshControls();
  await heartbeat();
  if(!restored) saveEvent('session_started');
}

loginForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const raw=$('#studentId').value.trim();
  if(!/^\d{4,8}$/.test(raw)){loginMsg.textContent='학번은 숫자 4~8자리로 입력하세요.';return;}
  studentId=raw;
  sessionId=crypto.randomUUID();
  if(configured){
    loginMsg.textContent='접속 기록 저장 중…';
    const now=new Date().toISOString();
    const {error}=await supabase.from('activity_sessions').insert({id:sessionId,student_id:studentId,user_agent:navigator.userAgent,last_seen_at:now});
    if(error){
      console.error('session insert error',error);
      loginMsg.textContent=`접속 저장 실패: ${error.message}`;
      return;
    }
  }
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({studentId,sessionId}));
  await enterStudentSession();
});

// 새로고침해도 같은 학생 세션을 이어서 사용합니다.
try{
  const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
  if(saved?.studentId && saved?.sessionId){
    studentId=String(saved.studentId);
    sessionId=String(saved.sessionId);
    enterStudentSession({restored:true});
  }else{
    loginLayer.classList.remove('hidden');
  }
}catch(e){
  console.error('session restore error',e);
  sessionStorage.removeItem(SESSION_KEY);
  loginLayer.classList.remove('hidden');
}

document.addEventListener('visibilitychange',()=>{if(!sessionId)return;saveEvent(document.visibilityState==='hidden'?'page_hidden':'page_visible',{visibility:document.visibilityState});heartbeat();});
window.addEventListener('beforeunload',()=>{if(sessionId)saveEvent('page_unload');});
setInterval(()=>{if(sessionId && document.visibilityState==='visible')heartbeat();},20000);
setInterval(()=>{if(sessionId)refreshControls();},3000);


applyLocks();

// ---------- 활동 1: 내각의 합 ----------
const interiorPolygons=$('#interiorPolygons');
const interiorStates=new Map();
function regularPoints(n,cx=150,cy=145,r=100){return Array.from({length:n},(_,i)=>polar(cx,cy,r,-Math.PI/2+i*2*Math.PI/n));}
function cyclicDist(a,b,n){const d=Math.abs(a-b);return Math.min(d,n-d);}
function buildInteriorCard(n){
  const state={start:null,drawn:new Set(),done:false};interiorStates.set(n,state);
  const box=document.createElement('div');box.className='poly-box';box.innerHTML=`<div class="poly-head"><h3>${polygonName(n)}</h3><button type="button" class="reset-mini">다시</button></div><p class="microcopy">먼저 한 꼭짓점을 선택하세요.</p>`;
  const pts=regularPoints(n);const svg=svgEl('svg',{viewBox:'0 0 300 290','aria-label':`${polygonName(n)} 대각선 활동`});
  const triLayer=svgEl('g',{class:'triangle-fill-layer'});svg.append(triLayer);
  const lineLayer=svgEl('g',{class:'diag-layer'});svg.append(lineLayer);
  const poly=svgEl('polygon',{points:pts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge'});svg.append(poly);
  const vertices=[];
  pts.forEach((p,i)=>{
    const g=svgEl('g',{class:'vertex','data-i':i});const c=svgEl('circle',{cx:p.x,cy:p.y,r:14});const t=svgEl('text',{x:p.x,y:p.y+5,'text-anchor':'middle'});t.textContent=String.fromCharCode(65+i);g.append(c,t);svg.append(g);vertices.push(g);
    g.addEventListener('click',()=>handleVertex(i));
  });
  function updateTriangles(){
    triLayer.innerHTML=''; if(!state.done)return;
    const s=state.start;const ordered=[];for(let k=0;k<n;k++)ordered.push((s+k)%n);
    const fills=['#f4d7c8','#d9e8f4','#f8e7b0','#dcead7','#ead7ea'];
    for(let k=1;k<n-1;k++){
      const ids=[s,ordered[k],ordered[k+1]];const pg=svgEl('polygon',{points:ids.map(id=>`${pts[id].x},${pts[id].y}`).join(' '),fill:fills[(k-1)%fills.length],opacity:.72});triLayer.append(pg);
    }
  }
  function handleVertex(i){
    if(state.start===null){state.start=i;vertices.forEach(v=>v.classList.remove('start'));vertices[i].classList.add('start');$('.microcopy',box).textContent=`${String.fromCharCode(65+i)}에서 그을 수 있는 모든 대각선을 그어 보세요.`;return;}
    if(i===state.start){feedback('#step1Feedback','출발 꼭짓점과 다른 꼭짓점을 선택하세요.',false);return;}
    if(cyclicDist(i,state.start,n)===1){feedback('#step1Feedback','이 선분은 다각형의 변입니다. 대각선을 선택해 보세요.',false);return;}
    if(state.drawn.has(i))return;state.drawn.add(i);
    const a=pts[state.start],b=pts[i];lineLayer.append(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'diag'}));
    const need=n-3;$('.microcopy',box).textContent=`대각선 ${state.drawn.size}/${need}개`;
    saveEvent('interior_diagonal_drawn',{polygon_n:n,from:state.start,to:i});
    if(state.drawn.size===need){state.done=true;box.classList.add('done');updateTriangles();$('.microcopy',box).textContent=`완료! ${n-2}개의 삼각형으로 나뉘었습니다.`;saveAnswer(`triangulate_${n}`,{start_vertex:state.start,triangle_count:n-2});}
  }
  $('.reset-mini',box).addEventListener('click',()=>{state.start=null;state.drawn.clear();state.done=false;lineLayer.innerHTML='';triLayer.innerHTML='';box.classList.remove('done');vertices.forEach(v=>v.classList.remove('start'));$('.microcopy',box).textContent='먼저 한 꼭짓점을 선택하세요.';});
  box.append(svg);return box;
}
[4,5,6].forEach(n=>interiorPolygons.append(buildInteriorCard(n)));

$('#checkTriangleSum').addEventListener('click',()=>{const ok=Number($('#triangleSum').value)===180;feedback('#triangleSumFeedback',ok?'맞아요. 삼각형의 내각의 크기의 합은 180°입니다.':'삼각형의 세 내각을 떠올려 보세요.',ok);saveAnswer('triangle_angle_sum',{answer:$('#triangleSum').value,correct:ok});});
$('#checkInteriorTable').addEventListener('click',()=>{
  const triOk=[4,5,6].every(n=>Number($(`[data-triangle-n="${n}"]`).value)===n-2);
  const sumOk=[4,5,6].every(n=>Number($(`[data-sum-n="${n}"]`).value)===180*(n-2));
  const drawingsOk=[...interiorStates.values()].every(s=>s.done);
  const ok=triOk&&sumOk&&drawingsOk;
  feedback('#interiorTableFeedback',ok?'표가 완성되었습니다. 삼각형이 하나 늘 때마다 내각의 합은 180°씩 늘어납니다.':!drawingsOk?'먼저 세 다각형에서 대각선을 모두 그어 보세요.':'삼각형의 개수와 180°를 이용하여 표를 다시 확인해 보세요.',ok);
  saveAnswer('interior_table',{triangles:Object.fromEntries([4,5,6].map(n=>[n,$(`[data-triangle-n="${n}"]`).value])),sums:Object.fromEntries([4,5,6].map(n=>[n,$(`[data-sum-n="${n}"]`).value])),correct:ok});
});
$('#checkNTriangle').addEventListener('click',()=>{const v=norm($('#nTriangleCount').value);const ok=['n-2','(n-2)'].includes(v);feedback('#step1Feedback',ok?'좋아요. n각형은 한 꼭짓점에서 대각선을 그으면 n−2개의 삼각형으로 나뉩니다.':'4→2, 5→3, 6→4의 규칙을 n으로 나타내 보세요.',ok);saveAnswer('n_triangle_count',{answer:v,correct:ok});});
$('#checkInteriorFormula').addEventListener('click',()=>{const v=norm($('#interiorFormula').value);const ok=['180*(n-2)','180(n-2)','(n-2)*180','(n-2)180'].includes(v);feedback('#step1Feedback',ok?'정리 완료! n각형의 내각의 크기의 합은 180° × (n−2)입니다.':'삼각형 n−2개의 내각의 합을 이용해 식을 만들어 보세요.',ok);saveAnswer('interior_sum_formula',{answer:v,correct:ok});if(ok)saveEvent('step_completed',{step:1});});

// ---------- 활동 2: 내각 적용 ----------
function drawInteriorApply(){
  const host=$('#interiorApplyFigure');const svg=svgEl('svg',{viewBox:'0 0 420 320'});const pts=[{x:85,y:245},{x:82,y:125},{x:180,y:58},{x:300,y:86},{x:340,y:230}];svg.append(svgEl('polygon',{points:pts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge thick'}));
  const labels=[['90°',103,226],['120°',104,133],['110°',181,92],['150°',278,113],['x°',305,222]];labels.forEach(([t,x,y])=>{const tx=svgEl('text',{x,y,class:'angle-label'});tx.textContent=t;svg.append(tx);});host.append(svg);
}
drawInteriorApply();
$('#checkInteriorX').addEventListener('click',()=>{const ok=Number($('#interiorX').value)===70;feedback('#interiorXFeedback',ok?'맞아요. 오각형의 내각의 합 540°에서 알려진 네 각을 빼면 70°입니다.':'오각형의 내각의 크기의 합부터 구해 보세요.',ok);saveAnswer('interior_apply_x',{answer:$('#interiorX').value,correct:ok});if(ok)saveEvent('step_completed',{step:2});});

// ---------- 활동 3: 외각 실험 ----------
class ExteriorExperiment{
  constructor(host,n){this.host=host;this.n=n;this.cx=250;this.cy=220;this.baseR=n===4?125:135;this.pts=Array.from({length:n},(_,i)=>polar(this.cx,this.cy,this.baseR,-Math.PI/2+i*2*Math.PI/n));this.extensions=false;this.selected=new Set();this.build();}
  build(){
    this.svg=svgEl('svg',{viewBox:'0 0 500 440'});this.polyLayer=svgEl('g');this.extLayer=svgEl('g');this.wedgeLayer=svgEl('g');this.vertexLayer=svgEl('g');this.gatherLayer=svgEl('g');this.svg.append(this.gatherLayer,this.polyLayer,this.extLayer,this.wedgeLayer,this.vertexLayer);this.host.append(this.svg);this.dragIndex=null;this.svg.addEventListener('pointermove',e=>this.onDragMove(e));this.svg.addEventListener('pointerup',()=>this.dragIndex=null);this.svg.addEventListener('pointercancel',()=>this.dragIndex=null);this.render();
  }
  render(){
    this.polyLayer.innerHTML='';this.extLayer.innerHTML='';this.wedgeLayer.innerHTML='';this.vertexLayer.innerHTML='';
    this.polyLayer.append(svgEl('polygon',{points:this.pts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge thick'}));
    this.pts.forEach((p,i)=>{
      if(this.extensions){
        const prev=this.pts[(i-1+this.n)%this.n];const vx=p.x-prev.x,vy=p.y-prev.y,len=Math.hypot(vx,vy);const ex=p.x+vx/len*72,ey=p.y+vy/len*72;this.extLayer.append(svgEl('line',{x1:p.x,y1:p.y,x2:ex,y2:ey,class:'extension-line'}));
        const next=this.pts[(i+1)%this.n];const a1=Math.atan2(ey-p.y,ex-p.x),a2=Math.atan2(next.y-p.y,next.x-p.x);let delta=((a2-a1)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);if(delta>Math.PI)delta=Math.PI*2-delta;const r=34;const s=polar(p.x,p.y,r,a1),e=polar(p.x,p.y,r,a1+(this.turnDirection(i))*delta);const large=delta>Math.PI?1:0;const path=svgEl('path',{d:`M ${p.x} ${p.y} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} ${this.turnDirection(i)>0?1:0} ${e.x} ${e.y} Z`,class:'exterior-wedge'+(this.selected.has(i)?' selected-wedge':'')});path.dataset.i=i;path.addEventListener('click',()=>{this.selected.has(i)?this.selected.delete(i):this.selected.add(i);this.render();this.updateStatus();});this.wedgeLayer.append(path);
      }
      const g=svgEl('g',{class:'vertex draggable-vertex','data-i':i});g.append(svgEl('circle',{cx:p.x,cy:p.y,r:14}));const t=svgEl('text',{x:p.x,y:p.y+5,'text-anchor':'middle'});t.textContent=String.fromCharCode(65+i);g.append(t);this.vertexLayer.append(g);this.attachDrag(g,i);
    });
  }
  turnDirection(i){const p=this.pts[i],prev=this.pts[(i-1+this.n)%this.n],next=this.pts[(i+1)%this.n];const cross=(p.x-prev.x)*(next.y-p.y)-(p.y-prev.y)*(next.x-p.x);return cross>0?1:-1;}
  attachDrag(g,i){
    g.addEventListener('pointerdown',e=>{if(this.extensions)return;this.dragIndex=i;this.svg.setPointerCapture?.(e.pointerId);});
  }
  onDragMove(e){
    if(this.dragIndex===null || this.extensions)return;const i=this.dragIndex;const pt=this.svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const loc=pt.matrixTransform(this.svg.getScreenCTM().inverse());const baseA=-Math.PI/2+i*2*Math.PI/this.n;let a=Math.atan2(loc.y-this.cy,loc.x-this.cx);let diff=Math.atan2(Math.sin(a-baseA),Math.cos(a-baseA));diff=Math.max(-0.20,Math.min(0.20,diff));const r=Math.max(90,Math.min(150,Math.hypot(loc.x-this.cx,loc.y-this.cy)));this.pts[i]=polar(this.cx,this.cy,r,baseA+diff);this.render();
  }
  makeExtensions(){this.extensions=true;this.selected.clear();this.render();this.updateStatus();saveEvent('extensions_created',{polygon_n:this.n});}
  updateStatus(){const s=$(`[data-ext-status="${this.n}"]`);s.textContent=`외각 ${this.selected.size} / ${this.n} 선택`;const b=$(`[data-gather-for="${this.n}"]`);b.disabled=this.selected.size!==this.n;if(this.selected.size===this.n)saveEvent('all_exterior_angles_selected',{polygon_n:this.n});}
  exteriorAngles(){
    const vals=[];for(let i=0;i<this.n;i++){const prev=this.pts[(i-1+this.n)%this.n],p=this.pts[i],next=this.pts[(i+1)%this.n];const v1={x:p.x-prev.x,y:p.y-prev.y},v2={x:next.x-p.x,y:next.y-p.y};let turn=Math.atan2(v1.x*v2.y-v1.y*v2.x,v1.x*v2.x+v1.y*v2.y);turn=Math.abs(turn);vals.push(turn);}const sum=vals.reduce((a,b)=>a+b,0);return vals.map(v=>v*(Math.PI*2/sum));
  }
  gather(){
    if(this.selected.size!==this.n)return;this.gatherLayer.innerHTML='';const vals=this.exteriorAngles();let a=-Math.PI/2;const cx=this.cx,cy=this.cy,r=78,colors=['#f1b7a8','#b9d9ef','#f4d98e','#c9dfbd','#ddc3df','#c3d6ec'];vals.forEach((v,i)=>{const s=polar(cx,cy,r,a),e=polar(cx,cy,r,a+v);const path=svgEl('path',{d:`M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${v>Math.PI?1:0} 1 ${e.x} ${e.y} Z`,fill:colors[i%colors.length],class:'gather-sector'});this.gatherLayer.append(path);a+=v;});const circle=svgEl('circle',{cx,cy,r:18,fill:'#fff'});this.gatherLayer.append(circle);const tx=svgEl('text',{x:cx,y:cy+6,'text-anchor':'middle',class:'sum360'});tx.textContent='360°';this.gatherLayer.append(tx);this.svg.classList.add('gathered');saveAnswer(`exterior_experiment_${this.n}`,{sum:360});
  }
}
const quadExp=new ExteriorExperiment($('#quadExterior'),4);const pentExp=new ExteriorExperiment($('#pentExterior'),5);
$$('[data-extension-for]').forEach(b=>b.addEventListener('click',()=>{(Number(b.dataset.extensionFor)===4?quadExp:pentExp).makeExtensions();b.disabled=true;}));
$$('[data-gather-for]').forEach(b=>b.addEventListener('click',()=>{(Number(b.dataset.gatherFor)===4?quadExp:pentExp).gather();}));
$('#checkExteriorSum').addEventListener('click',()=>{const ok=Number($('#exteriorSumAnswer').value)===360;feedback('#exteriorExperimentFeedback',ok?'맞아요. 다각형의 외각의 크기의 합은 360°입니다.':'한 점 둘레에 외각들을 모았을 때 한 바퀴가 몇 도인지 생각해 보세요.',ok);saveAnswer('exterior_sum_observation',{answer:$('#exteriorSumAnswer').value,correct:ok});if(ok)saveEvent('step_completed',{step:3});});

// ---------- 활동 4: 외각의 합 이유 ----------
const reasonN=6;const reasonHost=$('#reasonPolygon');const reasonSvg=svgEl('svg',{viewBox:'0 0 520 460'});const reasonPts=regularPoints(reasonN,250,220,145);reasonSvg.append(svgEl('polygon',{points:reasonPts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge thick'}));
const clickedIn=new Set(),clickedOut=new Set(),flatSeen=new Set();let reasonFormulaCorrect=false;
reasonPts.forEach((p,i)=>{
  const center={x:250,y:220};const dir=Math.atan2(center.y-p.y,center.x-p.x);const inside=polar(p.x,p.y,34,dir);const outside=polar(p.x,p.y,46,dir+Math.PI);const bi=svgEl('g',{class:'angle-chip inside-chip'});bi.append(svgEl('circle',{cx:inside.x,cy:inside.y,r:17}));const it=svgEl('text',{x:inside.x,y:inside.y+4,'text-anchor':'middle'});it.textContent='내';bi.append(it);reasonSvg.append(bi);const bo=svgEl('g',{class:'angle-chip outside-chip'});bo.append(svgEl('circle',{cx:outside.x,cy:outside.y,r:17}));const ot=svgEl('text',{x:outside.x,y:outside.y+4,'text-anchor':'middle'});ot.textContent='외';bo.append(ot);reasonSvg.append(bo);
  bi.addEventListener('click',()=>{clickedIn.add(i);bi.classList.add('picked');updateReason();});bo.addEventListener('click',()=>{clickedOut.add(i);bo.classList.add('picked');updateReason();});
  const vg=svgEl('g',{class:'flat-chip hidden','data-flat':i});vg.append(svgEl('circle',{cx:p.x,cy:p.y,r:19}));const vt=svgEl('text',{x:p.x,y:p.y+5,'text-anchor':'middle'});vt.textContent='180';vg.append(vt);vg.addEventListener('click',()=>{flatSeen.add(i);vg.classList.add('picked');if(flatSeen.size===reasonN){$('#straightReveal').classList.remove('hidden');saveEvent('all_straight_angles_confirmed',{n:reasonN});maybeRevealRelation();}});reasonSvg.append(vg);
});reasonHost.append(reasonSvg);
function updateReason(){
  if(clickedIn.size===reasonN){$('#interiorSumButton').disabled=false;}
  if(clickedOut.size===reasonN){$('#exteriorSumButton').disabled=false;}
  const hasPair=[...clickedIn].some(i=>clickedOut.has(i));if(hasPair)$('#straightButton').disabled=false;maybeRevealRelation();
}
function maybeRevealRelation(){
  if(clickedIn.size===reasonN&&clickedOut.size===reasonN&&flatSeen.size===reasonN&&reasonFormulaCorrect){$('#masterRelation').classList.remove('hidden');$('#derivationArea').classList.remove('hidden');}
}
$('#interiorSumButton').addEventListener('click',()=>$('#interiorFormulaReveal').classList.remove('hidden'));
$('#reasonNMinus').addEventListener('change',()=>{const ok=['n-2','(n-2)'].includes(norm($('#reasonNMinus').value));reasonFormulaCorrect=ok;if(ok){$('#reasonNMinus').classList.add('correct');saveAnswer('reason_interior_formula',{answer:$('#reasonNMinus').value,correct:true});}else $('#reasonNMinus').classList.remove('correct');maybeRevealRelation();});
$('#exteriorSumButton').addEventListener('click',()=>feedback('#derivationFeedback','외각의 크기의 합을 아직 모른다고 두고, 전체 평각의 합에서 내각의 합을 빼 봅시다.',true));
$('#straightButton').addEventListener('click',()=>{$$('.flat-chip',reasonSvg).forEach(x=>x.classList.remove('hidden'));});

// drag/drop shared
function setupDragDrop(root=document){
  $$('[draggable="true"]',root).forEach(btn=>{
    btn.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',btn.dataset.token);selectedDragToken=btn.dataset.token;});
    btn.addEventListener('click',()=>{selectedDragToken=btn.dataset.token;$$('[draggable="true"]',root).forEach(x=>x.classList.remove('token-selected'));btn.classList.add('token-selected');});
  });
  $$('.dropzone',root).forEach(z=>{
    z.addEventListener('dragover',e=>e.preventDefault());z.addEventListener('drop',e=>{e.preventDefault();placeToken(z,e.dataTransfer.getData('text/plain'));});
    z.addEventListener('click',()=>{if(selectedDragToken)placeToken(z,selectedDragToken);});
  });
}
const tokenLabels={180n:'180° × n',180nminus2:'180° × (n − 2)',360:'360°',same:'같',regularInterior:'180° × (n − 2) ÷ n',regularExterior:'360° ÷ n'};
function placeToken(zone,token){zone.dataset.value=token;zone.textContent=tokenLabels[token]||token;zone.classList.toggle('correct-drop',token===zone.dataset.accept);selectedDragToken=null;$$('.token-selected').forEach(x=>x.classList.remove('token-selected'));}
setupDragDrop(document);
$('#checkDerivation').addEventListener('click',()=>{const zones=$$('#derivationArea .dropzone');const ok=zones.every(z=>z.dataset.value===z.dataset.accept);feedback('#derivationFeedback',ok?'완성! 180°n − 180°(n−2) = 360°이므로 외각의 크기의 합은 360°입니다.':'각 식의 의미를 보고 알맞은 식을 다시 배치해 보세요.',ok);saveAnswer('exterior_sum_derivation',{values:zones.map(z=>z.dataset.value||''),correct:ok});if(ok)saveEvent('step_completed',{step:4});});

// ---------- 활동 5: 외각 적용 ----------
function drawExteriorApply(){
  const host=$('#exteriorApplyFigure');const svg=svgEl('svg',{viewBox:'0 0 430 330'});const pts=[{x:86,y:255},{x:85,y:150},{x:155,y:82},{x:278,y:105},{x:338,y:245}];svg.append(svgEl('polygon',{points:pts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge thick'}));
  const extensions=[[0,{x:170,y:255}],[1,{x:30,y:190}],[2,{x:118,y:42}],[3,{x:307,y:60}],[4,{x:390,y:245}]];extensions.forEach(([i,q])=>svg.append(svgEl('line',{x1:pts[i].x,y1:pts[i].y,x2:q.x,y2:q.y,class:'extension-line'})));
  const labels=[['90°',107,238],['60°',42,165],['70°',112,75],['30°',292,91],['x°',354,231]];labels.forEach(([t,x,y])=>{const tx=svgEl('text',{x,y,class:'angle-label'});tx.textContent=t;svg.append(tx);});host.append(svg);
}
drawExteriorApply();
$('#checkExteriorX').addEventListener('click',()=>{const ok=Number($('#exteriorX').value)===110;feedback('#exteriorXFeedback',ok?'맞아요. 360° − (90°+60°+70°+30°) = 110°입니다.':'오각형의 외각의 크기의 합 360°를 이용해 보세요.',ok);saveAnswer('exterior_apply_x',{answer:$('#exteriorX').value,correct:ok});if(ok)saveEvent('step_completed',{step:5});});

// ---------- 활동 6: 정다각형 ----------
$('#checkRegular').addEventListener('click',()=>{const zones=$$('#regularBank').length?$$('[data-step="6"] .dropzone'):[];const ok=zones.every(z=>z.dataset.value===z.dataset.accept);feedback('#regularFeedback',ok?'완성! 정n각형의 한 내각은 180°(n−2)/n, 한 외각은 360°/n입니다.':'문장의 뜻과 각 식이 나타내는 값을 다시 연결해 보세요.',ok);saveAnswer('regular_polygon_summary',{values:zones.map(z=>z.dataset.value||''),correct:ok});if(ok)saveEvent('step_completed',{step:6});});

// ---------- 활동 7: 생각 더 나아가기 ----------
function drawBadPentagon(){const host=$('#badPentagon');const svg=svgEl('svg',{viewBox:'0 0 330 270'});const pts=regularPoints(5,165,135,100);svg.append(svgEl('polygon',{points:pts.map(p=>`${p.x},${p.y}`).join(' '),class:'edge thick'}));for(let i=0;i<5;i++)svg.append(svgEl('line',{x1:165,y1:135,x2:pts[i].x,y2:pts[i].y,class:'bad-diag'}));const t=svgEl('text',{x:165,y:250,'text-anchor':'middle',class:'caption-label'});t.textContent='한 점(꼭짓점이 아닌 점)에서 5개의 삼각형으로 나눈 모습';svg.append(t);host.append(svg);}drawBadPentagon();
$('#submitReason').addEventListener('click',()=>{const ans=$('#finalReason').value.trim();if(ans.length<15){feedback('#finalReasonFeedback','조금 더 자세히 설명해 보세요. 15자 이상 작성해 주세요.',false);return;}feedback('#finalReasonFeedback','답안이 저장되었습니다. 교사가 확인할 수 있습니다.',true);saveAnswer('final_written_reason',{text:ans});saveEvent('step_completed',{step:7});});

$('#submitAll').addEventListener('click',async()=>{if(!sessionId){feedback('#submitFeedback','먼저 학번으로 접속해 주세요.',false);return;}if(configured){const {error}=await supabase.from('activity_sessions').update({submitted_at:new Date().toISOString(),last_seen_at:new Date().toISOString()}).eq('id',sessionId);if(error){feedback('#submitFeedback','제출 저장에 실패했습니다.',false);return;}}feedback('#submitFeedback','전체 활동이 제출되었습니다.',true);saveEvent('all_submitted');});

