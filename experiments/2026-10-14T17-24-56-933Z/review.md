# Naming fix: before-and-after comparison

After adding the actual event names and clearer matching instructions, both
zero-shot and single-domain few-shot answered **6 of 6 questions correctly** in
the October 14, 2026 follow-up. This includes correctly declining the question
about a match score the database does not store.

| Strategy | Original run | After naming fix |
| --- | ---: | ---: |
| Zero-shot | 5/6 | 6/6 |
| Single-domain few-shot, three examples | 4/6 | 6/6 |

## What changed

The shared prompt builder now reads all 78 `event.name` values from `olympics.db`
using a read-only connection and includes that list in both prompts. It also tells
the model to match a specific event by its exact stored name, preserve the men's,
women's, and mixed distinctions, and escape apostrophes in SQL string literals.
It explicitly notes that `'%men%'` also matches women's events.

These are stored event names, not question-and-SQL demonstrations or medal
answers. Zero-shot still has no worked examples. Few-shot still adds the same
three examples as before. The two changes were applied together, so this run does
not measure the separate effect of the name list versus the matching instructions.

## Reviewed outcomes

| Question | Zero-shot | Few-shot |
| --- | --- | --- |
| How many different athletes represented the United States? | 202 — correct | 202 — correct |
| Which country won the most gold medals, including ties? | Norway, 13 — correct | Norway, 13 — correct |
| How many medals did Canada win in men's ice hockey? | 1 — correct | 1 — correct |
| Which events used more than one venue, and how many? | Five events, two venues each — correct | Five events, two venues each — correct |
| Which countries won gold in pairs figure skating? | Russia and Canada — correct | Canada and Russia — correct |
| What was the score of the men's hockey final? | Correctly declined: scores are absent | Correctly declined: scores are absent |

Both hockey queries now use `e.name = 'Ice Hockey Men''s Ice Hockey'`. They
deduplicate team medals and count one, without including the women's event.
The English answers report one medal; the question asks for the count, so naming
the medal's color is not required.

Both pairs queries use `e.name = 'Figure Skating Mixed Pairs'`, retain both
gold-winning countries, and return each country once. Both multi-venue queries
use the event and event-venue tables without the unnecessary result-table join
seen in the earlier few-shot output. The country gold-medal queries still preserve
individual ties, deduplicate team entries, and select all countries tied for the
highest count.

## Checks and limits

- Type checking and all 35 automated tests passed, including a regression check
  that both prompts contain the complete current event-name catalog and leave the
  database unchanged.
- All 12 live cases completed in 22 API requests, with no API or query execution
  errors. Generated SQL, rows, and English answers were reviewed against the same
  answer key, allowing equivalent aliases and row order.
- The model and settings (`gpt-6-luna`, low reasoning, 2,048 output tokens,
  `store: false`), answer instructions, evaluation questions, teaching examples,
  and database checksum match the original run.
- There was one trial per question and style. The original failures informed this
  fix, so the follow-up demonstrates a regression improvement on these questions,
  not performance on unseen questions or a general accuracy guarantee. No broader
  or repeated-trial evaluation was run.

## Evidence

- [All six questions with both SQL responses, rows, and English answers](results.md)
- [Exact revised prompts, settings, answer-key snapshot, and database checksum](manifest.json)
- [Completion counts and unchanged-database verification](completion.json)
- [Original run and naming failures](../2026-10-14T17-15-45-736Z/review.md)

The original run and all raw JSON observations remain preserved. This review was
added after the follow-up completed.
