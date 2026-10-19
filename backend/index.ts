import { router, json, error } from '../portable/runtime.js';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type Completion = {
  key?: string;
  model?: string;
  messages?: Message[];
  demo?: boolean;
  kind?: string;
  learned?: boolean;
  maxTokens?: number;
  temperature?: number;
};
const ORIGIN = 'https://openrouter.ai/api/v1';

function sample(input: Completion) {
  const prompt =
    input.messages?.filter(m => m.role === 'user').at(-1)?.content || '';
  if (input.kind === 'forge-diagram')
    return 'flowchart LR\n  A["Choose a skill"] --> B["Teacher example"]\n  B --> C["Review chip"]\n  C --> D["Learner test"]';
  if (input.kind === 'forge-ui')
    return JSON.stringify({
      version: 1,
      title: 'Sample learning dashboard',
      description: 'Prepared playground sample',
      blocks: [
        { type: 'metric', label: 'Example goal', value: '1 tiny skill' },
        {
          type: 'notice',
          title: 'Practice mode',
          body: 'Illustrative sample. Review real model output before using it.',
          tone: 'info',
        },
      ],
    });
  if (input.kind === 'teach')
    return 'Start with a clear, friendly answer. Use everyday language and one concrete analogy. Break complex ideas into small steps. State uncertainties honestly. Finish with a useful next step or a gentle invitation to explore. Match the requested audience and format. Never invent facts or claim actions you did not perform.';
  if (input.kind === 'compare')
    return input.learned
      ? `Here is a friendly way to approach “${prompt.slice(0, 160)}”:\n\n1. Start with the big idea in one sentence.\n2. Make it concrete with an everyday analogy.\n3. Walk through the key steps without jargon.\n4. Check what is uncertain and invite a follow-up.\n\nThis is a sample of Nova applying a lesson. Run this with OpenRouter for an actual model response.`
      : `Task received: ${prompt.slice(0, 180)}\n\nI would answer directly, explain the main points, and include helpful details.\n\nThis is Nova’s sample baseline. Connect OpenRouter to compare real responses.`;
  if (/rainbow/i.test(prompt))
    return 'A rainbow is sunlight wearing all its colors!\n\nSunlight looks white, but it is made of many colors. When it enters a raindrop, it bends, bounces inside, and bends again as it leaves. Each color bends a little differently, spreading into a colorful arc.\n\nThink of a raindrop as a tiny glass prism. With the sun behind you and rain ahead, millions of drops can make a rainbow.\n\nWant to try making a tiny rainbow with a glass of water?';
  return `Let’s make this manageable.\n\nYour task: ${prompt.slice(0, 220)}\n\n• Define the outcome and who it is for.\n• Break the work into a few clear steps.\n• Use a concrete example to make the idea understandable.\n• Check facts and assumptions before sharing the result.\n\nThis is a prepared playground response. Connect OpenRouter for a real answer to your task.`;
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'GET /api/models': [
    async () => {
      try {
        const response = await fetch(`${ORIGIN}/models`, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok)
          return error(
            'OpenRouter’s model list is unavailable. Try refreshing or enter a model ID.',
            502
          );
        const payload = (await response.json()) as {
          data: {
            id: string;
            name: string;
            context_length: number;
            pricing?: unknown;
            architecture?: { output_modalities?: string[] };
            supported_parameters?: string[];
          }[];
        };
        return json({
          models: payload.data
            .filter(
              m =>
                !m.architecture?.output_modalities ||
                m.architecture.output_modalities.includes('text')
            )
            .map(m => ({
              id: m.id,
              name: m.name,
              context: m.context_length,
              pricing: m.pricing,
              supported: m.supported_parameters || [],
            })),
        });
      } catch {
        return error(
          'Could not load OpenRouter models. Check the connection and retry, or enter a model ID.',
          502
        );
      }
    },
  ],
  'POST /api/complete': [
    async ({ body }) => {
      const input = body as Completion;
      if (
        !input ||
        !Array.isArray(input.messages) ||
        !input.messages.length ||
        input.messages.length > 24 ||
        input.messages.some(
          m =>
            !m ||
            !['system', 'user', 'assistant'].includes(m.role) ||
            typeof m.content !== 'string'
        ) ||
        input.messages.reduce((n, m) => n + m.content.length, 0) > 160000
      )
        return error('This task is too large. Shorten it and try again.', 400);
      if (input.demo === true)
        return json({
          text: sample(input),
          model: 'playground/sample',
          usage: null,
          demo: true,
        });
      if (
        typeof input.key !== 'string' ||
        input.key.length < 15 ||
        input.key.length > 512 ||
        /\s/.test(input.key)
      )
        return error('Add a valid OpenRouter key in Settings.', 401);
      if (
        typeof input.model !== 'string' ||
        !/^[a-zA-Z0-9._:/@+-]{1,200}$/.test(input.model)
      )
        return error('Choose an OpenRouter model or enter its model ID.', 400);
      try {
        const response = await fetch(`${ORIGIN}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.key}`,
            'Content-Type': 'application/json',
            'X-Title': 'Distill Pets AI Studio Agent Studio',
          },
          body: JSON.stringify({
            model: input.model,
            messages: input.messages,
            temperature: Number.isFinite(input.temperature) ? Math.max(0,Math.min(1.5,Number(input.temperature))) : 0.7,
            max_tokens: Math.min(
              8000,
              Math.max(256, Math.floor(Number(input.maxTokens) || 2048))
            ),
          }),
          signal: AbortSignal.timeout(55000),
        });
        if (!response.ok) {
          const messages: Record<number, string> = {
            401: 'OpenRouter rejected this key. Check it in Settings.',
            402: 'Your OpenRouter account needs credits for this model.',
            403: 'This model is not available to your OpenRouter account.',
            404: 'This model ID is unavailable. Choose another model.',
            408: 'The provider timed out. Retry or choose a faster model.',
            413: 'This task exceeds the model’s context. Shorten it.',
            429: 'OpenRouter is rate limiting requests. Wait a moment, then retry.',
          };
          return error(
            messages[response.status] ||
              `OpenRouter could not finish this request (${response.status}). Try another model or a shorter task.`,
            response.status >= 500 ? 502 : response.status
          );
        }
        const data = (await response.json()) as {
          error?: unknown;
          model?: string;
          choices?: {
            finish_reason?: string;
            message?: {
              content?: string | { text?: string }[];
              refusal?: string;
            };
          }[];
          usage?: unknown;
        };
        if (data.error)
          return error(
            'The provider returned an error. Retry or choose another model.',
            502
          );
        const choice = data.choices?.[0];
        const content = choice?.message?.content;
        const result =
          typeof content === 'string'
            ? content
            : Array.isArray(content)
              ? content.map(p => p.text || '').join('\n')
              : '';
        if (!result.trim())
          return error(
            choice?.message?.refusal
              ? 'The model declined this task. Rephrase it or choose another model.'
              : 'The model returned no text. Increase the output limit or try another model.',
            502
          );
        return json({
          text: result,
          model: data.model || input.model,
          usage: data.usage || null,
          finishReason: choice?.finish_reason,
          demo: false,
        });
      } catch {
        return error(
          'The request timed out or the connection failed. Retry or choose a faster model.',
          504
        );
      }
    },
  ],
});
