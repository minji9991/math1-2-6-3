import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const configured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let studentId = '';
let sessionId = '';
let completed = new Set();

const loginLayer = document.querySelector('#loginLayer');
const loginForm = document.querySelector('#loginForm');
const loginMsg = document.querySelector('#loginMsg');
const studentBadge = document.querySelector('#studentBadge');
const saveBadge = document.querySelector('#saveBadge');

function norm(s){return String(s).replaceAll(' ','').replaceAll('−','-').toLowerCase();}
function setFeedback(id, text, good=true){const el=document.querySelector(id); el.textContent=text; el.className='feedback '+(good?'good':'warn');}
function markComplete(step){completed.add(step); saveEvent('step_completed',{step});}
function setSave(text){saveBadge.textContent=text;}

async function saveEvent(eventType, payload={}){
  if(!configured || !sessionId) return;
  try{
    setSave('저장 중…');
    const { error } = await supabase.from('activity_events').insert({session_id:sessionId,student_id:studentId,event_type:eventType,payload});
    if(error) throw error;
    setSave('저장됨');
  }catch(e){console.error(e);setSave('저장 실패');}
}

async function saveAnswer(activityKey, answer){
  if(!configured || !sessionId) return;
  try{
    setSave('저장 중…');
    const { error } = await supabase.from('activity_answers').insert({session_id:sessionId,student_id:studentId,activity_key:activityKey,answer_json:answer});
    if(error) throw error;
    setSave('저장됨');
  }catch(e){console.error(e);setSave('저장 실패');}
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const raw=document.querySelector('#studentId').value.trim();
  if(!/^\d{4,8}$/.test(raw)){loginMsg.textContent='학번은 숫자 4~8자리로 입력하세요.';return;}
  studentId=raw; sessionId=crypto.randomUUID();
  if(configured){
    loginMsg.textContent='접속 기록 저장 중…';
    const { error } = await supabase.from('activity_sessions').insert({id:sessionId,student_id:studentId,user_agent:navigator.userAgent});
    if(error){console.error(error);loginMsg.textContent='Supabase 저장에 실패했습니다. 설정을 확인하세요.';return;}
  }
  studentBadge.textContent=`학번 ${studentId}`;
  setSave(configured?'접속 저장됨':'연습 모드');
  loginLayer.classList.add('hidden');
  saveEvent('session_started');
});

document.addEventListener('visibilitychange',()=>{
  if(!sessionId) return;
  saveEvent(document.visibilityState==='hidden'?'page_hidden':'page_visible',{visibility:document.visibilityState});
});

// ---------- 1. 한 꼭짓점 대각선 ----------
const polygonPractice=document.querySelector('#polygonPractice');
const polyStates=new Map();
function point(cx,cy,r,i,n){const a=-Math.PI/2 + i*2*Math.PI/n; return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)};}
function makePolygonCard(n){
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const pts=Array.from({length:n},(_,i)=>point(150,145,100,i,n));
  const valid=Array.from({length:n},(_,i)=>i).filter(i=>i!==0&&i!==1&&i!==n-1);
  const state={drawn:new Set(),valid}; polyStates.set(n,state);
  const box=document.createElement('div');box.className='poly-box';box.innerHTML=`<h3>${['','', '', '삼각형','사각형','오각형','육각형'][n]||n+'각형'}</h3>`;
  const ns='http://www.w3.org/2000/svg'; const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 290');
  const poly=document.createElementNS(ns,'polygon');poly.setAttribute('points',pts.map(p=>`${p.x},${p.y}`).join(' '));poly.setAttribute('class','edge');svg.append(poly);
  valid.forEach(()=>{});
  pts.forEach((p,i)=>{
    const g=document.createElementNS(ns,'g');g.setAttribute('class','vertex'+(i===0?' start':''));g.dataset.i=i;
    const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r',13);
    const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+5);t.setAttribute('text-anchor','middle');t.textContent=letters[i];
    g.append(c,t);svg.append(g);
    g.addEventListener('click',()=>{
      if(i===0){setFeedback('#step1Feedback','A는 출발 꼭짓점입니다. 다른 꼭짓점을 눌러 보세요.',false);return;}
      if(i===1||i===n-1){setFeedback('#step1Feedback',`${letters[0]}${letters[i]}는 변이므로 대각선이 아닙니다.`,false);return;}
      if(state.drawn.has(i)) return;
      state.drawn.add(i);
      const line=document.createElementNS(ns,'line');line.setAttribute('x1',pts[0].x);line.setAttribute('y1',pts[0].y);line.setAttribute('x2',p.x);line.setAttribute('y2',p.y);line.setAttribute('class','diag');svg.insertBefore(line,svg.firstChild.nextSibling);
      box.querySelector('.counter').textContent=`${state.drawn.size}개 그음`;
      saveEvent('diagonal_drawn',{polygon_n:n,from:'A',to:letters[i]});
      if(state.drawn.size===state.valid.length){box.dataset.done='1';checkStep1();}
    });
  });
  box.append(svg);const counter=document.createElement('div');counter.className='counter';counter.textContent='0개 그음';box.append(counter);return box;
}
[4,5,6].forEach(n=>polygonPractice.append(makePolygonCard(n)));
function checkStep1(){
  if([...polygonPractice.children].every(x=>x.dataset.done==='1')){
    setFeedback('#step1Feedback','완료! 사각형 1개, 오각형 2개, 육각형 3개입니다. 무엇이 일정하게 변하는지 살펴보세요.');
    markComplete(1); saveAnswer('one_vertex_examples',{4:1,5:2,6:3});
  }
}

