import {blankState,progress,weight,choose,record,makeQuestion,shuffle,summarize,dayKey,validateState,DAY} from './scheduler-a2d0eef3a4.js';
const $=s=>document.querySelector(s),KEY='kiocvoca-progress-v1';
const icons={close:'<path d="m6 6 12 12M18 6 6 18"/>',arrow:'<path d="m14 6 6 6-6 6M4 12h16"/>',left:'<path d="m10 6-6 6 6 6M4 12h16"/>',sound:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weightText=p=>{const n=weight(p)*100;return n>=1?Math.round(n)+'%':n>=.01?n.toFixed(2)+'%':'<0.01%';};
const modes={learn:{name:'乱序练习',en:'SHUFFLE',short:'乱序'},associate:{name:'联想练习',en:'ASSOCIATION',short:'联想'},quiz:{name:'语义测试',en:'MEANING CHECK',short:'测试'}};
let data,state,pool=[],page='learn',current=null,phase='question',options=[],chosen=null,lastPassed=null,undoState=null;
let groupOrder=[],currentGroup=null,groupCount=0,tablePage=0,tableFilter='all',tableQuery='',timer,toastTimer,restoreFocus;
const main=$('#main'),sheet=$('#sheet');
let savingOK=true,offlineReady=false,storageWarned=false;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));savingOK=true;}
  catch{state.events=state.events.slice(-2500);try{localStorage.setItem(KEY,JSON.stringify(state));savingOK=true;}catch{savingOK=false;if(!storageWarned){toast('本机存储不可用，请导出备份后继续。');storageWarned=true;}}}
  status();
}
function status(){const label=!savingOK?'未能保存':offlineReady?'已离线就绪':navigator.onLine?'本机保存':'离线使用';$('#offline-status').innerHTML=`<span></span> ${label}`;}
function theme(){const setting=state.settings.theme;document.documentElement.dataset.theme=setting==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):setting;const dark=document.documentElement.dataset.theme==='dark';$('meta[name=theme-color]').content=dark?'#060607':'#ffffff';}
function refreshPool(){pool=data.words.filter(w=>state.settings.books.includes(w.book));groupOrder=[];currentGroup=null;groupCount=0;}
function bookLabel(){return state.settings.books.map(n=>['I','II','III'][n-1]).join(' · ');}
function today(){return state.days[dayKey()]||{seen:0,passed:0,ids:[]};}
function heading(name,en){const t=today();return `<div class="page-heading"><div><div class="eyebrow">${en}</div><h1>${name}</h1></div><div class="heading-meta"><button class="book-label" id="books-open" aria-label="选择词库">VOL. ${bookLabel()}</button><div class="today-mini" aria-label="今日已练习 ${t.seen} 次，目标 ${state.settings.goal} 次"><b>${t.seen}</b><span> / ${state.settings.goal}</span><div class="progress-mini"><i style="width:${Math.min(100,t.seen/state.settings.goal*100)}%"></i></div></div></div></div>`;}
function sidebar(){const sum=summarize(pool,state),t=today(),allowed=new Set(pool.map(w=>w.id));const recent=state.events.filter(e=>allowed.has(e.id)).slice(-5).reverse();return `<aside class="sidebar"><div class="aside-card"><h2>今日练习</h2><div class="big-count">${t.seen}<span style="font-size:14px;letter-spacing:0;color:var(--muted)"> 次</span></div><div class="meter"><i style="width:${Math.min(100,t.seen/state.settings.goal*100)}%"></i></div><div class="aside-line"><span>已接触单词</span><b>${sum.seen} / ${sum.total}</b></div><div class="aside-line"><span>已降低频率</span><b>${sum.reduced}</b></div><div class="aside-line"><span>到期复习</span><b>${sum.due}</b></div><button class="text-button" id="rules-open">复习规则 ${icon('info')}</button></div><div class="aside-card"><h2>最近练习</h2><div class="recent-list">${recent.length?recent.map(e=>`<div class="recent-word"><b>${esc(e.id)}</b><span>${e.passed?'通过':'待复习'}</span></div>`).join(''):'<p class="empty-small">完成第一张卡片后<br>在这里查看练习记录。</p>'}</div></div></aside>`;}
function nextWord(){
  clearTimeout(timer);
  if(page==='associate'){
    const eligible=pool.filter(w=>!progress(state,w.id).seen || Date.now()-progress(state,w.id).lastSeen>=30000);
    if(!currentGroup || groupCount>=4 || !eligible.some(w=>w.group===currentGroup)){
      if(!groupOrder.length)groupOrder=shuffle([...new Set(pool.map(w=>w.group))]);
      currentGroup=groupOrder.pop();groupCount=0;
    }
  }
  current=choose(pool,state,{preferredGroup:page==='associate'?currentGroup:null});
  if(current&&page==='associate'){if(current.group!==currentGroup){currentGroup=current.group;groupCount=0;}groupCount++;}
  phase='question';chosen=null;lastPassed=null;undoState=null;
  options=current&&page==='quiz'?makeQuestion(current,data.words):[];
  renderPractice();
}
function renderPractice(){
  const m=modes[page];if(!m)return;
  main.innerHTML=`<section class="practice-page">${heading(m.name,m.en)}<div class="practice-layout"><div class="stage" id="stage"></div>${sidebar()}</div></section>`;
  const stage=$('#stage');
  if(!current){
    const candidates=pool.filter(w=>progress(state,w.id).seen);
    const wait=candidates.length?Math.max(1,Math.ceil(Math.min(...candidates.map(w=>progress(state,w.id).lastSeen+30000-Date.now()))/1000)):0;
    stage.innerHTML=`<div class="word-card glass"><div class="empty" style="margin:auto"><div class="eyebrow">SPACED REVIEW</div><h2 style="margin-top:16px">让记忆间隔一下</h2><p>当前可选单词正在冷却。<br>${wait} 秒后继续，或选择更多词库。</p><button class="text-button" id="wait-retry">重新检查</button></div></div>`;
    $('#wait-retry').onclick=nextWord;timer=setTimeout(nextWord,Math.min(30000,Math.max(1000,wait*1000)));bindCommon();return;
  }
  const p=progress(state,current.id),feedback=phase==='answer',tier=Math.floor(p.streak/5),mark=lastPassed?'通过':'待复习';
  stage.innerHTML=`<div class="card-wrap"><article class="word-card glass ${page==='quiz'?'quiz-card':''}" id="word-card" aria-label="单词 ${esc(current.word)}" tabindex="0">
    <span class="swipe-label known" aria-hidden="true">认识</span><span class="swipe-label unknown" aria-hidden="true">不认识</span>
    <div class="card-meta"><span>VOCABULARY ${['I','II','III'][current.book-1]} <span style="opacity:.5">/</span> ${String(data.words.indexOf(current)+1).padStart(3,'0')}</span><span class="round-dots" aria-label="连续通过 ${p.streak} 轮">${Array.from({length:5},(_,i)=>`<i class="${i<(p.streak%5|| (p.streak?5:0))?'on':''}"></i>`).join('')}</span></div>
    <div class="word-center"><h2 class="word">${esc(current.word)}${current.variants.length?`<span class="variants">${esc(current.variants.join(' / '))}</span>`:''}</h2>
      <div class="word-tools"><button class="speak" id="speak-word" aria-label="朗读 ${esc(current.word)}">${icon('sound')}</button></div>
      ${feedback?`<div class="answer-panel"><div class="meaning">${esc(current.meaning)}</div><p class="simple">${esc(current.definition)}</p><div class="answer-note">${lastPassed?(p.streak%5===0?`连续通过 ${p.streak} 轮 · 抽中权重降至 ${weightText(p)}`:`连续通过 ${p.streak} 轮`):'连续轮次归零 · 抽中权重恢复默认'}</div></div>`:''}
    </div><div class="card-bottom"><span>${page==='associate'?`<span class="pill orange">${esc(current.group)}</span>`:feedback?`<span class="result-tag ${lastPassed?'':'fail'}">${mark}</span>`:(page==='quiz'?'选择最接近的释义':'请先判断是否认识')}</span><span>${feedback?`<button class="text-button" id="undo-answer">撤销</button>`:`${p.seen?`累计通过 ${p.passed} 轮`:'首次练习'}`}</span></div>
   </article></div>
   ${page==='quiz'?`<div class="quiz-choices" aria-label="选择最接近的简单释义">${options.map((o,i)=>`<button class="choice ${feedback?(o.correct?'correct':chosen===i?'incorrect':''):''}" data-choice="${i}" ${feedback?'disabled':''}><small>${'ABCD'[i]}</small><span>${esc(o.label)}</span></button>`).join('')}</div>`:''}
   ${feedback?`<div class="answer-actions"><button class="action-button glass next-button" id="next-word">下一词 ${icon('arrow')}</button></div>`:page!=='quiz'?`<div class="answer-actions"><button class="action-button glass known" id="mark-known">${icon('left')}认识</button><button class="action-button glass unknown" id="mark-unknown">不认识${icon('arrow')}</button></div>`:''}
   <div class="shortcut">${feedback?'轻触卡片，继续下一词':page==='quiz'?'选择与单词最接近的释义':'左滑认识 · 右滑不认识'}</div>`;
  $('#speak-word')?.addEventListener('click',e=>{e.stopPropagation();speak(current.word);});
  $('#mark-known')?.addEventListener('click',()=>answer(true));$('#mark-unknown')?.addEventListener('click',()=>answer(false));
  $('#next-word')?.addEventListener('click',nextWord);
  $('#undo-answer')?.addEventListener('click',e=>{e.stopPropagation();if(undoState){state=undoState;save();undoState=null;phase='question';lastPassed=null;chosen=null;renderPractice();}});
  document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{if(phase!=='question')return;chosen=Number(button.dataset.choice);answer(options[chosen].correct);});
  bindSwipe();bindCommon();
}
function answer(passed){
  if(!current||phase!=='question')return;
  undoState=state;state=record(state,current.id,passed,page);save();phase='answer';lastPassed=passed;
  renderPractice();
}
function bindSwipe(){
  const card=$('#word-card');if(!card)return;
  let start=null,dragged=false;
  card.addEventListener('pointerdown',e=>{if(e.target.closest('button')||page==='quiz'||phase!=='question')return;start={x:e.clientX,y:e.clientY,id:e.pointerId};dragged=false;card.setPointerCapture(e.pointerId);});
  card.addEventListener('pointermove',e=>{
    if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(Math.abs(dy)>Math.abs(dx)+24){start=null;resetDrag();return;}
    if(Math.abs(dx)>8)dragged=true;
    card.classList.add('dragging');card.style.setProperty('--drag',`${dx*.55}px`);card.style.setProperty('--tilt',`${dx/40}deg`);
    card.classList.toggle('swipe-left',dx<-24);card.classList.toggle('swipe-right',dx>24);
    card.querySelector('.known').style.opacity=String(Math.min(1,Math.max(0,-dx/120)));
    card.querySelector('.unknown').style.opacity=String(Math.min(1,Math.max(0,dx/120)));
  });
  card.addEventListener('pointerup',e=>{
    if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
    const threshold=Math.min(80,card.clientWidth*.22);
    if(Math.abs(dx)>=threshold && Math.abs(dx)>Math.abs(dy)*1.25){dragged=true;answer(dx<0);}else resetDrag();
  });
  card.addEventListener('pointercancel',()=>{start=null;resetDrag();});
  card.addEventListener('click',e=>{if(e.target.closest('button'))return;if(phase==='answer'&&!dragged)nextWord();dragged=false;});
  function resetDrag(){card.classList.remove('dragging','swipe-left','swipe-right');card.style.removeProperty('--drag');card.style.removeProperty('--tilt');card.querySelectorAll('.swipe-label').forEach(n=>n.style.opacity='0');}
}
function speak(word){
  if(!('speechSynthesis' in window)){toast('当前浏览器不支持朗读');return;}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.85;speechSynthesis.speak(u);
}
function bindCommon(){ $('#books-open')?.addEventListener('click',openSettings);$('#rules-open')?.addEventListener('click',openRules); }
function navigate(next){
  if(!['learn','associate','quiz','stats'].includes(next))next='learn';
  clearTimeout(timer);page=next;
  document.querySelectorAll('.dock button').forEach(b=>{if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  history.replaceState(null,'',`#${page}`);main.scrollTop=0;
  if(page==='stats')renderStats();else nextWord();
}
function renderStats(){
  const s=summarize(pool,state),t=today();
  const groups=[{label:'未练习',n:s.new},{label:'连续 0–4 轮',n:pool.filter(w=>{const p=progress(state,w.id);return p.seen&&p.streak<5;}).length},{label:'连续 5–9 轮',n:pool.filter(w=>{const p=progress(state,w.id);return p.streak>=5&&p.streak<10;}).length},{label:'连续 10+ 轮',n:pool.filter(w=>progress(state,w.id).streak>=10).length}];
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-6+i);const k=dayKey(d.getTime());return {key:k,day:d.getDate(),...(state.days[k]||{seen:0,passed:0})};});
  const max=Math.max(1,...days.map(d=>d.seen));
  main.innerHTML=`<section class="stats-page">${heading('学习统计','YOUR PROGRESS')}
    <div class="stats-grid"><article class="metric"><h2>已接触单词</h2><b>${s.seen}<span style="font-size:14px;color:var(--muted)"> / ${s.total}</span></b><small>当前所选词库</small></article><article class="metric"><h2>累计通过率</h2><b>${s.accuracy===null?'—':Math.round(s.accuracy*100)+'%'}</b><small>${s.passes} / ${s.attempts} 次</small></article><article class="metric"><h2>已降低频率</h2><b>${s.reduced}</b><small>当前连续通过 ≥ 5 轮</small></article><article class="metric"><h2>到期复习</h2><b>${s.due}</b><small>当前所选词库</small></article></div>
    <div class="stats-charts"><section class="panel"><div class="panel-header"><h2>近 7 日练习</h2><small>全部词库 · 次数</small></div><div class="bar-chart">${days.map(d=>`<div class="bar-slot"><span class="bar-value">${d.seen}</span><button class="bar" style="height:${Math.max(4,d.seen/max*110)}px" aria-label="${d.key}：${d.seen} 次，${d.passed} 次通过" data-day="${d.key}"></button><label>${d.day}日</label></div>`).join('')}</div></section><section class="panel"><div class="panel-header"><h2>熟悉程度</h2><button class="icon-button" id="stats-rules" aria-label="查看熟悉程度规则" style="width:24px;height:24px">${icon('info')}</button></div>${groups.map(g=>`<div class="distribution-row"><span>${g.label}</span><div class="meter"><i style="width:${g.n/s.total*100}%"></i></div><b>${g.n}</b></div>`).join('')}</section></div>
    <section class="panel word-table"><div class="panel-header"><h2>单词记录</h2><div class="table-controls"><input type="search" id="word-search" class="search" placeholder="搜索单词或词义" aria-label="搜索单词或词义" value="${esc(tableQuery)}"><select id="word-filter" aria-label="筛选单词"><option value="all">全部单词</option><option value="seen">已练习</option><option value="due">到期复习</option><option value="weak">待巩固</option><option value="reduced">已降频</option></select></div></div><div id="table-content"></div></section>
    <p class="page-foot">乱序、联想和语义测试共享学习记录；“认识”是自评，“测试”是客观选择题。<button class="text-button" id="backup-open">备份与设置</button></p></section>`;
  $('#word-filter').value=tableFilter;$('#word-search').addEventListener('input',e=>{tableQuery=e.target.value;tablePage=0;renderTable();});$('#word-filter').onchange=e=>{tableFilter=e.target.value;tablePage=0;renderTable();};
  $('#stats-rules').onclick=openRules;$('#backup-open').onclick=openSettings;
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const d=state.days[b.dataset.day];toast(`${b.dataset.day} · ${d?.seen||0} 次练习 · ${d?.passed||0} 次通过`);});
  renderTable();bindCommon();
}
function renderTable(){
  let list=pool.filter(w=>{
    const p=progress(state,w.id),q=tableQuery.toLowerCase().trim();
    return (!q||`${w.word} ${w.meaning} ${w.answer}`.toLowerCase().includes(q))&&
      (tableFilter==='all'||tableFilter==='seen'&&p.seen||tableFilter==='due'&&p.seen&&p.dueAt<=Date.now()||tableFilter==='weak'&&p.failed>0&&p.streak<5||tableFilter==='reduced'&&p.streak>=5);
  }).sort((a,b)=>a.word.localeCompare(b.word));
  const pages=Math.max(1,Math.ceil(list.length/20));tablePage=Math.min(tablePage,pages-1);
  $('#table-content').innerHTML=`<div class="table-scroll"><table class="words-table"><thead><tr><th>单词 / 词义</th><th class="num">累计通过</th><th class="num">连续轮次</th><th class="num">抽中权重</th></tr></thead><tbody>${list.slice(tablePage*20,tablePage*20+20).map(w=>{const p=progress(state,w.id);return `<tr><td><b>${esc(w.word)}</b><small>${esc(w.meaning)}</small></td><td class="num">${p.passed}</td><td class="num">${p.streak}</td><td class="num">${weightText(p)}</td></tr>`;}).join('')}</tbody></table>${list.length?'':'<div class="empty">没有符合条件的单词</div>'}</div><div class="pagination"><button id="table-prev" ${tablePage?'':'disabled'}>上一页</button><span>${list.length} 词 · ${tablePage+1} / ${pages}</span><button id="table-next" ${tablePage+1<pages?'':'disabled'}>下一页</button></div>`;
  $('#table-prev').onclick=()=>{tablePage--;renderTable();};$('#table-next').onclick=()=>{tablePage++;renderTable();};
}
function showSheet(title,body,bind=()=>{}){
  restoreFocus=document.activeElement;sheet.classList.remove('closing');
  $('#sheet-content').innerHTML=`<div class="sheet-inner"><div class="sheet-header"><h2 id="sheet-title">${title}</h2><button class="icon-button" id="sheet-close" aria-label="关闭">${icon('close')}</button></div>${body}</div>`;
  if(!sheet.open)sheet.showModal();$('#sheet-close').onclick=closeSheet;bind();
}
function closeSheet(){if(!sheet.open)return;sheet.classList.add('closing');setTimeout(()=>{sheet.close();sheet.classList.remove('closing');restoreFocus?.isConnected&&restoreFocus.focus();},180);}
sheet.addEventListener('cancel',e=>{e.preventDefault();closeSheet();});sheet.addEventListener('click',e=>{const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();});
function openSettings(){
  showSheet('词库与设置',`<div class="setting-section"><h3>练习词库</h3><div class="settings-books">${data.books.map(b=>`<label class="book-check"><span>${b.name}<small>${b.entries} 词条</small></span><input type="checkbox" name="book" value="${b.id}" ${state.settings.books.includes(b.id)?'checked':''}></label>`).join('')}</div><p class="detail-text" style="margin-top:16px">623 个索引词条 · 643 张练习卡 · 84 个联想组</p></div>
    <div class="setting-section"><label class="setting-row"><span>每日目标<small>按回答次数计数</small></span><input type="number" id="daily-goal" min="10" max="200" step="10" value="${state.settings.goal}" aria-label="每日目标"></label><label class="setting-row"><span>外观</span><select id="theme-select"><option value="system">跟随系统</option><option value="light">明亮</option><option value="dark">夜间</option></select></label></div>
    <div class="setting-section"><h3>数据备份</h3><div class="settings-actions"><button id="export-progress">导出学习记录</button><button id="import-progress">导入备份</button></div><input type="file" id="backup-file" accept="application/json,.json"><p class="detail-text" style="margin-top:16px">进度只保存在当前设备的此应用中。Safari 和桌面图标可能使用不同的存储空间；换设备或清理浏览器前，请导出备份。</p></div>
    <div class="setting-section"><h3>安装到 iPhone</h3><a class="install-link" href="./KiocVoca.mobileconfig">下载桌面图标描述文件</a><button class="text-button" id="install-help">安装方法</button><button class="text-button" id="settings-rules" style="margin-left:24px">算法与词库</button><p class="detail-text" style="margin-top:8px" id="offline-detail">${offlineReady?'词库已缓存，可离线练习。':'首次联网打开后，系统会缓存完整词库。'} 朗读使用设备自带语音，离线可用性取决于已下载语音。</p></div>
    <button class="save-button" id="settings-save">完成</button>`,()=>{
      $('#theme-select').value=state.settings.theme;$('#theme-select').onchange=e=>{state.settings.theme=e.target.value;theme();save();};
      $('#export-progress').onclick=exportProgress;$('#import-progress').onclick=()=>$('#backup-file').click();$('#backup-file').onchange=importProgress;
      $('#install-help').onclick=openInstall;$('#settings-rules').onclick=openRules;
      $('#settings-save').onclick=()=>{
        const books=[...document.querySelectorAll('input[name=book]:checked')].map(i=>Number(i.value));
        if(!books.length){toast('请至少选择一册词库');return;}
        const goal=Number($('#daily-goal').value);if(!Number.isFinite(goal)||goal<10||goal>200){toast('每日目标请输入 10–200');return;}
        const changed=JSON.stringify(books)!==JSON.stringify(state.settings.books);state.settings.books=books;state.settings.goal=Math.round(goal);save();closeSheet();
        if(changed){refreshPool();current=null;tablePage=0;if(page==='stats')renderStats();else nextWord();}else if(page==='stats')renderStats();else renderPractice();
      };
    });
}
function openRules(){showSheet('算法与词库',`<div class="detail-text"><p><strong>三种练习，共享进度</strong><br>乱序按复习权重抽取；联想把近义或紧密相关的词组成语义组，组序和组内次序随机，每次最多连续练 4 个同组词。到期过久的词会优先插入。语义测试匹配词表采用的常用义，答题后展开中文解释。</p><p><strong>轮次与抽中权重</strong><br>每答对或标记“认识”算通过一轮。连续通过每满 5 轮，基础权重减半。答错或标记“不认识”会把连续轮次清零、基础权重恢复到 100%，累计通过数保留。</p><div class="formula">基础权重 = 2<sup>−⌊连续轮次 / 5⌋</sup></div><p><strong>不会紧接着重复，也不会永久消失</strong><br>同一词至少隔开 30 秒和 6 次其他回答；词库少于 7 词时按可用词数缩短回答间隔。通过后的期望间隔逐步延长，答错后约 2 分钟进入优先复习。超过 1–14 天的硬期限，或超过按词库大小设定的回答间隔，会优先复习。到期词仍服从最短冷却；不够可抽时会等待。</p><p>“到期”用于提高优先级，不是禁止提前复习。图中的抽中权重是相对基础权重，不是下一次的固定概率；实际抽取还取决于冷却、到期程度和联想分组。规则是可解释的练习安排，不是对记忆保持率的保证。</p><p><strong>词库来源与处理</strong><br>VOCABULARY I：200；II：179；III：244。完整性以三份 PDF 的末尾词汇索引核对。不同派生词分卡练习，纯拼写变体合并，共 643 张卡。中文释义与简单释义按词表语境整理；第 III 册损坏的中文提取结果已重新整理。84 个组用于联想，不表示组内所有词可在任何语境互换。测试干扰项避开同一语义组。</p><p><strong>记录与隐私</strong><br>回答后立即保存本机记录。应用无需配置 AI 或上传学习进度；导出文件包含全部单词轮次和每日汇总，最近 20,000 次回答保留明细。设备存储被清理后需要备份恢复。</p><p>算法版本 <strong>KV-SR 1.0.0</strong> · 词库版本 ${data.version}</p></div>`);}
function openInstall(){showSheet('安装到 iPhone',`<div class="detail-text"><ol><li>在 iPhone 的 Safari 中打开本应用链接。</li><li>点“下载桌面图标描述文件”，允许下载。</li><li>前往“设置 → 通用 → VPN 与设备管理”，打开 KiocVoca 描述文件并安装；系统可能显示“未签名”。</li><li>回到桌面，点 KiocVoca 图标。首次保持联网，等待词库缓存完成后即可离线练习。</li></ol><a class="install-link" href="./KiocVoca.mobileconfig">下载描述文件</a><p>也可在 Safari 分享菜单选择“添加到主屏幕”。描述文件只包含一个可移除的全屏网页图标，不包含证书、VPN、设备管理注册或远程控制权限。它不是 App Store 原生应用。</p><p>移除方法：“设置 → 通用 → VPN 与设备管理 → KiocVoca → 移除描述文件”。实际安装及离线表现需在你的 iPhone 上确认。</p><p><a href="https://support.apple.com/guide/deployment/depbc7c7808/web" target="_blank" rel="noreferrer">Apple：Web Clip 说明</a></p></div>`);}
function exportProgress(){
  const payload={...state,exportedAt:new Date().toISOString(),app:'KiocVoca',algorithm:'KV-SR 1.0.0'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`KiocVoca-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('已导出备份');
}
async function importProgress(e){
  const f=e.target.files[0];if(!f)return;
  try{
    if(f.size>15*1024*1024)throw Error('备份过大，最大支持 15 MB');
    const imported=validateState(JSON.parse(await f.text()),data.words.map(w=>w.id));
    showSheet('恢复学习记录',`<div class="detail-text"><p>备份包含 <strong>${Object.keys(imported.words).length} 个词</strong>的记录和 <strong>${imported.turn} 次</strong>回答，将替换此设备当前记录。</p><p>先导出当前记录可以保留恢复副本。</p></div><div class="settings-actions" style="margin-top:24px"><button id="export-before">导出当前记录</button><button id="confirm-import">确认替换</button></div>`,()=>{
      $('#export-before').onclick=exportProgress;$('#confirm-import').onclick=()=>{state=imported;save();theme();refreshPool();current=null;closeSheet();navigate(page);toast('学习记录已恢复');};
    });
  }catch(error){toast(error.message==='Unexpected end of JSON input'?'备份文件不完整':`无法导入：${error.message}`);}
}
document.querySelectorAll('.dock button').forEach(b=>b.onclick=()=>{if(data&&page!==b.dataset.page)navigate(b.dataset.page);});
$('#settings-open').onclick=()=>{if(data)openSettings();};$('.brand').onclick=e=>{e.preventDefault();if(data)navigate('learn');};
document.addEventListener('keydown',e=>{
  if(sheet.open||!data||page==='stats'||e.target.closest('input,select,textarea')||e.repeat)return;
  if(phase==='answer'&&['Enter',' '].includes(e.key)){e.preventDefault();nextWord();return;}
  if(page==='quiz'&&phase==='question'&&/^[1-4]$/.test(e.key)){chosen=Number(e.key)-1;answer(options[chosen].correct);return;}
  if(page!=='quiz'&&phase==='question'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();answer(e.key==='ArrowLeft');}
});
document.addEventListener('pointermove',e=>{const glass=e.target.closest('.glass');if(!glass)return;const r=glass.getBoundingClientRect();glass.style.setProperty('--px',`${e.clientX-r.left}px`);glass.style.setProperty('--py',`${e.clientY-r.top}px`);},{passive:true});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>state&&theme());
window.addEventListener('online',status);window.addEventListener('offline',status);
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue||!data)return;try{state=validateState(JSON.parse(e.newValue),data.words.map(w=>w.id));theme();refreshPool();navigate(page);toast('已同步此设备另一窗口的记录');}catch{}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data){status();if(page==='stats')renderStats();else if(!current)nextWord();}});
async function start(){
  try{
    const response=await fetch('./words-a2d0eef3a4.json');if(!response.ok)throw Error('词库加载失败');data=await response.json();
    let saved;try{saved=localStorage.getItem(KEY)||localStorage.getItem('openwords-progress-v1');}catch{savingOK=false;}
    try{state=saved?validateState(JSON.parse(saved),data.words.map(w=>w.id)):blankState();}
    catch{state=blankState();savingOK=false;main.innerHTML='<div class="empty"><h2>学习记录需要恢复</h2><p>本机记录格式异常，已保留原始数据。请先下载原始备份，再重新开始。</p><button class="text-button" id="rescue">下载原始备份</button><button class="text-button" id="restart">以新记录开始</button></div>';$('#rescue').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([saved],{type:'application/json'}));a.download='KiocVoca-recovery.json';a.click();};$('#restart').onclick=()=>{save();refreshPool();theme();navigate('learn');};return;}
    theme();refreshPool();navigate(location.hash.slice(1)||'learn');status();
    if('serviceWorker' in navigator){
      try{const reg=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;offlineReady=!!reg.active;status();navigator.storage?.persist?.().catch(()=>{});}
      catch{toast('离线缓存暂不可用，联网练习仍可保存进度');}
    }
  }catch{main.innerHTML='<div class="empty"><h2>词库尚未就绪</h2><p>首次打开需要联网，请检查连接后重试。</p><button class="text-button" id="reload">重新加载</button></div>';$('#reload').onclick=()=>location.reload();}
}
start();
