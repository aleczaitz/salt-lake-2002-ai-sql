import { createInterface } from 'node:readline';
import { answerQuestion } from './answer_question.ts';

const terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: 'Your question: ' });
let closed = false;
terminal.on('close', () => { closed = true; });
terminal.on('SIGINT', () => process.exit(0));
console.log('Salt Lake 2002 Olympics\nAsk a complete question each time. Type exit to quit.\n');
terminal.prompt();
try {
  for await (const line of terminal) {
    const question = line.trim();
    if (/^(exit|quit)$/i.test(question)) break;
    if (question) {
      console.log('Thinking...');
      try {
        const result = await answerQuestion(question);
        if (result.sql) console.log(`\nSQL:\n${result.sql}`);
        console.log(`\n${result.answer}`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Could not answer that question.');
      }
    }
    console.log();
    if (!closed) terminal.prompt();
  }
} finally {
  terminal.close();
}
