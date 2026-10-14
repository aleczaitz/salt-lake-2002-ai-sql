import assert from 'node:assert/strict';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { generateText } from './openai.ts';

let originalKey: string | undefined;
beforeEach(() => {
  originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-credential-not-a-real-key';
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

it('sends the prompt and reads text after reasoning output', async () => {
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-credential-not-a-real-key');
    const request = JSON.parse(String(options.body));
    assert.equal(request.input, 'Our Olympics question');
    assert.equal(request.store, false);
    assert.equal(request.model, 'gpt-6-luna');
    return Response.json({ status: 'completed', output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: 'SELECT COUNT(*) FROM athlete;' }] },
    ] });
  });
  assert.equal(await generateText('Our Olympics question'), 'SELECT COUNT(*) FROM athlete;');
});

it('rejects missing credentials before making a request', async () => {
  delete process.env.OPENAI_API_KEY;
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  await assert.rejects(generateText('Question'), /Missing OPENAI_API_KEY/);
  assert.equal(fetch.mock.callCount(), 0);
});

it('does not expose API error bodies or network error details', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'sensitive-test-value' }, { status: 401 }));
  await assert.rejects(generateText('Question'), { message: 'OpenAI request failed (HTTP 401).' });
  fetch.mock.mockImplementation(async () => { throw new Error('sensitive-test-value'); });
  await assert.rejects(generateText('Question'), { message: 'OpenAI request failed or timed out.' });
});

it('rejects incomplete, malformed, or empty responses', async () => {
  const fetch = mock.method(globalThis, 'fetch');
  for (const body of [
    { status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: 'SELECT' }] }] },
    { status: 'completed', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] },
    { status: 'completed', output: 'invalid' },
  ]) {
    fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(generateText('Question'));
  }
  fetch.mock.mockImplementation(async () => new Response('not JSON'));
  await assert.rejects(generateText('Question'), /invalid JSON/);
});
