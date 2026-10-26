const idle = page => page.waitForFunction(() => !document.querySelector('[data-testid="day-transition"]'));
// Make explicit, free dispositions through real controls for full-season QA.
// Individual decision tests do not call this helper until their scenario is done.
async function respondToPending(page) {
  if (!(await page.$('[data-testid="decision-gate-link"]'))) return;
  await page.$eval('[data-testid="tab-decisions"]', e => e.click());
  for(let guard=0;guard<24;guard++) {
    const pending = await page.$$('[data-testid^="case-"][data-case-status="open"], [data-testid^="case-"][data-case-status="awaiting_approval"]');
    if(!pending.length) break;
    for(const card of pending) {
      const status=await card.evaluate(e=>e.dataset.caseStatus);
      if(status==='awaiting_approval') { const reject=await card.$('[data-testid^="reject-"]'); if(reject)await reject.evaluate(e=>e.click()); }
      else {
        const none=await card.$('[data-testid="action-none"]'); if(!none)throw Error('No explicit no-action option for pending case');
        await none.evaluate(e=>e.click());
        const submit=await card.$('[data-testid^="submit-case-"]'); if(!submit)throw Error('Decision submit not found');
        await submit.evaluate(e=>e.click());
      }
    }
  }
  const recommendations=await page.$$('[data-testid^="reject-DEC-"]');
  for(const button of recommendations)await button.evaluate(e=>e.click());
  if(await page.$('[data-testid="decision-gate-link"]'))throw Error('Unanswered decision remains after explicit QA dispositions');
}
module.exports={idle,respondToPending};
