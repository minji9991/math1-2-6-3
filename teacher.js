import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const form=$('#teacherLogin'),msg=$('#teacherMsg'),dash=$('#dashboard'),control=$('#controlPanel'),table=$('#sessionTable');
const stepNames=['','내각의 합 탐구','개념 적용 · 내각','외각의 합 실험','외각의 합 이유','개념 적용 · 외각','정다각형','생각 더 나아가기'];

form.addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});if(error){msg.textContent='로그인 실패: '+error.message;msg.className='feedback warn';return;}await openDashboard();});
$('#refresh').addEventListener('click',load);
$('#lockAll').addEventListener('click',async()=>{const patch={};for(let i=1;i<=7;i++)patch[`step_${i}`]=false;await updateControl(patch);});

async function openDashboard(){msg.textContent='로그인되었습니다.';msg.className='feedback good';dash.hidden=false;control.hidden=false;await Promise.all([loadControl(),load()]);}

async function loadControl(){
  const {data,error}=await supabase.from('lesson_control').select('*').eq('id',1).single();
  if(error){msg.textContent='활동 제어 조회 실패: '+error.message;return;}
  const host=$('#stepControls');host.innerHTML='';
  for(let i=1;i<=7;i++){
    const row=document.createElement('div');row.className='step-control-row';
    const label=document.createElement('div');label.innerHTML=`<b>활동 ${i}</b><span>${stepNames[i]}</span>`;
    const btn=document.createElement('button');btn.type='button';btn.className='toggle '+(data[`step_${i}`]?'on':'');btn.textContent=data[`step_${i}`]?'열림':'잠김';
    btn.addEventListener('click',()=>updateControl({[`step_${i}`]:!data[`step_${i}`]}));row.append(label,btn);host.append(row);
  }
}
async function updateControl(patch){const {error}=await supabase.from('lesson_control').update({...patch,updated_at:new Date().toISOString()}).eq('id',1);if(error){msg.textContent='활동 제어 저장 실패: '+error.message;msg.className='feedback warn';return;}msg.textContent='활동 상태를 변경했습니다.';msg.className='feedback good';await loadControl();}

async function load(){
 const {data:sessions,error}=await supabase.from('activity_sessions').select('id,student_id,started_at,last_seen_at,submitted_at').order('started_at',{ascending:false}).limit(200);if(error){msg.textContent='조회 실패: '+error.message;msg.className='feedback warn';return;}
 const ids=sessions.map(s=>s.id);let events=[];if(ids.length){const r=await supabase.from('activity_events').select('session_id,event_type,created_at,payload').in('session_id',ids).order('created_at',{ascending:true});events=r.data||[];}
 const by=new Map();for(const e of events){if(!by.has(e.session_id))by.set(e.session_id,[]);by.get(e.session_id).push(e);}
 const now=Date.now();let online=0,submitted=0;
 table.innerHTML='<thead><tr><th>학번</th><th>현재 상태</th><th>접속</th><th>마지막 신호</th><th>이탈 횟수</th><th>최근 활동</th><th>제출</th></tr></thead><tbody></tbody>';const tb=table.querySelector('tbody');
 for(const s of sessions){const es=by.get(s.id)||[];const lastEvent=es.at(-1);const lastSeen=new Date(s.last_seen_at||s.started_at).getTime();const recent=(now-lastSeen)<45000;let state='미응답';let stateClass='offline';if(lastEvent?.event_type==='page_hidden' && (now-new Date(lastEvent.created_at).getTime())<120000){state='페이지 이탈';stateClass='away';}else if(recent){state='접속 중';stateClass='online';online++;}
   const hidden=es.filter(e=>e.event_type==='page_hidden').length;const comp=es.filter(e=>e.event_type==='step_completed').map(e=>e.payload?.step).filter(Boolean);const recentStep=comp.length?`활동 ${Math.max(...comp)} 완료`:'활동 중';if(s.submitted_at)submitted++;
   const tr=document.createElement('tr');tr.innerHTML=`<td>${escapeHtml(s.student_id)}</td><td><span class="presence ${stateClass}">${state}</span></td><td>${fmt(s.started_at)}</td><td>${fmt(s.last_seen_at||s.started_at)}</td><td>${hidden}</td><td>${recentStep}</td><td>${s.submitted_at?fmt(s.submitted_at):'—'}</td>`;tb.append(tr);
 }
 $('#onlineCount').textContent=online;$('#sessionCount').textContent=sessions.length;$('#submittedCount').textContent=submitted;
}
function fmt(v){return v?new Date(v).toLocaleString('ko-KR',{hour12:false}):'—';}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

const {data:{session}}=await supabase.auth.getSession();if(session)await openDashboard();
setInterval(()=>{if(!dash.hidden)load();},10000);
