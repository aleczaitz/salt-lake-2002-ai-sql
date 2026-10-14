import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { answerQuestion } from './answer_question.ts';

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

it('sends the real query results for an English answer without changing the database', async () => {
  const databasePath = join(import.meta.dirname, 'olympics.db');
  const before = readFileSync(databasePath);
  const answer = 'Janica Kosteli and Ole Einar Bjrndalen tied with 4 medals each.';
  const sql = readFileSync(join(import.meta.dirname, 'first_ai_query.sql'), 'utf8').trim();
  const fetch = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const request = JSON.parse(String(options.body));
    if (request.instructions.includes('Database layout:')) {
      assert.match(request.input, /2002 Winter Olympics/);
      assert.ok(request.instructions.includes(readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')));
      return Response.json({ status: 'completed', output: [
        { type: 'message', content: [{ type: 'output_text', text: sql }] },
      ] });
    }
    const input = JSON.parse(request.input);
    assert.match(input.question, /2002 Winter Olympics/);
    assert.deepEqual(input.rows.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)), [
      { name: 'Janica Kosteli', medal_count: 4 },
      { name: 'Ole Einar Bjrndalen', medal_count: 4 },
    ]);
    assert.match(request.instructions, /using only the supplied database rows/);
    assert.equal(request.store, false);
    assert.ok(!String(options.body).includes('test-credential-not-a-real-key'));
    return Response.json({ status: 'completed', output: [
      { type: 'message', content: [{ type: 'output_text', text: answer }] },
    ] });
  });
  const result = await answerQuestion();
  assert.equal(result.answer, answer);
  assert.equal(result.sql, sql);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(readFileSync(databasePath), before);
});

it('does not execute SQL or request an answer for an unsupported question', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output: [
    { type: 'message', content: [{ type: 'output_text', text: 'UNSUPPORTED: Dates are not stored.' }] },
  ] }));
  const result = await answerQuestion('On what date was the hockey final?');
  assert.equal(result.sql, null);
  assert.match(result.answer, /Dates are not stored/);
  assert.equal(fetch.mock.callCount(), 1);
});

it('rejects unsafe generated SQL without asking the model to explain it', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output: [
    { type: 'message', content: [{ type: 'output_text', text: 'DELETE FROM athlete;' }] },
  ] }));
  await assert.rejects(answerQuestion('Delete the athletes'), /Expected a single SELECT/);
  assert.equal(fetch.mock.callCount(), 1);
});

it('rejects empty or oversized questions before making an API request', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  await assert.rejects(answerQuestion('   '), /Enter a question/);
  await assert.rejects(answerQuestion('a'.repeat(2001)), /Enter a question/);
  assert.equal(fetch.mock.callCount(), 0);
});

it('reports a failed answer request without returning a made-up answer', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  await assert.rejects(answerQuestion(), { message: 'OpenAI request failed (HTTP 503).' });
});