// ---------- 2. n-3 ----------
document.querySelector('#checkOneVertex').addEventListener('click',()=>{
  const v=norm(document.querySelector('#oneVertexFormula').value);
  const ok=['n-3','(n-3)'].includes(v);
  setFeedback('#step2Feedback', ok?'맞아요. 자기 자신 1개와 양옆의 두 꼭짓점 2개를 제외하므로 n-3개입니다.':'사각형→1, 오각형→2, 육각형→3의 규칙을 n으로 표현해 보세요.',ok);
  saveAnswer('one_vertex_formula',{answer:v,correct:ok}); if(ok)markComplete(2);
});

// ---------- 3. AC = CA ----------
document.querySelectorAll('.ox').forEach(btn=>btn.addEventListener('click',()=>{
  const ok=btn.dataset.answer==='O';
  setFeedback('#step3Feedback',ok?'정답! 선분 AC와 선분 CA는 끝점이 같으므로 같은 대각선입니다.':'다시 생각해 보세요. 선분은 방향을 구분하지 않습니다.',ok);
  saveAnswer('same_diagonal_ox',{answer:btn.dataset.answer,correct:ok});if(ok)markComplete(3);
}));

// ---------- 4. 방향을 붙여 10개 그리기 ----------
const directedStage=document.querySelector('#directedPentagon');
const dPts=Array.from({length:5},(_,i)=>point(260,220,150,i,5));
const letters='ABCDE'; let selected=null; const directed=new Set(); const palette=['#d46666','#3b86a0','#8a68a6','#b57a3b','#4b8d65','#b05c8b','#5d72b5','#9b7a39','#3f947f','#a95f4e'];
const svgNS='http://www.w3.org/2000/svg'; const dsvg=document.createElementNS(svgNS,'svg');dsvg.setAttribute('viewBox','0 0 520 440');
const pent=document.createElementNS(svgNS,'polygon');pent.setAttribute('points',dPts.map(p=>`${p.x},${p.y}`).join(' '));pent.setAttribute('class','edge');dsvg.append(pent);
function isAdjacent(a,b){return ((a-b+5)%5===1)||((b-a+5)%5===1);}
function directedPairOffset(a,b){const p1=dPts[a],p2=dPts[b]; const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy); const sign=a<b?1:-1;return {ox:-dy/len*3*sign,oy:dx/len*3*sign};}
dPts.forEach((p,i)=>{
  const g=document.createElementNS(svgNS,'g');g.setAttribute('class','vertex');g.dataset.i=i;
  const c=document.createElementNS(svgNS,'circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r',17);
  const t=document.createElementNS(svgNS,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+5);t.setAttribute('text-anchor','middle');t.textContent=letters[i];g.append(c,t);dsvg.append(g);
  g.addEventListener('click',()=>handleDirected(i,g));
});directedStage.append(dsvg);
function handleDirected(i,g){
  if(selected===null){selected=i;dsvg.querySelectorAll('.vertex').forEach(v=>v.classList.remove('selected'));g.classList.add('selected');document.querySelector('#directedHint').textContent=`${letters[i]}에서 어디로 그을까요?`;return;}
  const a=selected,b=i;selected=null;dsvg.querySelectorAll('.vertex').forEach(v=>v.classList.remove('selected'));
  if(a===b){document.querySelector('#directedHint').textContent='서로 다른 꼭짓점을 선택하세요.';return;}
  if(isAdjacent(a,b)){document.querySelector('#directedHint').textContent='그 선분은 변입니다. 대각선을 선택하세요.';return;}
  const key=`${letters[a]}${letters[b]}`;if(directed.has(key)){document.querySelector('#directedHint').textContent=`${key}는 이미 그었습니다.`;return;}
  directed.add(key); const o=directedPairOffset(a,b); const p1=dPts[a],p2=dPts[b]; const line=document.createElementNS(svgNS,'line');
  line.setAttribute('x1',p1.x+o.ox);line.setAttribute('y1',p1.y+o.oy);line.setAttribute('x2',p2.x+o.ox);line.setAttribute('y2',p2.y+o.oy);line.setAttribute('class','directed-line');line.setAttribute('stroke',palette[directed.size-1]);dsvg.insertBefore(line,pent.nextSibling);
  document.querySelector('#directedCount').textContent=directed.size;document.querySelector('#directedHint').textContent=`${key}를 그었습니다.`;saveEvent('directed_diagonal_drawn',{key});
  if(directed.size===10){document.querySelector('#pairArea').classList.remove('hidden');buildPairChips();saveAnswer('directed_pentagon',{count:10});}
}

