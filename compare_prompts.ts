import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { SQLOutputValue } from 'node:sqlite';
import { ANSWER_INSTRUCTIONS, explainResults, runQuery } from './answer_question.ts';
import { buildSqlInstructions } from './generate_sql.ts';
import type { PromptStyle } from './generate_sql.ts';
import { generateText, MODEL_SETTINGS } from './openai.ts';

export async function runComparison(outputDir: string) {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Missing OPENAI_API_KEY. Run with --env-file=.env.');
  mkdirSync(outputDir);
  const questions: {
    id: string; question: string; referenceSql: string | null;
    expectedRows: Record<string, SQLOutputValue>[] | null; expectedAnswer: string;
  }[] = JSON.parse(readFileSync(join(import.meta.dirname, 'experiment_questions.json'), 'utf8'));
  const prompts = {
    'zero-shot': buildSqlInstructions('zero-shot'),
    'few-shot': buildSqlInstructions('few-shot'),
  };
  if (!prompts['few-shot'].startsWith(prompts['zero-shot'])) throw new Error('The two prompts must share the same base instructions and schema.');
  const databaseBefore = createHash('sha256').update(readFileSync(join(import.meta.dirname, 'olympics.db'))).digest('hex');
  for (const question of questions) {
    if (question.referenceSql && !isDeepStrictEqual(await runQuery(question.referenceSql), question.expectedRows)) {
      throw new Error(`Reference answer changed for ${question.id}; update the answer key before comparing prompts.`);
    }
  }
  const startedAt = new Date().toISOString();
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({
    startedAt, nodeVersion: process.version, settings: MODEL_SETTINGS,
    databaseSha256: databaseBefore, prompts, answerInstructions: ANSWER_INSTRUCTIONS,
    questions, trialsPerQuestionAndStyle: 1,
  }, null, 2) + '\n', { flag: 'wx' });
  const report = ['# Prompt comparison: observed outputs', '',
    `Started: ${startedAt}. Model: ${MODEL_SETTINGS.model}. One trial per question and style.`,
    'These are raw observations. Correctness requires reviewing the SQL and English answers against the answer key.', ''];
  let completedCases = 0;
  let totalRequests = 0;
  let errors = 0;
  for (const question of questions) {
    // Alternate which style goes first; each request is independent and has no conversation history.
    const styles: PromptStyle[] = completedCases % 4 === 0 ? ['zero-shot', 'few-shot'] : ['few-shot', 'zero-shot'];
    report.push(`## ${question.question}`, '', `Reference answer: ${question.expectedAnswer}`, '');
    for (const style of styles) {
      const caseStartedAt = new Date().toISOString();
      let sqlResponse: string | null = null;
      let rows: Record<string, SQLOutputValue>[] | null = null;
      let answer: string | null = null;
      let error: string | null = null;
      let stage = 'SQL generation';
      let status = 'error';
      let apiRequests = 0;
      console.log(`${completedCases + 1}/${questions.length * 2} ${style}: ${question.question}`);
      try {
        apiRequests++;
        sqlResponse = await generateText(question.question, prompts[style]);
        if (sqlResponse.startsWith('UNSUPPORTED:')) {
          answer = `This database cannot answer that question. ${sqlResponse.slice('UNSUPPORTED:'.length).trim()}`;
          status = 'unsupported';
        } else {
          stage = 'database query';
          rows = await runQuery(sqlResponse);
          stage = 'answer generation';
          apiRequests++;
          answer = await explainResults(question.question, rows);
          status = 'answered';
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : 'Experiment case failed.';
        errors++;
      }
      const record = {
        questionId: question.id, question: question.question, style,
        startedAt: caseStartedAt, finishedAt: new Date().toISOString(),
        status, failedStage: error ? stage : null, apiRequests, sqlResponse, rows, answer, error,
      };
      writeFileSync(join(outputDir, `${style}-${question.id}.json`), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
      report.push(`### ${style}`, '', `Status: ${status}`, '', 'SQL-stage response:', '',
        '````text', sqlResponse ?? '(no response)', '````', '', 'Database rows:', '',
        '````json', JSON.stringify(rows, null, 2), '````', '',
        `Answer: ${answer ?? '(none)'}`, ...(error ? ['', `Error during ${stage}: ${error}`] : []), '');
      totalRequests += apiRequests;
      completedCases++;
      console.log(`  Saved ${status}${error ? `: ${error}` : ''}`);
    }
  }
  const databaseAfter = createHash('sha256').update(readFileSync(join(import.meta.dirname, 'olympics.db'))).digest('hex');
  const completion = {
    finishedAt: new Date().toISOString(), completedCases, totalRequests, errors,
    databaseSha256: databaseAfter, databaseUnchanged: databaseAfter === databaseBefore,
  };
  writeFileSync(join(outputDir, 'completion.json'), JSON.stringify(completion, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(join(outputDir, 'results.md'), report.join('\n') + '\n', { flag: 'wx' });
  if (!completion.databaseUnchanged) throw new Error('The database changed during the comparison; do not treat this as a controlled comparison.');
  console.log(`Saved ${completedCases} cases (${totalRequests} API requests) in ${outputDir}`);
}

if (import.meta.main) {
  try {
    const root = join(import.meta.dirname, 'experiments');
    mkdirSync(root, { recursive: true });
    await runComparison(join(root, new Date().toISOString().replace(/[:.]/g, '-')));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Prompt comparison failed.');
    process.exitCode = 1;
  }
}
