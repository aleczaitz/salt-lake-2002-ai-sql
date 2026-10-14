# Salt Lake 2002: AI + SQL

Ask plain-English questions about the 2002 Winter Olympics. TypeScript sends the question and schema to OpenAI, runs the generated SQL against a local SQLite database, then returns a short answer.

[Class post](CLASS_POST.md) · [Six additional examples](EXAMPLES.md) · [Prompt comparison](experiments/2026-10-14T17-24-56-933Z/review.md) · [Data sources and project notes](PROJECT_NOTES.md)

## Run

Requires Node.js 24.12+ and your own OpenAI API key. Tested with Node.js 26.4.

```sh
git clone https://github.com/aleczaitz/salt-lake-2002-ai-sql.git
cd salt-lake-2002-ai-sql
npm ci
cp .env.example .env
```

Add your key after `OPENAI_API_KEY=` in `.env`, then:

```sh
npm start
```

Try “Which athletes won the most medals?” or “How many medals did China win?” Type `exit` to quit. Questions are independent; the app does not remember previous questions.

`olympics.db` is included. Each supported question makes two billable API requests using `gpt-6-luna`: SQL generation, then an explanation of the returned rows. The API key stays in the ignored `.env` file.

## Schema

![Six-table Olympics schema](schema.webp)

Six tables: `athlete`, `event`, `country`, `venue`, `result`, and `event_venue`.
The database contains 2,399 athletes, 78 events, 77 countries, and 4,109 results.
An event means a whole medal competition; country medals count each team once.

The diagram uses DrawSQL's type labels. [SQLite's actual schema](schema.sql) uses `INTEGER` for IDs and 0/1 flags, and nullable `TEXT` restricted to Gold/Silver/Bronze for medals. Both linking tables use their two IDs together as a primary key.

## Prompting results

| Style | Original | With event names and clearer matching rules |
| --- | --- | --- |
| Zero-shot | 5/6 | 6/6 |
| Few-shot, three Olympics examples | 4/6 | 6/6 |

One trial per question and style; these results do not establish general accuracy. The original failures and exact responses are preserved in [experiments](experiments).

## Checks

```sh
npm run typecheck
npm test
```

All 35 automated tests pass. Tests mock OpenAI and make no billable requests. Queries run read-only with table/function restrictions, one-statement validation, result limits, and a two-second timeout.

To repeat the live comparison: `npm run compare-prompts` (up to 24 API requests).
To recreate a missing database: `npm run build-full-db` (refuses to overwrite an existing file).

Results come from [Randi Griffin's Olympic history dataset](https://github.com/rgriff23/Olympic_history), with venue references and limitations documented in [project notes](PROJECT_NOTES.md). Scores, dates, individual matches, and finishing places are not stored.
