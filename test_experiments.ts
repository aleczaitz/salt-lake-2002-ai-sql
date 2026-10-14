import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { runQuery } from './answer_question.ts';
import { runComparison } from './compare_prompts.ts';
import { buildSqlInstructions, generateSql } from './generate_sql.ts';

const questions = JSON.parse(readFileSync(join(import.meta.dirname, 'experiment_questions.json'), 'utf8'));
const examples: { question: string; sql: string }[] = JSON.parse(readFileSync(join(import.meta.dirname, 'few_shot_examples.json'), 'utf8'));
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

it('uses separate, executable teaching examples with correct database results', async () => {
  const expected = [[{ medalist_count: 47 }], [{ bronze_medals: 1 }], [{ venue: 'Soldier Hollow' }, { venue: 'Utah Olympic Park' }]];
  assert.equal(examples.length, expected.length);
  for (const [index, example] of examples.entries()) {
    assert.ok(!questions.some((q: { question: string }) => q.question === example.question));
    assert.deepEqual(await runQuery(example.sql), expected[index]);
  }
});

it('keeps zero-shot as the default and adds examples only to few-shot requests', async () => {
  const requests: { input: string; instructions: string }[] = [];
  mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'SELECT 1;' }] }] });
  });
  await generateSql('A new question');
  await generateSql('A new question', 'few-shot');
  assert.equal(requests[0]!.instructions, buildSqlInstructions());
  assert.equal(requests[1]!.instructions, buildSqlInstructions('few-shot'));
  assert.ok(requests[1]!.instructions.startsWith(requests[0]!.instructions));
  for (const example of examples) {
    assert.ok(!requests[0]!.instructions.includes(example.question));
    assert.ok(requests[1]!.instructions.includes(example.question));
    assert.ok(requests[1]!.instructions.includes(example.sql));
  }
});

it('gives both styles the complete live event-name catalog without changing the database', async () => {
  const before = readFileSync(join(import.meta.dirname, 'olympics.db'));
  const names = (await runQuery('SELECT name FROM event ORDER BY name;')).map(row => row.name);
  assert.equal(names.length, 78);
  for (const style of ['zero-shot', 'few-shot'] as const) {
    const instructions = buildSqlInstructions(style);
    const catalog = instructions.match(/Stored event\.name values \(JSON\):\n([^\n]+)/);
    assert.ok(catalog, 'The prompt must include actual stored event names.');
    assert.deepEqual(JSON.parse(catalog[1]!), names);
    assert.ok(names.includes("Ice Hockey Men's Ice Hockey"));
    assert.ok(names.includes("Ice Hockey Women's Ice Hockey"));
    assert.ok(names.includes('Figure Skating Mixed Pairs'));
    assert.match(instructions, /match the exact stored name/);
    assert.match(instructions, /'%men%' also matches women's events/);
  }
  assert.deepEqual(readFileSync(join(import.meta.dirname, 'olympics.db')), before);
});

it('saves both styles and preserves SQL and rows after failures without leaking the answer key or credential', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'olympics-comparison-'));
  const outputDir = join(folder, 'run');
  const before = readFileSync(join(import.meta.dirname, 'olympics.db'));
  let lastStyle = '';
  const respond = (text: string) => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
  const fetch = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const request = JSON.parse(String(options.body));
    assert.ok(!String(options.body).includes('test-credential-not-a-real-key'));
    if (request.instructions.includes('Database layout:')) {
      lastStyle = request.instructions.includes('Worked examples from this database:') ? 'few-shot' : 'zero-shot';
      assert.equal(request.instructions, buildSqlInstructions(lastStyle as 'zero-shot' | 'few-shot'));
      for (const question of questions) {
        assert.ok(!request.instructions.includes(question.question));
        assert.ok(!request.instructions.includes(question.expectedAnswer));
      }
      const question = questions.find((q: { question: string }) => q.question === request.input);
      assert.ok(question);
      if (lastStyle === 'zero-shot' && question.id === 'canada-mens-hockey') return respond('DELETE FROM athlete;');
      return respond(question.referenceSql ?? 'UNSUPPORTED: Match scores are not stored.');
    }
    const input = JSON.parse(request.input);
    assert.deepEqual(Object.keys(input).sort(), ['question', 'rows']);
    const question = questions.find((q: { question: string }) => q.question === input.question);
    assert.deepEqual(input.rows, question.expectedRows);
    if (lastStyle === 'few-shot' && question.id === 'pairs-gold-tie') return Response.json({}, { status: 503 });
    return respond(question.expectedAnswer);
  });
  try {
    await runComparison(outputDir);
    const read = (name: string) => JSON.parse(readFileSync(join(outputDir, name), 'utf8'));
    const rejected = read('zero-shot-canada-mens-hockey.json');
    assert.equal(rejected.sqlResponse, 'DELETE FROM athlete;');
    assert.equal(rejected.failedStage, 'database query');
    assert.equal(rejected.rows, null);
    assert.equal(rejected.apiRequests, 1);
    const answerError = read('few-shot-pairs-gold-tie.json');
    assert.equal(answerError.failedStage, 'answer generation');
    assert.deepEqual(answerError.rows, [{ country: 'Canada' }, { country: 'Russia' }]);
    assert.match(answerError.sqlResponse, /SELECT DISTINCT/);
    assert.equal(answerError.answer, null);
    for (const style of ['zero-shot', 'few-shot']) {
      const unsupported = read(`${style}-unsupported-final-score.json`);
      assert.equal(unsupported.status, 'unsupported');
      assert.equal(unsupported.apiRequests, 1);
      assert.equal(unsupported.rows, null);
    }
    const completion = read('completion.json');
    assert.equal(completion.completedCases, 12);
    assert.equal(completion.errors, 2);
    assert.equal(completion.totalRequests, 21);
    assert.equal(completion.databaseUnchanged, true);
    assert.equal(fetch.mock.callCount(), 21);
    assert.deepEqual(readFileSync(join(import.meta.dirname, 'olympics.db')), before);
    for (const name of readdirSync(outputDir)) {
      assert.ok(!readFileSync(join(outputDir, name), 'utf8').includes('test-credential-not-a-real-key'));
    }
    const manifest = readFileSync(join(outputDir, 'manifest.json'));
    await assert.rejects(runComparison(outputDir), { code: 'EEXIST' });
    assert.deepEqual(readFileSync(join(outputDir, 'manifest.json')), manifest);
    assert.equal(fetch.mock.callCount(), 21);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
