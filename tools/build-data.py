"""Use only the final index pages for coverage; attach source notes separately."""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
raw=json.loads((ROOT/'data/notes-I-II.json').read_text(encoding='utf-8'))
third=json.loads((ROOT/'data/notes-III.json').read_text(encoding='utf-8'))
notes={**raw['I'],**raw['II'],**{r['word'].split('/')[0]:{'simple':r['definition'],'chinese':''} for r in third}}
curated={}; group=''
for line in (ROOT/'data/curation.txt').read_text(encoding='utf-8').splitlines():
    if line.startswith('# '): group=line[2:]; continue
    if not line.strip(): continue
    word,answer,*zh=line.split('|')
    assert word not in curated,word
    curated[word]={'group':group,'answer':answer,'meaning':zh[0] if zh else None}
extra={
'consensus':('agreement','共识；一致意见'),'controversial':('disputed','有争议的'),
'disposal':('removal','清除；处理'),'distinction':('difference','区别；差别'),
'excessive':('too much','过度的'),'intention':('plan','意图；计划'),
'investment':('money invested','投资；投资额'),'prescription':('medicine order','处方'),
'prevalent':('common','普遍的；盛行的'),'pursuit':('chase','追求；追赶'),
'resolution':('solution','解决；决议'),'revelation':('disclosure','揭露；被揭示的事实'),
'specialty':('expert area','专长；专业领域'),'transmission':('passing on','传播；传送'),
'inference':('deduction','推断；推论'),'assembly':('gathering','集会；装配'),
'conviction':('guilty verdict','定罪；坚定信念'),'liability':('legal duty','法律责任；负债'),
'integrity':('wholeness','完整；正直'),'integrate':('combine','使结合；整合')}
group_overrides={word:g for g,words in json.loads((ROOT/'data/semantic-groups.json').read_text(encoding='utf-8')).items() for word in words}
primary_zh={'consent':'同意；许可','controversy':'争议；争论','dispose':'处理；清除（dispose of）',
'distinct':'不同的；明显的','excess':'过量；超额','intend':'打算；意图','invest':'投资',
'prescribe':'开处方','prevail':'获胜；盛行','pursue':'追求；追赶','resolve':'解决；决定',
'reveal':'揭示；透露','specialist':'专家','transmit':'传播；传送','infer':'推断；推论'}
indexes=json.loads((ROOT/'data/index-pages.json').read_text(encoding='utf-8'))
cards=[]; coverage=[]; missing=[]
for book,pages in indexes.items():
    entries=[]
    for page in pages:
        if '\nVOCABULARY INDEX\n' not in page: continue
        lines=page.splitlines()
        for i,line in enumerate(lines[:-1]):
            if re.fullmatch(r'[a-z][a-z /-]*',line) and re.fullmatch(r'\d{2}(?:, \d{2})*',lines[i+1]):
                entries.append((line,lines[i+1]))
    assert len(entries)=={'1':200,'2':179,'3':244}[book],(book,len(entries))
    for label,page in entries:
        parts=re.split(r'\s*/\s*',label); primary=parts[0]
        note=notes.get(primary)
        assert note is not None,(book,label)
        spelling=primary in ('catalog','mold','favorable')
        entry_id=f'{book}:{primary}'
        members=[primary] if spelling else parts
        for member in members:
            if member not in curated and member not in extra: missing.append(member);continue
            c=curated.get(member,curated.get(primary))
            if c is None: missing.append(primary);continue
            answer,meaning=extra.get(member,(c['answer'],primary_zh.get(member) or c['meaning'] or note['chinese']))
            definition=re.sub(r'^[^A-Za-z]+','',note['simple'])
            if member in extra: definition=answer
            cards.append({'id':member,'word':member,'variants':parts[1:] if spelling else [],'book':int(book),
                          'sourceEntry':entry_id,'sourceLabel':label,'page':page,'group':group_overrides.get(member,group_overrides.get(primary,c['group'])),
                          'answer':answer,'meaning':meaning,'definition':definition})
        coverage.append({'book':int(book),'label':label,'page':page,'sourceEntry':entry_id,'cards':members})
if missing: raise SystemExit('MISSING: '+', '.join(missing))
assert len({r['id'] for r in cards})==len(cards),'duplicate headword'
assert all(r['meaning'] and '\ufffd' not in json.dumps(r,ensure_ascii=False) for r in cards)
assert all(1<=len(r['answer'].split())<=3 for r in cards)
payload={'version':'1.0.0','sourceEntries':623,'words':cards,'books':[{'id':1,'name':'VOCABULARY I','entries':200},
{'id':2,'name':'VOCABULARY II','entries':179},{'id':3,'name':'VOCABULARY III','entries':244}]}
(ROOT/'dist/words.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
groups={g:sum(c['group']==g for c in cards) for g in sorted({c['group'] for c in cards})}
(ROOT/'data/coverage.json').write_text(json.dumps({'sourceEntries':len(coverage),'cards':len(cards),'groups':groups,'entries':coverage},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sourceEntries':len(coverage),'cards':len(cards),'groups':len(groups),'singletons':[g for g,n in groups.items() if n<2]},ensure_ascii=False))