let pairBuilt=false,pairFirst=null,pairCount=0;
function buildPairChips(){
  if(pairBuilt)return;pairBuilt=true; const area=document.querySelector('#pairChips');
  [...directed].sort(()=>Math.random()-.5).forEach(key=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=key;b.dataset.key=key;b.addEventListener('click',()=>pairChip(b));area.append(b);});
}
function reverse(s){return s[1]+s[0];}
function pairChip(btn){
  if(!pairFirst){pairFirst=btn;btn.classList.add('selected');return;}
  if(pairFirst===btn){btn.classList.remove('selected');pairFirst=null;return;}
  if(reverse(pairFirst.dataset.key)===btn.dataset.key){pairFirst.classList.remove('selected');pairFirst.classList.add('paired');btn.classList.add('paired');pairCount++;setFeedback('#pairResult',`${pairCount}쌍 완성!`);pairFirst=null;
    if(pairCount===5){setFeedback('#pairResult','완료! 방향을 붙여 세면 10개지만 실제 대각선은 5개입니다. 같은 대각선을 두 번씩 센 셈입니다.');markComplete(4);saveAnswer('pentagon_pairing',{pairs:5,actual_diagonals:5});}
  }else{setFeedback('#pairResult','두 카드는 같은 선분이 아닙니다. 방향만 반대인 짝을 찾아보세요.',false);pairFirst.classList.remove('selected');pairFirst=null;}
}

// ---------- 5. 전체 공식 ----------
document.querySelector('#checkFinal').addEventListener('click',()=>{
  const a=norm(document.querySelector('#directedFormula').value).replaceAll('*','');
  const b=norm(document.querySelector('#finalFormula').value).replaceAll('*','');
  const ok1=['n(n-3)','(n)(n-3)','n×(n-3)'].includes(a);
  const ok2=['n(n-3)/2','n(n-3)÷2','n(n-3)/2'].includes(b);
  if(ok1&&ok2){setFeedback('#step5Feedback','정답! 각 꼭짓점에서 n-3개씩 세면 n(n-3)개이고, 같은 대각선을 두 번씩 세었으므로 2로 나눕니다.');markComplete(5);}else if(!ok1){setFeedback('#step5Feedback','먼저 n개의 꼭짓점에서 각각 n-3개씩 센 식을 생각해 보세요.',false);}else{setFeedback('#step5Feedback','같은 실제 대각선이 두 방향으로 중복되므로 마지막에 2로 나누어야 합니다.',false);}
  saveAnswer('final_formula',{directed:a,final:b,correct:ok1&&ok2});
});

document.querySelector('#submitAll').addEventListener('click',async()=>{
  if(completed.size<5){setFeedback('#submitFeedback',`아직 ${5-completed.size}개 활동이 남았습니다.`,false);return;}
  await saveEvent('submitted',{completed_steps:[...completed]});
  if(configured){await supabase.from('activity_sessions').update({submitted_at:new Date().toISOString()}).eq('id',sessionId);}
  setFeedback('#submitFeedback','제출되었습니다. 수고했어요!');
});
