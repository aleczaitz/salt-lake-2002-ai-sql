# Zero-shot versus single-domain few-shot: reviewed results

Both prompting styles were run on the same six questions on October 14, 2026.
Zero-shot got **5 of 6 correct**; few-shot got **4 of 6 correct**. These totals
include correctly declining the question about a score the database does not store.
For the five answerable questions alone, the scores were 4/5 and 3/5.

| Question | Expected | Zero-shot | Few-shot |
| --- | --- | --- | --- |
| Different U.S. athletes | 202 | 202 — correct | 202 — correct |
| Country with most gold medals, including ties | Norway, 13 | Norway, 13 — correct | Norway, 13 — correct |
| Canada's medals in men's ice hockey | 1 gold | 2 — incorrect | 0 — incorrect |
| Events using multiple venues | Five events, two venues each | All five and their counts — correct | All five and their counts — correct |
| Countries winning pairs figure-skating gold | Canada and Russia | Russia and Canada — correct | No results — incorrect |
| Men's hockey final score | Unsupported: scores are absent | Correctly declined | Correctly declined |

## How the comparison was run

- Model: `gpt-6-luna`, low reasoning, maximum 2,048 output tokens per request,
  and `store: false` for both styles.
- Zero-shot received the existing instructions and six-table schema. Few-shot
  received exactly that same text plus three question-and-SQL demonstrations from
  this Olympics database. This is the paper's
  [single-domain few-shot setting](https://arxiv.org/html/2305.11853v3#S2).
- The teaching examples covered German medalists, Finnish bronze medals, and the
  venues for the men's Nordic combined sprint. Their SQL was checked locally;
  none was an exact evaluation question. The six test questions were selected
  before the examples were added.
- Each question was independent. There was one trial per style, with the style
  that ran first alternating between questions. Prompts were not changed and
  failures were not retried during this run.
- Both styles used the same read-only query worker and identical instructions
  for turning database rows into English. The answer key was never sent to the
  model. A refusal stopped after the SQL-generation request.
- All 12 cases completed with 22 API requests. There were no API or database
  execution errors, and the database checksum was unchanged. Successful execution
  did not guarantee a correct answer.
- The SQL, returned rows, and English answers were reviewed against the frozen
  answer key. Column aliases and row order were allowed to differ when meaning
  was unchanged.

## What went wrong

**Zero-shot men's hockey: 2 instead of 1.** Its filter used
`lower(e.name) LIKE '%men%'`. The word `women` also contains `men`, so it selected
both hockey events. Canada won a team gold in each, which produced a plausible
but incorrect answer to the men's-only question. Its team deduplication avoided
counting players separately, but the event selection was wrong.

**Few-shot men's hockey: 0 instead of 1.** It used
`e.name = 'Ice Hockey Men'`, while the stored name is
`Ice Hockey Men's Ice Hockey`. No event matched, and the aggregate returned zero.
The English-answer stage faithfully repeated that incorrect query result.

**Few-shot pairs figure skating: no results instead of two countries.** It used
`e.name = 'Figure Skating Pairs'`, while the stored name is
`Figure Skating Mixed Pairs`. The SQL returned no rows, and the English stage
reported that no results were returned. Zero-shot's broader filter for
`Figure Skating` and `Pairs` correctly returned Russia and Canada in this dataset.

For the multi-venue question, few-shot added an unnecessary join to `result` and
filtered for medals. It still returned the correct five events and counts because
it used `COUNT(DISTINCT ev.venue_id)`, and those events all have medal records.
Zero-shot used only the two tables needed for this question.

## What this shows

The three demonstrations did not improve accuracy in this run. Both styles
handled distinct athlete counts and country gold-medal counting correctly, but
schema definitions alone did not tell the model the exact event names stored in
the data. The few-shot outputs used incorrect exact names for two test questions.
That is an observed difference; this single run does not establish that adding
examples caused it or that zero-shot is generally better.

A useful next experiment would give both styles the actual event names and test
whether that reduces name-matching errors. That follow-up has not been run.
These six questions, one trial per style, and prompts already informed by earlier
debugging form a small classroom comparison, not a general accuracy benchmark.

## Evidence

- [All six questions, both generated SQL responses, rows, and English answers](results.md)
- [Exact prompt text, model settings, database checksum, and answer-key snapshot](manifest.json)
- [Completion counts and unchanged-database verification](completion.json)
- [Teaching examples](../../few_shot_examples.json)
- [Original test questions and reference SQL](../../experiment_questions.json)

The individual `zero-shot-*.json` and `few-shot-*.json` files retain each observed
case. This review was added after the run; those raw records were not edited.
