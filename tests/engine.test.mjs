import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankState,record,progress,weight,choose,ready,makeQuestion,summarize,validateState,DAY} from '../dist/engine.js';
const data=JSON.parse(readFileSync(new URL('../dist/words.json',import.meta.url)));
const rng=(seed=97)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const time=1900000000000;
test('all three source indexes are covered exactly, with 643 distinct cards',()=>{
 const coverage=JSON.parse(readFileSync(new URL('../data/coverage.json',import.meta.url)));
 assert.equal(coverage.entries.length,623);assert.equal(data.words.length,643);
 assert.equal(new Set(data.words.map(w=>w.id)).size,643);
 for(const b of data.books)assert.equal(coverage.entries.filter(e=>e.book===b.id).length,b.entries);
 for(const e of coverage.entries)for(const id of e.cards)assert(data.words.some(w=>w.id===id&&w.sourceEntry===e.sourceEntry));
 assert(Object.keys(coverage.groups).length>=65);assert(Object.values(coverage.groups).every(n=>n>=2));
 for(const w of data.words){assert(w.meaning.length>0);assert(w.answer.split(' ').length<=3);assert(!JSON.stringify(w).includes('\ufffd'));}
});
test('five consecutive passes halve weight; ten quarter it; failure resets without erasing history',()=>{
 let s=blankState();
 for(let i=0;i<5;i++)s=record(s,'turmoil',true,'learn',time+i*10000);
 assert.equal(progress(s,'turmoil').passed,5);assert.equal(weight(progress(s,'turmoil')),.5);
 for(let i=0;i<5;i++)s=record(s,'turmoil',true,'quiz',time+60000+i*10000);
 assert.equal(weight(progress(s,'turmoil')),.25);
 s=record(s,'turmoil',false,'associate',time+200000);
 assert.equal(progress(s,'turmoil').passed,10);assert.equal(progress(s,'turmoil').streak,0);
 assert.equal(progress(s,'turmoil').failed,1);assert.equal(weight(progress(s,'turmoil')),1);
 assert.equal(progress(s,'turmoil').modes.quiz.passed,5);assert.equal(s.turn,11);
});
test('extremely well-practiced words keep nonzero weight and a finite review deadline',()=>{
 let s=blankState();for(let i=0;i<60;i++)s=record(s,'halt',true,'learn',time+i);
 const p=progress(s,'halt');assert.equal(weight(p),1/32);assert(p.deadline-time<=14*DAY+60);assert(p.dueAt<=time+7*DAY+60);
});
test('both elapsed time and intervening answers are required before repeat',()=>{
 const pool=data.words.slice(0,20);let s=record(blankState(),pool[0].id,true,'learn',time);
 assert.equal(ready(pool[0],s,pool.length,time+40000),false);
 s.turn+=6;assert.equal(ready(pool[0],s,pool.length,time+29000),false);
 assert.equal(ready(pool[0],s,pool.length,time+30000),true);
});
test('small pool waits rather than breaking the 30 second floor',()=>{
 const pool=[data.words[0]],s=record(blankState(),pool[0].id,true,'quiz',time);
 assert.equal(choose(pool,s,{now:time+29999}),null);assert.equal(choose(pool,s,{now:time+30000}).id,pool[0].id);
});
test('hard overdue priority overrides preferred semantic group',()=>{
 const a=data.words.find(w=>w.group==='增强与促进'),b=data.words.find(w=>w.group==='法律与证据');
 let s=record(blankState(),b.id,true,'quiz',time-2*DAY);s.turn+=6;
 assert.equal(choose([a,b],s,{now:time,preferredGroup:a.group}).id,b.id);
});
test('turn deadline prevents starvation even during a rapid session',()=>{
 const pool=data.words.slice(0,20);let s=record(blankState(),pool[0].id,true,'learn',time);
 s.turn+=41;
 assert.equal(choose(pool,s,{now:time+60000,rng:()=>.99}).id,pool[0].id);
});
test('weight reduction affects actual sampling, not just the displayed number',()=>{
 const a=data.words[0],b=data.words[1];let s=blankState();
 s=record(s,a.id,true,'learn',time-60000);s=record(s,b.id,true,'learn',time-60000);
 s.turn=8;s.words[a.id].streak=5;s.words[a.id].passed=5;s.words[a.id].seen=5;
 s.words[a.id].lastTurn=1;s.words[b.id].lastTurn=1;
 const random=rng(42);let count=0;for(let i=0;i<12000;i++)count+=choose([a,b],s,{now:time,rng:random}).id===a.id;
 assert(count/12000>.31&&count/12000<.36);
});
test('long seeded session enforces repetition gap across modes',()=>{
 const pool=data.words.slice(0,40),random=rng();let s=blankState();const seen=new Map();
 for(let i=0;i<1000;i++){
  const now=time+i*10000,w=choose(pool,s,{now,rng:random});assert(w);
  const old=seen.get(w.id);if(old){assert(s.turn-old.turn>=6);assert(now-old.at>=30000);}
  s=record(s,w.id,i%4!==0,['learn','quiz','associate'][i%3],now);seen.set(w.id,{turn:s.turn,at:now});
 }
 assert.equal(s.turn,1000);assert(seen.size===40);
});
test('every word produces exactly four unique options and exactly one keyed answer',()=>{
 const random=rng(3);for(const word of data.words)for(let i=0;i<4;i++){
  const options=makeQuestion(word,data.words,random);assert.equal(options.length,4);
  assert.equal(options.filter(o=>o.correct).length,1);assert.equal(new Set(options.map(o=>o.label)).size,4);
  assert.equal(options.find(o=>o.correct).label,word.answer);
 }
 assert.equal(data.words.find(w=>w.id==='turmoil').answer,'chaos');
 assert.equal(data.words.find(w=>w.id==='extinguish').answer,'put out');
});
test('distractors do not come from the target semantic group',()=>{
 const target=data.words.find(w=>w.id==='turmoil');const options=makeQuestion(target,data.words,rng());
 for(const o of options.filter(o=>!o.correct))assert(data.words.some(w=>w.group!==target.group&&w.answer===o.label));
});
test('daily summaries and all modes survive a JSON round-trip',()=>{
 let s=record(blankState(),'turmoil',true,'quiz',time);s=record(s,'extinguish',false,'learn',time);
 const restored=validateState(JSON.parse(JSON.stringify(s)),data.words.map(w=>w.id));
 assert.deepEqual(restored.words,s.words);assert.equal(summarize(data.words,restored,time).attempts,2);
 assert.equal(summarize(data.words,restored,time).accuracy,.5);
 assert.equal(Object.values(restored.days)[0].ids.length,2);
});
test('damaged backup counters and invalid schema are rejected',()=>{
 assert.throws(()=>validateState({version:4},[]));
 let s=record(blankState(),'turmoil',true,'quiz',time);s.words.turmoil.passed=100;
 assert.throws(()=>validateState(s,['turmoil']));
 s=record(blankState(),'turmoil',true,'quiz',time);Object.values(s.days)[0].seen=-2;
 assert.throws(()=>validateState(s,['turmoil']));
});
test('only spelling variants merge, while different derivations keep separate records',()=>{
 assert(data.words.find(w=>w.id==='catalog').variants.includes('catalogue'));
 for(const id of ['integral','integrity','integrate','convict','conviction','liable','liability','prevail','prevalent'])assert(data.words.some(w=>w.id===id));
});
