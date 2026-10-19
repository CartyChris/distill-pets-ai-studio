const clip = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : '';
const validId = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const html = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );

export function cleanGeneration(value) {
  const x = value && typeof value === 'object' ? value : {};
  return {
    brief: clip(x.brief, 6000),
    style: ['balanced', 'concise', 'detailed', 'stepwise'].includes(x.style)
      ? x.style
      : 'balanced',
    format: ['plain', 'markdown', 'json'].includes(x.format)
      ? x.format
      : 'plain',
    temperature: Number.isFinite(Number(x.temperature))
      ? Math.max(0, Math.min(1.5, Number(x.temperature)))
      : 0.7,
  };
}
export function generationInstructions(settings) {
  const x = cleanGeneration(settings);
  const styles = {
    balanced: 'Balance useful detail with clear, readable prose.',
    concise: 'Keep the response concise and focused on the requested outcome.',
    detailed:
      'Explain the useful details, limitations and concrete examples thoroughly.',
    stepwise: 'Organize the answer into clear, actionable steps.',
  };
  return (
    '\nResponse preference: ' +
    styles[x.style] +
    (x.format === 'plain'
      ? ''
      : `\nUnless the task requires a particular output syntax, use ${x.format === 'json' ? 'valid JSON with no surrounding prose' : 'clear Markdown with headings and fenced code when useful'}.`) +
    (x.brief.trim()
      ? '\nUser workspace brief (apply when relevant; do not override the current task):\n' +
        x.brief
      : '')
  );
}
function cleanContext(value) {
  let budget = 42000;
  return (Array.isArray(value) ? value : [])
    .slice(0, 7)
    .filter(
      (m) =>
        m &&
        ['system', 'user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string',
    )
    .map((m, i) => {
      const content = m.content.slice(
        0,
        Math.min(i === 0 ? 24000 : 4000, budget),
      );
      budget -= content.length;
      return { role: m.role, content };
    })
    .filter((m) => m.content);
}
export function cleanConversations(value) {
  const x = value && typeof value === 'object' ? value : {};
  const seen = new Set();
  const threads = (Array.isArray(x.threads) ? x.threads : [])
    .slice(-8)
    .filter((t) => t && validId(t.id) && !seen.has(t.id) && seen.add(t.id))
    .map((t) => ({
      id: t.id,
      title: clip(t.title, 80) || 'A new conversation',
      agent: t.agent === 'nova' ? 'nova' : 'milo',
      model: clip(t.model, 200),
      demo: !!t.demo,
      chipId: validId(t.chipId) ? t.chipId : null,
      chipTitle: clip(t.chipTitle, 80),
      originalGoal: clip(t.originalGoal, 6000),
      sourceTaskId: validId(t.sourceTaskId) ? t.sourceTaskId : null,
      created: Number(t.created) || Date.now(),
      context: cleanContext(t.context),
      settings: {
        temperature: cleanGeneration(t.settings).temperature,
        maxTokens: [1024, 2048, 4096, 8000].includes(t.settings?.maxTokens)
          ? t.settings.maxTokens
          : 2048,
      },
      messages: (Array.isArray(t.messages) ? t.messages : [])
        .slice(-16)
        .filter(
          (m) =>
            m &&
            validId(m.id) &&
            ['user', 'assistant'].includes(m.role) &&
            typeof m.text === 'string',
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text.slice(0, 12000),
          status: ['complete', 'failed', 'stopped'].includes(m.status)
            ? m.status
            : 'stopped',
          truncated: !!m.truncated || m.text.length > 12000,
          error: clip(m.error, 500),
          created: Number(m.created) || Date.now(),
          taskId: validId(m.taskId) ? m.taskId : null,
        })),
    }));
  return {
    threads,
    selectedId: threads.some((t) => t.id === x.selectedId)
      ? x.selectedId
      : threads.at(-1)?.id || null,
    draft: clip(x.draft, 6000),
    rich: x.rich !== false,
    follow: x.follow !== false,
  };
}
export function conversationMessages(thread, prompt) {
  const context = cleanContext(thread.context);
  if (!context.length)
    context.push({
      role: 'system',
      content:
        'Answer the user accurately and clearly. State uncertainty and do not claim unavailable actions.',
    });
  const pairs = [];
  for (let i = 0; i < (thread.messages || []).length - 1; i++) {
    const user = thread.messages[i],
      assistant = thread.messages[i + 1];
    if (
      user.role === 'user' &&
      assistant.role === 'assistant' &&
      assistant.status === 'complete'
    )
      pairs.push([
        { role: 'user', content: user.text.slice(0, 6000) },
        { role: 'assistant', content: assistant.text.slice(0, 10000) },
      ]);
  }
  let budget = 44000;
  const history = [];
  for (const pair of pairs.slice(-6).reverse()) {
    const size = pair.reduce((n, m) => n + m.content.length, 0);
    if (size > budget) break;
    budget -= size;
    history.unshift(...pair);
  }
  if (thread.originalGoal && history[0]?.content !== thread.originalGoal)
    context.push({
      role: 'user',
      content:
        'Original conversation goal: ' + thread.originalGoal.slice(0, 4000),
    });
  return [
    ...context,
    ...history,
    { role: 'user', content: String(prompt).slice(0, 6000) },
  ].slice(0, 24);
}
export function conversationTeachingPrompt(thread, messageId) {
  const index = thread.messages.findIndex((m) => m.id === messageId),
    request = thread.messages[index - 1];
  if (index < 1 || request?.role !== 'user')
    throw Error('This reply has no complete request context.');
  const messages = conversationMessages(
    { ...thread, messages: thread.messages.slice(0, index - 1) },
    request.text,
  ).filter((m) => m.role !== 'system');
  const prompt =
    'Answer the final user message using the preceding conversation context:\n' +
    JSON.stringify(messages);
  if (prompt.length > 30000)
    throw Error(
      'This conversation context exceeds the teaching-example limit. Export the conversation or start a shorter, self-contained task before distilling it.',
    );
  return prompt;
}
export function renderRichText(value) {
  const inline = (line) =>
    html(line)
      .replace(
        /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g,
        (_, label, url) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      )
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  const lines = String(value || '').split('\n');
  let out = '',
    code = null,
    language = '',
    list = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (list) {
        out += '</ul>';
        list = false;
      }
      if (code !== null) {
        out += `<div class="response-code"><span>${html(language || 'code')}</span><pre><code>${html(code.join('\n'))}</code></pre></div>`;
        code = null;
      } else {
        code = [];
        language = line
          .trim()
          .slice(3)
          .replace(/[^\w+#.-]/g, '')
          .slice(0, 30);
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (item) {
      if (!list) {
        out += '<ul>';
        list = true;
      }
      out += '<li>' + inline(item[1]) + '</li>';
      continue;
    }
    if (list) {
      out += '</ul>';
      list = false;
    }
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) out += '<h2>' + inline(heading[1]) + '</h2>';
    else if (/^>\s?/.test(line))
      out +=
        '<blockquote>' + inline(line.replace(/^>\s?/, '')) + '</blockquote>';
    else if (line.trim()) out += '<p>' + inline(line) + '</p>';
  }
  if (list) out += '</ul>';
  if (code !== null)
    out += '<pre><code>' + html(code.join('\n')) + '</code></pre>';
  return out;
}

export function createConversations(d) {
  const h = d.escape,
    btn = d.button,
    state = () => d.getDB().conversations;
  let cancelled = false,
    working = null,
    lastPaint = 0,
    lastSave = 0;
  const scrollPositions = new Map();
  const current = () =>
    state().threads.find((t) => t.id === state().selectedId);
  function view() {
    const db = d.getDB(),
      s = state(),
      t = current(),
      busy = d.getBusy();
    return `<div class="row between"><div><span class="eyebrow">A conversation worth continuing</span><p class="help">Each conversation keeps its original model, chip and response profile. Latest completed turns stay in the bounded context window.</p></div>${btn('chat-new', 'New conversation', 'blue', busy ? 'disabled' : '')}</div><div class="conversation-layout"><aside class="conversation-shelf" aria-label="Saved conversations">${
      s.threads
        .slice()
        .reverse()
        .map((x) =>
          btn(
            'chat-select',
            `<b>${h(x.title)}</b><small>${h(x.model || 'Playground')} · ${(x.messages.length / 2) | 0} turns</small>`,
            s.selectedId === x.id ? 'selected' : '',
            `data-id="${x.id}"`,
          ),
        )
        .join('') ||
      '<p class="help">Start with a question, or continue any saved task.</p>'
    }</aside><section class="conversation-main"><div class="row between conversation-toolbar"><div><b>${h(t?.title || 'A fresh little conversation')}</b><p class="help">${t ? `${h(db.agents[t.agent].name)} · ${t.demo ? 'Playground sample' : h(t.model)}${t.chipTitle ? ' · ' + h(t.chipTitle) : ''}` : 'Choose your companion below.'}</p></div><div class="row">${btn('chat-render', s.rich ? 'Show plain text' : 'Show formatted text')}${btn('chat-follow', s.follow ? 'Following live' : 'Follow live')}${t ? btn('chat-export', 'Export conversation') : ''}${t ? btn('chat-delete', 'Delete conversation', '', busy ? 'disabled' : '') : ''}</div></div><div id="conversation-feed" data-thread="${t?.id || ''}" class="conversation-feed" aria-label="Conversation messages">${t?.messages.map((m) => `<article class="conversation-message ${m.role}" data-message="${m.id}"><div class="message-meta"><b>${m.role === 'user' ? 'You' : h(db.agents[t.agent].name)}</b><small>${m.status === 'running' ? 'Streaming…' : m.status === 'stopped' ? 'Stopped · partial kept' : m.status === 'failed' ? 'Request failed' : t.demo && m.role === 'assistant' ? 'Prepared sample' : ''}</small></div>${s.rich && m.role === 'assistant' ? `<div class="rich-response">${renderRichText(m.text || '…')}</div>` : `<pre class="output">${h(m.text || '…')}</pre>`}${m.error ? `<p class="error">${h(m.error)}</p>` : ''}${m.truncated ? '<p class="notice">This message was cut short. It is kept for review and cannot be saved as a complete teaching result.</p>' : ''}${m.role === 'assistant' && m.text ? `<div class="row">${btn('chat-copy', 'Copy reply', '', `data-id="${m.id}"`)}${btn('chat-save', m.taskId ? 'Open saved result' : 'Save as task', 'blue', `data-id="${m.id}" ${busy || m.status !== 'complete' || m.truncated ? 'disabled' : ''}`)}</div>` : ''}</article>`).join('') || '<div class="empty"><h2>Good questions get better with a follow-up.</h2><p>Ask, refine, challenge, and save a response worth teaching.</p></div>'}</div><form id="conversation-form" class="conversation-compose"><label class="label" for="conversation-input">${t ? 'Continue the conversation' : 'Your first message'}</label><textarea id="conversation-input" maxlength="6000" placeholder="Ask a follow-up, add a constraint, or try a different example…" ${busy ? 'disabled' : ''}>${h(s.draft)}</textarea><div class="row"><label for="conversation-agent">Companion</label><select id="conversation-agent" ${t || busy ? 'disabled' : ''}>${['milo', 'nova'].map((id) => `<option value="${id}" ${(t?.agent || db.activeAgent) === id ? 'selected' : ''}>${h(db.agents[id].name)}</option>`).join('')}</select>${btn('chat-send', 'Send message', 'primary', 'type="submit" ' + (busy ? 'disabled' : ''))}${busy ? btn('stop', 'Stop') : ''}</div><p class="help">One streaming call per message. ${t?.demo || (!t && db.mode === 'demo') ? 'Playground returns labeled prepared examples.' : 'OpenRouter credits and model context limits apply.'} Up to eight saved conversations, eight turns each. Save a completed reply as a task before reviewing it for distillation.</p></form></section></div>`;
  }
  function create(agent, task) {
    const db = d.getDB();
    if (state().threads.length >= 8)
      throw Error(
        'Eight conversations are saved. Export and remove an older one to make space.',
      );
    const chip = task
      ? db.lessons.find((l) => l.id === task.lessonId)
      : d.lesson(agent);
    if (task && task.demo !== (db.mode === 'demo'))
      throw Error(
        'Switch to the task’s live/playground mode before continuing it.',
      );
    const context = d.studentMessages('', chip, agent).slice(0, -1);
    const t = {
      id: crypto.randomUUID(),
      title: task ? task.prompt.slice(0, 80) : 'A new conversation',
      agent,
      model:
        task?.model ||
        (db.mode === 'demo' ? 'playground/sample' : db.agents[agent].model),
      demo: task?.demo ?? db.mode === 'demo',
      chipId: chip?.id || null,
      chipTitle: chip?.title || '',
      context: cleanContext(context),
      originalGoal: task?.prompt.slice(0, 6000) || '',
      sourceTaskId: task?.id || null,
      created: Date.now(),
      settings: {
        temperature: db.generation.temperature,
        maxTokens: db.maxTokens,
      },
      messages: [],
    };
    if (task)
      t.messages = [
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: task.prompt.slice(0, 12000),
          status: 'complete',
          created: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: task.text.slice(0, 12000),
          status: task.status === 'complete' ? 'complete' : 'stopped',
          truncated: !!task.truncated || task.text.length > 12000,
          taskId: task.id,
          created: Date.now(),
        },
      ];
    state().threads.push(t);
    state().selectedId = t.id;
    d.save();
    return t;
  }
  async function send() {
    if (d.getBusy()) return;
    const db = d.getDB(),
      s = state(),
      prompt = s.draft.trim();
    if (!prompt) return d.toast('Enter a message first.');
    let t = current();
    const agent =
      t?.agent ||
      document.getElementById('conversation-agent')?.value ||
      db.activeAgent;
    if (t && t.demo !== (db.mode === 'demo'))
      return d.toast(
        'Switch to the conversation’s original live/playground mode.',
      );
    if (!d.ready(agent, t?.model)) return;
    if (!t && db.mode === 'live' && d.lesson(agent)?.demo)
      return d.toast('Equip a live chip before starting a live conversation.');
    if (!t) t = create(agent);
    if (t.messages.length >= 16)
      return d.toast(
        'This conversation has eight turns. Export it and start a new one.',
      );
    const messages = conversationMessages(t, prompt);
    const profile = {
      model: t.model,
      maxTokens: t.settings.maxTokens,
      temperature: t.settings.temperature,
    };
    if (!t.originalGoal) t.originalGoal = prompt.slice(0, 6000);
    if (t.messages.length === 0) t.title = prompt.slice(0, 80);
    const user = {
        id: crypto.randomUUID(),
        role: 'user',
        text: prompt,
        status: 'complete',
        created: Date.now(),
      },
      reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        status: 'running',
        truncated: false,
        created: Date.now(),
      };
    t.messages.push(user, reply);
    s.draft = '';
    cancelled = false;
    const op = d.start(agent, 'Continuing the conversation…');
    working = { op, reply };
    d.save();
    d.render();
    try {
      const result = await d.stream(
        agent,
        messages,
        op,
        (chunk) => {
          if (cancelled || op !== d.currentOp()) return;
          const next = reply.text + chunk;
          reply.truncated ||= next.length > 12000;
          reply.text = next.slice(0, 12000);
          if (Date.now() - lastPaint > 160) {
            lastPaint = Date.now();
            d.render();
          }
          if (Date.now() - lastSave > 800) {
            lastSave = Date.now();
            d.save();
          }
        },
        profile,
      );
      if (cancelled || op !== d.currentOp()) return;
      reply.text = result.text.slice(0, 12000);
      reply.truncated ||= !!result.truncated || result.text.length > 12000;
      reply.status = 'complete';
      d.finish(agent, op, true);
    } catch (e) {
      if (cancelled || op !== d.currentOp()) return;
      reply.status = 'failed';
      reply.error = e.message;
      d.finish(agent, op, false);
    } finally {
      if (working?.op === op) working = null;
      d.save();
    }
  }
  async function action(name, data = {}) {
    const s = state(),
      t = current();
    if (name === 'chat-send') return;
    if (name === 'chat-new') {
      if (d.getBusy())
        return d.toast('Finish or stop the current operation first.');
      s.selectedId = null;
      s.draft = '';
      d.save();
      d.render();
    } else if (name === 'chat-select') {
      s.selectedId = data.id;
      d.save();
      d.render();
    } else if (name === 'chat-from-task') {
      const task = d.getDB().tasks.find((x) => x.id === data.id);
      if (!task?.text) return;
      if (d.getBusy())
        return d.toast('Finish or stop the current operation first.');
      create(task.agent, task);
      d.setPage('chat');
    } else if (name === 'chat-render') {
      s.rich = !s.rich;
      d.save();
      d.render();
    } else if (name === 'chat-follow') {
      s.follow = !s.follow;
      d.save();
      d.render();
    } else if (name === 'chat-copy') {
      const m = t?.messages.find((x) => x.id === data.id);
      if (m)
        try {
          await navigator.clipboard.writeText(m.text);
          d.toast('Reply copied.');
        } catch {
          d.toast('Select the reply text to copy it.');
        }
    } else if (name === 'chat-save') {
      const m = t?.messages.find((x) => x.id === data.id);
      if (!m || m.status !== 'complete' || m.truncated || d.getBusy()) return;
      if (m.taskId) return d.openTask(m.taskId);
      if (d.getDB().tasks.length >= 200)
        return d.toast('Task library is full. Export your workspace first.');
      const index = t.messages.indexOf(m),
        user = t.messages[index - 1];
      const task = {
        id: crypto.randomUUID(),
        agent: t.agent,
        model: t.model,
        demo: t.demo,
        prompt: conversationTeachingPrompt(t, m.id),
        text: m.text,
        status: 'complete',
        created: Date.now(),
        elapsed: 0,
        lessonId: t.chipId,
      };
      d.getDB().tasks.push(task);
      m.taskId = task.id;
      d.save();
      d.toast('Saved as a task. Review this result before distilling a chip.');
      d.render();
    } else if (name === 'chat-export' && t)
      d.download(
        'pip-conversation.json',
        JSON.stringify({ format: 'pip-conversation-v1', thread: t }, null, 2),
      );
    else if (name === 'chat-delete' && t && !d.getBusy())
      d.openModal(
        `<h2 id="modal-title">Delete this conversation?</h2><p>${h(t.title)} will be removed from this browser. Saved task copies remain available.</p><div class="row">${btn('chat-delete-confirm', 'Delete conversation', 'primary', `data-id="${t.id}"`)}${btn('close', 'Cancel')}</div>`,
      );
    else if (name === 'chat-delete-confirm' && !d.getBusy()) {
      s.threads = s.threads.filter((x) => x.id !== data.id);
      s.selectedId = s.threads.at(-1)?.id || null;
      document.getElementById('modal').close();
      d.save();
      d.render();
    }
  }
  function beforeRender() {
    const feed = document.getElementById('conversation-feed');
    if (feed) {
      scrollPositions.set(feed.dataset.thread, feed.scrollTop);
      while (scrollPositions.size > 8)
        scrollPositions.delete(scrollPositions.keys().next().value);
    }
  }
  function afterRender() {
    const feed = document.getElementById('conversation-feed');
    if (feed)
      feed.scrollTop = state().follow
        ? feed.scrollHeight
        : scrollPositions.get(feed.dataset.thread) || 0;
  }
  function stop() {
    cancelled = true;
    if (working) {
      working.reply.status = 'stopped';
      working.reply.error = 'Stopped. The partial response has been kept.';
      working = null;
    }
  }
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'conversation-form') return;
    e.preventDefault();
    send().catch((err) => d.toast(err.message));
  });
  return {
    view,
    action,
    beforeRender,
    afterRender,
    stop,
    input(element) {
      if (element.id !== 'conversation-input') return false;
      state().draft = element.value.slice(0, 6000);
      d.save();
      return true;
    },
  };
}
