import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const form=document.querySelector('#teacherLogin'),msg=document.querySelector('#teacherMsg'),dash=document.querySelector('#dashboard'),table=document.querySelector('#sessionTable');
form.addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email:document.querySelector('#email').value,password:document.querySelector('#password').value});if(error){msg.textContent='로그인 실패: '+error.message;msg.className='feedback warn';return;}msg.textContent='로그인되었습니다.';msg.className='feedback good';dash.hidden=false;load();});
document.querySelector('#refresh').addEventListener('click',load);
async function load(){
 const {data:sessions,error}=await supabase.from('activity_sessions').select('id,student_id,started_at,submitted_at').order('started_at',{ascending:false}).limit(200);if(error){msg.textContent='조회 실패: '+error.message;return;}
 const ids=sessions.map(s=>s.id); let events=[]; if(ids.length){const r=await supabase.from('activity_events').select('session_id,event_type,created_at').in('session_id',ids).order('created_at',{ascending:true});events=r.data||[];}
 const by=new Map();for(const e of events){if(!by.has(e.session_id))by.set(e.session_id,[]);by.get(e.session_id).push(e)}
 table.innerHTML='<thead><tr><th>학번</th><th>접속</th><th>마지막 기록</th><th>이탈 횟수</th><th>제출</th></tr></thead><tbody></tbody>';const tb=table.querySelector('tbody');
 for(const s of sessions){const es=by.get(s.id)||[];const last=es.at(-1)?.created_at||s.started_at;const hidden=es.filter(e=>e.event_type==='page_hidden').length;const tr=document.createElement('tr');tr.innerHTML=`<td>${s.student_id}</td><td>${fmt(s.started_at)}</td><td>${fmt(last)}</td><td>${hidden}</td><td>${s.submitted_at?fmt(s.submitted_at):'—'}</td>`;tr.querySelectorAll('td').forEach(td=>{td.style.padding='10px';td.style.borderBottom='1px solid #dde5df'});tb.append(tr)}
}
function fmt(v){return new Date(v).toLocaleString('ko-KR',{hour12:false});}
