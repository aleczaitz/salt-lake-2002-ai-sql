import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { generateText } from './openai.ts';

export const DEFAULT_QUESTION = 'Which athletes won the most medals at the 2002 Winter Olympics?';
export type PromptStyle = 'zero-shot' | 'few-shot';

export function buildSqlInstructions(style: PromptStyle = 'zero-shot'): string {
  const instructions = readFileSync(join(import.meta.dirname, 'sql_instructions.txt'), 'utf8');
  const schema = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8');
  const database = new DatabaseSync(join(import.meta.dirname, 'olympics.db'), { readOnly: true, allowExtension: false });
  try {
    const eventNames = database.prepare('SELECT name FROM event ORDER BY name;').all().map(row => row.name);
    const base = `${instructions}\nDatabase layout:\n${schema}\nStored event.name values (JSON):\n${JSON.stringify(eventNames)}\n`;
    if (style === 'zero-shot') return base;
    const examples: { question: string; sql: string }[] = JSON.parse(
      readFileSync(join(import.meta.dirname, 'few_shot_examples.json'), 'utf8'),
    );
    return `${base}\nWorked examples from this database:\n${examples.map(example =>
      `Question: ${example.question}\nSQL:\n${example.sql}`).join('\n\n')}`;
  } finally {
    database.close();
  }
}

export async function generateSql(question: string, style: PromptStyle = 'zero-shot'): Promise<string> {
  return generateText(question, buildSqlInstructions(style));
}

if (import.meta.main) {
  try {
    console.log(await generateSql(process.argv.slice(2).join(' ') || DEFAULT_QUESTION));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'SQL generation failed.');
    process.exitCode = 1;
  }
}
