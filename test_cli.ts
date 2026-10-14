import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';

it('retains the question label when backspace redraws a terminal input line', () => {
  const setup = `
    Object.defineProperty(process.stdout, 'isTTY', { value: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: true });
    Object.defineProperty(process.stdout, 'columns', { value: 80 });
  `;
  const child = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(setup)}`, join(import.meta.dirname, 'cli.ts')], {
    input: 'exiz\x7ft\n', encoding: 'utf8', timeout: 5000,
    env: { ...process.env, TERM: 'xterm-256color' },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  assert.match(child.stdout, /\x1b\[0JYour question: exi/);
  assert.doesNotMatch(child.stdout, /\x1b\[0J> exi/);
});

it('accepts repeated questions, recovers after errors, skips blanks, and exits', () => {
  const folder = mkdtempSync(join(tmpdir(), 'olympics-cli-'));
  try {
    const setup = join(folder, 'mock-api.mjs');
    writeFileSync(setup, `globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.input === 'fail') throw new Error('network problem');
      let text;
      if (body.instructions.includes('Database layout:')) {
        if (body.input !== 'How many athletes?') throw new Error('Unexpected question');
        text = 'SELECT COUNT(*) AS n FROM athlete;';
      } else {
        const input = JSON.parse(body.input);
        if (input.rows[0].n !== 2399) throw new Error('Wrong rows');
        text = 'The database includes 2,399 athletes.';
      }
      return Response.json({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text}]}]});
    };`);
    const child = spawnSync(process.execPath, ['--import', setup, join(import.meta.dirname, 'cli.ts')], {
      input: '\nfail\nHow many athletes?\nHow many athletes?\nexit\nignored\n',
      encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, OPENAI_API_KEY: 'test-key' },
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stderr, /request failed or timed out/);
    assert.equal(child.stdout.match(/The database includes 2,399 athletes\./g)?.length, 2);
    assert.match(child.stdout, /SQL:/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
