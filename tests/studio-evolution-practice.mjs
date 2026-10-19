import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { newStudioPage, waitIdle, saved, ENDPOINT, ORIGINAL, TEACHER, STUDENT, KEY, PRIVATE, sse } from './studio-evolution-harness.mjs';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const text = request => request.messages.map(message => message.content).join('\n');
async function start(page, options) {
  await page.evaluate(options => { window.__run = window.__evolution.studio.run('task', { prompt: options.prompt || 'ORIGINAL_TASK_SENTINEL: Explain a useful idea clearly and check the result.', ...options }); }, options);
}
async function noSecrets(page) {
  const data = JSON.stringify(await saved(page));
  assert.ok(!data.includes(KEY), 'API keys stay outside saved studio data');
  assert.ok(!data.includes(PRIVATE), 'Private provider reasoning stays outside saved public messages');
  assert.ok(!(await page.locator('body').innerText()).includes(PRIVATE));
  assert.deepEqual(page.__evolutionErrors, []);
}

try {
  // The existing default still makes exactly one call; practice can also run without introductory Q/A.
  const defaults = await newStudioPage(browser);
  const defaultCalls = [];
  await defaults.route(ENDPOINT, route => { defaultCalls.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('DEFAULT_MAIN_RESULT') }); });
  await start(defaults, {});
  const defaultDone = await waitIdle(defaults);
  assert.equal(defaultCalls.length, 1);
  assert.equal(defaultDone.studio.lastRun.practice, false);
  assert.equal(defaultDone.studio.dialogue.length, 0);
  await noSecrets(defaults); await defaults.close();

  const page = await newStudioPage(browser);
  const calls = [], phases = [];
  const first = deferred(), release = deferred();
  const outputs = ['MAIN_DEMONSTRATION_SENTINEL', 'STUDENT_QUESTION_SENTINEL', 'TEACHER_REPLY_SENTINEL', 'PRACTICE_ONE_SENTINEL', 'FEEDBACK_ONE_SENTINEL', 'PRACTICE_TWO_SENTINEL', 'FEEDBACK_TWO_SENTINEL'];
  await page.route(ENDPOINT, async route => {
    const request = route.request().postDataJSON(); calls.push(request);
    phases.push(await page.evaluate(() => ({ phase: __evolution.db.studio.lastRun.phase, speaker: __evolution.db.studio.lastRun.speakingAgent })));
    if (calls.length === 1) { first.resolve(); await release.promise; }
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(outputs[calls.length - 1] || 'UNEXPECTED_EXTRA_CALL') });
  });
  await page.evaluate(() => { __evolution.queue.teacher.push({ text: 'TEACHER_GUIDANCE_SENTINEL: keep the mechanism accurate.' }); __evolution.queue.student.push({ text: 'STUDENT_GUIDANCE_SENTINEL: include an application check.' }); });
  await start(page, { tutorDialogue: true, practice: true, practiceRounds: 2 });
  await first.promise;
  // Public profile changes belong to future runs, even if a setting changes while the provider is pending.
  await page.evaluate(() => {
    __evolution.db.agents.milo.model = 'test/MUTATED_MODEL'; __evolution.db.agents.nova.model = 'test/MUTATED_STUDENT_MODEL';
    __evolution.db.agents.milo.voice = 'MUTATED_VOICE'; __evolution.db.agents.nova.voice = 'MUTATED_STUDENT_VOICE';
    __evolution.db.lessons.forEach(chip => { chip.instructions = 'MUTATED_CHIP'; });
    __evolution.db.generation.brief = 'MUTATED_BRIEF'; __evolution.db.generation.temperature = 1.9; __evolution.db.maxTokens = 4096;
  });
  release.resolve();
  const done = await waitIdle(page);
  assert.equal(calls.length, 7, 'One main response, two Q/A calls and two practice-feedback pairs');
  assert.deepEqual(phases, [
    { phase: 'teacher-demonstration', speaker: 'milo' }, { phase: 'student-question', speaker: 'nova' }, { phase: 'teacher-reply', speaker: 'milo' },
    { phase: 'student-practice', speaker: 'nova' }, { phase: 'teacher-feedback', speaker: 'milo' }, { phase: 'student-practice', speaker: 'nova' }, { phase: 'teacher-feedback', speaker: 'milo' },
  ]);
  for (let i = 0; i < calls.length; i++) {
    const role = [1, 3, 5].includes(i) ? 'student' : 'teacher';
    assert.equal(calls[i].model, role === 'teacher' ? TEACHER : STUDENT);
    assert.equal(calls[i].max_tokens, 2048); assert.equal(calls[i].temperature, 0.4);
    assert.ok(text(calls[i]).includes(ORIGINAL));
    assert.ok(text(calls[i]).includes(role === 'teacher' ? 'TEACHER_CHIP_SENTINEL' : 'STUDENT_CHIP_SENTINEL'));
    assert.ok(text(calls[i]).includes(role === 'teacher' ? 'Voice: precise' : 'Voice: socratic'));
    assert.ok(text(calls[i]).includes(role === 'teacher' ? 'TEACHER_GUIDANCE_SENTINEL' : 'STUDENT_GUIDANCE_SENTINEL'));
    assert.ok(text(calls[i]).includes('BRIEF_SENTINEL'));
    assert.ok(!text(calls[i]).includes('MUTATED_'));
    assert.ok(!text(calls[i]).includes(PRIVATE));
  }
  for (const index of [3, 4, 5, 6]) {
    for (const context of ['MAIN_DEMONSTRATION_SENTINEL', 'STUDENT_QUESTION_SENTINEL', 'TEACHER_REPLY_SENTINEL']) assert.ok(text(calls[index]).includes(context));
  }
  assert.ok(text(calls[5]).includes('PRACTICE_ONE_SENTINEL'));
  assert.ok(text(calls[5]).includes('FEEDBACK_ONE_SENTINEL'), 'Second practice actually receives prior teacher feedback');
  assert.equal(done.studio.output, 'MAIN_DEMONSTRATION_SENTINEL', 'Practice never replaces the main result');
  assert.equal(done.studio.lastRun.status, 'complete'); assert.equal(done.studio.lastRun.practiceRound, 2);
  assert.deepEqual(done.studio.dialogue.map(message => message.text), outputs.slice(1));
  assert.ok(done.studio.dialogue.every(message => message.status === 'complete'));
  await page.evaluate(() => __evolution.setPage('live'));
  await page.getByText('PRACTICE_TWO_SENTINEL', { exact: true }).waitFor();
  await page.reload();
  await page.waitForFunction(() => !!window.__evolution);
  const reloaded = await saved(page);
  assert.equal(reloaded.studio.lastRun.practice, true); assert.equal(reloaded.studio.lastRun.practiceRounds, 2);
  assert.equal(reloaded.studio.lastRun.studentModel, STUDENT);
  assert.ok(reloaded.studio.lastRun.teacherProfile[0].content.includes('Voice: precise'));
  await noSecrets(page); await page.close();

  const practiceOnly = await newStudioPage(browser);
  const practiceCalls = [];
  await practiceOnly.route(ENDPOINT, route => { practiceCalls.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('Practice-only public message ' + practiceCalls.length) }); });
  await start(practiceOnly, { tutorDialogue: false, practice: true, practiceRounds: 99 });
  const practiceDone = await waitIdle(practiceOnly);
  assert.equal(practiceCalls.length, 7, 'Practice is independent of Q/A and remains bounded at three rounds');
  assert.equal(practiceDone.studio.lastRun.dialogueEnabled, false);
  assert.equal(practiceDone.studio.lastRun.practice, true); assert.equal(practiceDone.studio.lastRun.practiceRounds, 3);
  assert.equal(practiceDone.studio.dialogue.length, 6);
  assert.ok(practiceDone.studio.dialogue.every(message => !message.kind.includes('question') && !message.kind.includes('reply')));
  await noSecrets(practiceOnly); await practiceOnly.close();

  // Each optional failure preserves the paid main result and prevents dependent calls.
  for (const failure of ['rate-limit', 'truncated', 'stop']) {
    const subject = await newStudioPage(browser), failureCalls = [];
    const seen = deferred(), finish = deferred(), routeFinished = deferred();
    await subject.route(ENDPOINT, async route => {
      failureCalls.push(route.request().postDataJSON());
      const index = failureCalls.length;
      if (index === 4 && failure === 'stop') { seen.resolve(); await finish.promise; }
      try {
        await route.fulfill(index === 4 && failure === 'rate-limit'
          ? { status: 429, contentType: 'application/json', body: '{}' }
          : { status: 200, contentType: 'text/event-stream', body: sse(index === 1 ? 'MAIN_RESULT_KEPT' : 'Public optional message ' + index, { finishReason: index === 4 && failure === 'truncated' ? 'length' : 'stop' }) });
      } catch { if (failure !== 'stop') throw Error('Unexpected route failure'); }
      finally { if (index === 4) routeFinished.resolve(); }
    });
    await start(subject, { tutorDialogue: true, practice: true, practiceRounds: 2 });
    if (failure === 'stop') { await seen.promise; await subject.evaluate(() => __evolution.stop()); finish.resolve(); await routeFinished.promise; }
    const result = await waitIdle(subject);
    await subject.waitForTimeout(100);
    assert.equal(failureCalls.length, 4, 'No teacher feedback or later practice may follow ' + failure);
    assert.equal(result.studio.output, 'MAIN_RESULT_KEPT');
    assert.equal(result.studio.lastRun.status, failure === 'stop' ? 'stopped' : 'complete');
    assert.equal(result.studio.dialogue.at(-1).status, failure === 'stop' ? 'stopped' : 'failed');
    await noSecrets(subject); await subject.close();
  }

  // Conversation transport receives frozen controls and does not mutate studio transcripts or events.
  const transport = await newStudioPage(browser);
  const transportCalls = [];
  await transport.route(ENDPOINT, route => { transportCalls.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('CONVERSATION_PUBLIC_RESPONSE', { finishReason: 'length' }) }); });
  const before = (await saved(transport)).studio;
  const streamed = await transport.evaluate(async () => {
    let publicText = '';
    const result = await __evolution.studio.stream('nova', [{ role: 'user', content: 'A conversation turn.' }], __evolution.op, chunk => { publicText += chunk; }, { model: 'test/conversation-frozen', maxTokens: 512, temperature: 0.2 });
    return { result, publicText, studio: __evolution.db.studio };
  });
  assert.equal(transportCalls[0].model, 'test/conversation-frozen'); assert.equal(transportCalls[0].max_tokens, 512); assert.equal(transportCalls[0].temperature, 0.2);
  assert.equal(streamed.publicText, 'CONVERSATION_PUBLIC_RESPONSE'); assert.equal(streamed.result.truncated, true);
  assert.deepEqual(streamed.studio, before, 'Conversation streaming leaves studio state untouched even at the output limit');
  assert.ok(!JSON.stringify(streamed.result).includes(PRIVATE));
  await noSecrets(transport); await transport.close();

  const demo = await newStudioPage(browser, { mode: 'demo' });
  let demoCalls = 0;
  await demo.route(ENDPOINT, route => { demoCalls++; return route.abort(); });
  await start(demo, { practice: true, practiceRounds: 1 });
  const demoDone = await waitIdle(demo);
  assert.equal(demoCalls, 0);
  assert.ok(demoDone.studio.dialogue.every(message => message.demo && /prepared/i.test(message.text)));
  await noSecrets(demo); await demo.close();
  console.log('PASS: opt-in bounded practice/Q&A, frozen profiles and controls, cumulative guidance, public dialogue, practice-only mode, failure/truncation/Stop recovery, isolated conversation transport and prepared demos.');
} finally {
  await browser.close();
}
