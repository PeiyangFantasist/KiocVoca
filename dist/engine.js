export const VERSION = '1.0.0';
export const DAY = 86400000;
export function blankState() {
  return {version:1,turn:0,words:{},days:{},events:[],settings:{books:[1,2,3],theme:'system',goal:40},createdAt:Date.now()};
}
export const progress = (state,id) => state.words[id] || {seen:0,passed:0,streak:0,failed:0,lastSeen:0,lastTurn:-1,dueAt:0,deadline:0,modes:{}};
export const weight = s => Math.max(Number.MIN_VALUE,2 ** -Math.floor(s.streak / 5));
export const minGap = size => Math.max(0,Math.min(6,size-1));
export function ready(word,state,size,now) {
  const s=progress(state,word.id);
  return !s.seen || (state.turn-s.lastTurn>=minGap(size) && now-s.lastSeen>=30000);
}
export function shuffle(items,rng=Math.random) {
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export function choose(pool,state,{now=Date.now(),rng=Math.random,preferredGroup=null}={}) {
  let available=pool.filter(w=>ready(w,state,pool.length,now));
  if(!available.length) return null;
  // A hard review deadline takes precedence over the current association block.
  const overdue=available.filter(w=>{
    const p=progress(state,w.id);
    return p.seen && (now>=p.deadline || state.turn-p.lastTurn>=Math.max(16,pool.length*(2+Math.floor(p.streak/5))));
  });
  if(overdue.length) return overdue.sort((a,b)=>progress(state,a.id).lastTurn-progress(state,b.id).lastTurn)[0];
  const grouped=available.filter(w=>w.group===preferredGroup);
  if(grouped.length) available=grouped;
  const masses=available.map(w=>{
    const p=progress(state,w.id);
    if(!p.seen) return 1;
    const age=Math.max(0,now-p.dueAt);
    return weight(p)*(1+Math.min(5,age/(6*3600000))) * (p.failed>0 && p.streak===0 ? 1.5:1);
  });
  let threshold=rng()*masses.reduce((a,b)=>a+b,0);
  for(let i=0;i<available.length;i++){threshold-=masses[i];if(threshold<0)return available[i];}
  return available.at(-1);
}
export function dayKey(now=Date.now()) {
  const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function record(state,id,passed,mode,now=Date.now()) {
  const old=progress(state,id), streak=passed?old.streak+1:0;
  const tier=Math.floor(streak/5), turn=state.turn+1;
  const interval=passed?Math.min(7*DAY, (10*60000)*2**Math.min(streak,10)):2*60000;
  const next={...old,seen:old.seen+1,passed:old.passed+Number(passed),failed:old.failed+Number(!passed),streak,
    lastSeen:now,lastTurn:turn,dueAt:now+interval,deadline:now+Math.min(14,1+tier*2)*DAY,
    modes:{...old.modes,[mode]:{seen:(old.modes[mode]?.seen||0)+1,passed:(old.modes[mode]?.passed||0)+Number(passed)}}};
  const key=dayKey(now),today=state.days[key]||{seen:0,passed:0,ids:[],modes:{}};
  return {...state,turn,words:{...state.words,[id]:next},days:{...state.days,[key]:{...today,seen:today.seen+1,
    passed:today.passed+Number(passed),ids:[...new Set([...today.ids,id])],modes:{...today.modes,[mode]:(today.modes[mode]||0)+1}}},
    events:[...state.events,{id,passed,mode,at:now,turn}].slice(-20000)};
}
export function makeQuestion(word,pool,rng=Math.random) {
  const norm=x=>x.toLowerCase().replace(/[^a-z ]/g,'').trim();
  const answer=norm(word.answer),targets=new Set(answer.split(' '));
  const choices=[word.answer],seen=new Set([answer]);
  // Keep semantically neighboring words OUT of the distractor pool: they may be valid answers.
  const candidates=shuffle(pool.filter(w=>w.group!==word.group && w.id!==word.id),rng);
  for(const w of candidates){
    const a=norm(w.answer);
    if(seen.has(a) || a===norm(word.word) || a.split(' ').some(v=>targets.has(v)))continue;
    choices.push(w.answer);seen.add(a);if(choices.length===4)break;
  }
  if(choices.length!==4) throw new Error('当前词库不足以生成四个互不重复的选项。');
  return shuffle(choices,rng).map(label=>({label,correct:label===word.answer}));
}
export function summarize(pool,state,now=Date.now()) {
  const states=pool.map(w=>progress(state,w.id));
  const seen=states.filter(s=>s.seen).length, reduced=states.filter(s=>s.streak>=5).length;
  const attempts=states.reduce((n,s)=>n+s.seen,0),passes=states.reduce((n,s)=>n+s.passed,0);
  return {total:pool.length,seen,new:pool.length-seen,reduced,attempts,passes,accuracy:attempts?passes/attempts:null,
    due:states.filter(s=>s.seen && s.dueAt<=now).length,ready:pool.filter(w=>ready(w,state,pool.length,now)).length};
}
export function validateState(input,validIds) {
  if(!input||input.version!==1||!input.words||!input.days||!Number.isSafeInteger(input.turn)||input.turn<0)throw Error('备份格式不正确');
  const next=blankState(),ids=new Set(validIds);
  next.turn=input.turn;next.createdAt=Number(input.createdAt)||Date.now();
  for(const [id,s] of Object.entries(input.words)) {
    if(!ids.has(id))continue;
    for(const k of ['seen','passed','failed','streak','lastSeen','lastTurn','dueAt','deadline'])
      if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error('单词记录损坏');
    if(s.passed+s.failed!==s.seen||s.streak>s.passed||s.lastTurn>input.turn)throw Error('轮次记录不一致');
    next.words[id]={...s,modes:structuredClone(s.modes||{})};
  }
  for(const [key,d] of Object.entries(input.days)) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!Number.isSafeInteger(d.seen)||d.seen<0||!Number.isSafeInteger(d.passed)||d.passed<0||d.passed>d.seen||!Array.isArray(d.ids))throw Error('每日统计损坏');
    next.days[key]={seen:d.seen,passed:d.passed,ids:d.ids.filter(id=>ids.has(id)),modes:d.modes||{}};
  }
  next.events=Array.isArray(input.events)?input.events.filter(e=>ids.has(e.id)&&Number.isFinite(e.at)&&typeof e.passed==='boolean').slice(-20000):[];
  const books=input.settings?.books;
  next.settings={books:Array.isArray(books)&&books.some(n=>[1,2,3].includes(n))?[...new Set(books.filter(n=>[1,2,3].includes(n)))]:[1,2,3],
    theme:['system','light','dark'].includes(input.settings?.theme)?input.settings.theme:'system',
    goal:Math.max(10,Math.min(200,Number(input.settings?.goal)||40))};
  return next;
}
