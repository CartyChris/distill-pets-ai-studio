import test from 'node:test';
import assert from 'node:assert/strict';
let subject;
try { subject = await import('../src/conversations.js'); } catch {}
test('conversation imports recover interrupted turns and discard unrecognized sensitive fields', () => {
  assert.ok(subject, 'Conversation module must be implemented');
  const state = subject.cleanConversations({selectedId:'a',key:'secret',threads:[{id:'a',agent:'milo',model:'test/model',demo:false,context:[{role:'system',content:'Frozen chip context'}],messages:[{id:'u',role:'user',text:'A question',status:'complete'},{id:'r',role:'assistant',text:'A partial answer',status:'running',reasoning:'private'}]}]});
  assert.equal(state.threads[0].messages[1].status,'stopped');
  assert.ok(!JSON.stringify(state).includes('secret'));
  assert.ok(!JSON.stringify(state).includes('private'));
});
test('conversation requests preserve frozen profile and useful completed context within a bounded window', () => {
  assert.ok(subject);
  const thread={context:[{role:'system',content:'ORIGINAL_FROZEN_CHIP'}],messages:[{id:'u',role:'user',text:'Original goal',status:'complete'},{id:'a',role:'assistant',text:'Accepted first answer',status:'complete'},{id:'v',role:'user',text:'Unfinished request',status:'complete'},{id:'b',role:'assistant',text:'DO_NOT_USE_FAILED_PARTIAL',status:'failed'}]};
  const messages=subject.conversationMessages(thread,'Make it simpler');
  assert.equal(messages[0].content,'ORIGINAL_FROZEN_CHIP');
  assert.ok(messages.some(m=>m.content==='Accepted first answer'));
  assert.ok(!JSON.stringify(messages).includes('DO_NOT_USE_FAILED_PARTIAL'));
  assert.equal(messages.at(-1).content,'Make it simpler');
  thread.messages=Array.from({length:100},(_,i)=>({id:String(i),role:i%2?'assistant':'user',text:'x'.repeat(30000),status:'complete'}));
  const bounded=subject.conversationMessages(thread,'Final task');
  assert.ok(bounded.length<=24);
  assert.ok(bounded.reduce((sum,m)=>sum+m.content.length,0)<=100000);
});
test('rich response rendering keeps scripts and unsafe URLs inert', () => {
  assert.ok(subject);
  const html=subject.renderRichText('# Hello\n**Useful** [source](https://example.com)\n<script>alert(1)</script>\n[bad](javascript:alert(1))\n```html\n<img src=x onerror=alert(1)>\n```');
  assert.ok(html.includes('<h2>'));
  assert.ok(html.includes('<strong>Useful</strong>'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('<img'));
});
test('saved teaching examples retain intermediate constraints and reject oversized context', () => {
 const thread={context:[{role:'system',content:'Frozen system'}],originalGoal:'Make a useful plan',messages:[{id:'u1',role:'user',text:'Make a useful plan',status:'complete'},{id:'a1',role:'assistant',text:'Initial plan',status:'complete'},{id:'u2',role:'user',text:'Keep it accessible for a blind reader',status:'complete'},{id:'a2',role:'assistant',text:'Accessible plan',status:'complete'},{id:'u3',role:'user',text:'Now shorten it',status:'complete'},{id:'a3',role:'assistant',text:'Final plan',status:'complete'}]};
 const prompt=subject.conversationTeachingPrompt(thread,'a3');
 assert.ok(prompt.includes('Keep it accessible for a blind reader'));
 assert.ok(prompt.includes('Now shorten it'));
 thread.context=Array.from({length:7},(_,i)=>({role:i?'user':'system',content:'x'.repeat(12000)}));
 thread.messages[1].text='x'.repeat(10000);thread.messages[3].text='x'.repeat(10000);
 assert.throws(()=>subject.conversationTeachingPrompt(thread,'a3'),/limit|exceeds/);
 const state=subject.cleanConversations({threads:[{id:'profile',settings:{temperature:0.3,maxTokens:4096},messages:[]}]});
 assert.deepEqual(state.threads[0].settings,{temperature:0.3,maxTokens:4096});
});
