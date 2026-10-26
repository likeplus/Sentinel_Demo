const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const puppeteer=require('puppeteer');
const {idle,respondToPending}=require('./game-browser-helpers.cjs');
(async()=>{
 const out='docs/validation/screenshots/day-flow';await fs.mkdir(out,{recursive:true});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[],consoleErrors=[],failedRequests=[];p.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
 const s=id=>`[data-testid="${id}"]`;
 const click=async id=>{await idle(p);await p.waitForSelector(s(id));await p.$eval(s(id),e=>{for(let a=e.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS'&&!(e.tagName==='SUMMARY'&&a===e.parentElement))a.open=true;e.scrollIntoView({block:'center'});});await p.click(s(id));await idle(p);};
 const fill=async(id,value)=>p.$eval(s(id),(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 const {decodeSave}=await import('../src/game/persistence.js');const raw=()=>p.evaluate(()=>localStorage.getItem('sentinel:farm-game:save:v1'));const cp=async()=>decodeSave(await raw()).checkpoint;
 const date=async()=>(await cp()).state.currentDate;
 const shot=async name=>{await p.setViewport({width:1920,height:1080});const h=await p.evaluate(()=>{document.querySelectorAll('.fb-scroll').forEach(e=>{e.scrollTop=0;e.scrollLeft=0});const m=document.querySelector('.fg-main');m.scrollTop=0;return Math.max(1080,m.scrollHeight+70);});await p.setViewport({width:1920,height:h});await p.screenshot({path:`${out}/${name}.png`,fullPage:true});await p.setViewport({width:1920,height:1080});};
 try{
 await p.setViewport({width:1920,height:1080});await p.goto(`${process.env.SMOKE_BASE_URL||'http://127.0.0.1:5173'}/game`,{waitUntil:'networkidle0'});await click('onboarding-dismiss');
 assert.ok(await p.$eval(`${s('farm-planning-column')} ${s('resource-overview')}`,e=>!!e));
 assert.equal(await p.$(`${s('farm-observation-column')} ${s('resource-overview')}`),null);
 await click('selection-PU-01');assert.equal(await p.$eval(s('right-selection-PU-01'),e=>e.checked),true);
 await click('right-selection-PU-12');assert.equal(await p.$eval(s('selection-PU-12'),e=>e.checked),true);
 await p.$eval(s('unit-selection-right'),e=>[...e.querySelectorAll('button')].find(b=>/清空/.test(b.textContent)).click());
 await p.select(s('task-unit'),'PU-01');await click('attach-manual_watering');await click('task-confirm');
 await p.select(s('task-unit'),'PU-12');await click('attach-manual_watering');await click('task-confirm');
 await shot('01-morning-workspace');
 const before=(await cp()).state;
 // Observe before clicking: a short transition can finish before a later CDP
 // selector waiter starts, even though it was painted correctly in the browser.
 const transition=await p.$eval(s('advance-day'),button=>new Promise((resolve,reject)=>{
  const started=performance.now();let shownAt=null,disabledDuringTransition=false,wasVisible=false;
  const observer=new MutationObserver(check);
  const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Execution transition did not appear and finish'));},10000);
  function check(){
   const overlay=document.querySelector('[data-testid="day-transition"]');
   if(overlay&&shownAt===null){shownAt=performance.now();disabledDuringTransition=document.querySelector('[data-testid="advance-day"]').disabled;wasVisible=overlay.getBoundingClientRect().height>0&&getComputedStyle(overlay).visibility!=='hidden';}
   if(!overlay&&shownAt!==null){clearTimeout(timeout);observer.disconnect();resolve({elapsed:performance.now()-started,visibleMs:performance.now()-shownAt,disabledDuringTransition,wasVisible});}
  }
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  button.click();button.click();button.click();check();
 }));
 assert.equal(transition.disabledDuringTransition,true);assert.equal(transition.wasVisible,true);assert.ok(transition.visibleMs>0);
 await idle(p);const elapsed=Math.round(transition.elapsed), after=(await cp()).state;
 assert.ok(elapsed>=480,`animation lasted ${elapsed} ms`);assert.equal(after.management.phase,'end_of_day');assert.equal(after.currentDate,before.currentDate);
 assert.equal(after.scheduledOperations.length,2);assert.equal(after.farmState.finance.cash,before.farmState.finance.cash-200);
 const water12=await p.$eval(s('table-unit-PU-12'),e=>e.closest('tr').textContent);
 const observation12=after.observations.find(o=>o.productionUnitId==='PU-12'&&o.domain==='crop_equipment');assert.ok(observation12);
 await shot('02-end-of-day');await click('advance-day');await click('advance-day');await click('advance-day');await click('advance-day');await click('advance-day');
 assert.equal(await date(),'2026-03-04');assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),true);
 await click('decision-gate-link');assert.ok(await p.$(s('decision-trend-water-stress-pu03')));await shot('03-decision-evidence');
 await click('ai-delegate-water-stress-pu03');assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),false);
 await click('advance-day');await click('advance-day');assert.equal(await date(),'2026-03-05');assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),true);
 await click('decision-gate-link');await click('reject-water-stress-pu03');await click('action-delay');await fill('review-date-water-stress-pu03','2026-03-07');await click('submit-case-water-stress-pu03');
 assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),false);await click('advance-day');await click('advance-day');assert.equal(await date(),'2026-03-06');
 await p.evaluate(()=>document.querySelectorAll('.fg-workspace-priorities').forEach(e=>e.open=true));
 const reportText=await p.$eval('.fg-workspace-weather',e=>e.innerText);assert.match(reportText,/农艺师/);assert.match(reportText,/实验室/);assert.match(reportText,/2026-03-04/);assert.match(reportText,/2026-03-06/);
 await click('tab-decisions');assert.ok(await p.$(`${s('decision-trend-water-stress-pu03')} [data-observation-id="pu03-lab-day4"]`));await shot('04-laboratory-report');
 await click('tab-map');await click('table-unit-PU-12');
 const points=await p.$$eval(`${s('water-evidence-trend')} [data-observation-date]`,a=>a.map(e=>e.dataset.observationDate));assert.deepEqual([...new Set(points)],['2026-03-01']);
 assert.match(await p.$eval(s('freshness-PU-12'),e=>e.innerText),/5天前/);
 assert.equal((await cp()).state.observations.find(o=>o.id===observation12.id).value,observation12.value);
 const toolbar1=await p.$eval(s('day-toolbar'),e=>e.getBoundingClientRect().top);await p.$eval('.fg-main',e=>e.scrollTop=e.scrollHeight);
 const toolbar2=await p.$eval(s('day-toolbar'),e=>e.getBoundingClientRect().top);assert.ok(toolbar2<=toolbar1&&toolbar2>=60,`sticky position ${toolbar2}`);
 await click('advance-day');await click('advance-day');assert.equal(await date(),'2026-03-07');assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),true);
 await click('decision-gate-link');await click('action-none');await click('submit-case-water-stress-pu03');
 for(let guard=0;guard<7 && !(await cp()).state.openDecisionCases.some(d=>d.id==='valve-disruption');guard++){await respondToPending(p);await click('advance-day');await click('advance-day');await click('tab-decisions');}
 assert.ok((await cp()).state.openDecisionCases.some(d=>d.id==='valve-disruption'),'valve event arrives within its scenario window');
 await click('manager-enter-valve-disruption');await click('action-repair-valve');await click('submit-case-valve-disruption');await click('tab-map');
 assert.match(await p.$eval(s('task-summary-table'),e=>e.innerText),/独立维修人员.*0.5/);assert.match(await p.$eval(s('crew-remaining'),e=>e.innerText),/8/);assert.match(await p.$eval(s('capacity-maintenance-person'),e=>e.innerText),/0.5/);
 await shot('05-personnel-capacity');
 const save=await raw();await p.reload({waitUntil:'networkidle0'});assert.equal(await raw(),save);assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),false);
 await click('tab-guide');assert.match(await p.$eval(s('gameplay-guide'),e=>e.innerText),/农艺师|送检/);assert.equal(await p.$$('[data-guide-module]').then(a=>a.length),7);await shot('06-gameplay-guide');
 await click('locale-en');assert.doesNotMatch(await p.$eval(s('gameplay-guide'),e=>e.innerText),/[\u4e00-\u9fff]/);await click('tab-map');
 await p.setViewport({width:390,height:844});assert.ok(await p.$eval('body',e=>e.scrollWidth)<=395);await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 assert.equal(await p.$eval(s('advance-day'),e=>e.disabled),false);await click('advance-day');assert.equal((await cp()).state.management.phase,'end_of_day');
 assert.equal((await cp()).state.farmState.finance.operatingCostToDate,350);
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests.filter(r=>!['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.url).hostname)),[],'all application assets load');
 assert.deepEqual(consoleErrors.filter(e=>!e.includes('favicon') && !(e.includes('ERR_TUNNEL_CONNECTION_FAILED') && failedRequests.length>0 && failedRequests.every(r=>['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.url).hostname)))),[]);
 await fs.writeFile('/tmp/day-flow-browser-results.json',JSON.stringify({animationMs:elapsed,day:await date(),frozenObservation:observation12.id,initialInspectionText:water12,checks:['synchronized selection','right resources','sticky toolbar','single execution and 500ms transition','pending decision gate','waiting delegation','approval gate','explicit future review','review due again','lab source and timing','related chart','no extrapolated points','independent personnel capacity','reload','seven guide modules','bilingual','390px','reduced motion'],errors,failedExternalFontRequests:failedRequests},null,2));console.log('PASS day-flow manager playthrough',elapsed,'ms');
 }catch(e){await p.screenshot({path:'/tmp/day-flow-failure.png',fullPage:true});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
