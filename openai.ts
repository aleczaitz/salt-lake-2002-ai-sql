export const MODEL_SETTINGS = {
  model: 'gpt-6-luna',
  reasoning: { effort: 'low' },
  max_output_tokens: 2048,
  store: false,
} as const;

export async function generateText(prompt: string, instructions?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error('Missing OPENAI_API_KEY. Run with --env-file=.env.');

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...MODEL_SETTINGS,
        input: prompt,
        instructions,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('OpenAI request failed or timed out.');
  }
  // Error response bodies can echo credentials, so report only the status.
  if (!response.ok) throw new Error(`OpenAI request failed (HTTP ${response.status}).`);

  const body = await response.json().catch(() => {
    throw new Error('OpenAI returned invalid JSON.');
  });
  if (body?.status !== 'completed' || !Array.isArray(body.output)) {
    throw new Error('OpenAI did not complete the response. No text was accepted.');
  }
  const texts: string[] = [];
  for (const item of body.output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') texts.push(part.text);
    }
  }
  const text = texts.join('\n').trim();
  if (!text) throw new Error('OpenAI returned no text.');
  return text;
}
