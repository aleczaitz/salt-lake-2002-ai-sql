# Salt Lake 2002: AI + SQL project

Explore the athletes, countries, medals, and venues of the Salt Lake 2002 Winter Olympics.
The SQLite database now includes all 2002 Winter results from the chosen historical
dataset, across six tables. The TypeScript terminal app turns your question into
SQL, runs it read-only against the database, and asks AI to explain the results.

Node.js provides SQLite access and runs the TypeScript files directly. TypeScript
and Node type definitions provide type checking. `csv-parse` is a development
dependency used only to regenerate the data, so quoted names and commas are read
correctly. Building the database from the included SQL needs no API key or network.

## Run

Use Node.js 24.12 or newer (tested with 26.4). From this project directory:

```sh
npm ci
npm run typecheck
npm test
npm run build-full-db
sqlite3 -header -column olympics.db < medal_counts.sql
```

The build creates `olympics.db` beside the script and refuses to replace an existing
file. If it already exists, use the last command to run the query again. The command
prints the first ten athletes, breaking equal medal counts alphabetically.

The original sample remains available: `npm run build-db` creates
`olympics_sample.db` with the same overwrite protection.

## Ask questions in the terminal

With `olympics.db` built and your API key saved in `.env`, run:

```sh
npm start
```

Type a complete question at `Your question:` and press Enter. The app shows the
generated SQL and the answer, then accepts another question. Type `exit` or `quit`,
or press Ctrl+C, to stop. Each question is independent; it does not remember earlier
questions. Examples:

- Which athletes won the most medals?
- How many athletes are in the database?
- Which venues hosted men's ice hockey?
- Which country won the most medals?
- Which country won the most gold medals?
- How many athletes represented the United States?

Each supported question makes two billable API requests: one receives the schema,
stored event names, rules, and question; the second receives the question and query results. The
database file and API key are never placed in either prompt. An unsupported
question returns an explanation after the first request. Errors are shown without
closing the interface. There are no automatic retries.

Queries run in a separate process with a two-second limit. SQLite opens the
database read-only; its authorizer permits reads of our six tables and approved
SQL functions, while denying writes, attachments, metadata access, and extensions.
Extra statements are rejected. Results over 100 rows or 30,000 characters are
rejected rather than silently shortened; ask for a smaller group or a summary.

## Full data and sources

| Table | Rows |
| --- | ---: |
| athlete | 2,399 |
| event | 78 |
| country | 77 |
| venue | 10 |
| result | 4,109 |
| event_venue | 83 |

There are 478 athlete-medal records. Team members each have their own result, so
this is an athlete medal count, not a count of medals in a national medal table.
The five extra venue links come from two hockey tournaments and three Nordic
combined events, which each used two venues.

Results come from [Randi Griffin's Olympic history dataset](https://github.com/rgriff23/Olympic_history),
compiled from Sports-Reference. `import_data.ts` selects only `2002 Winter` from
the [pinned source CSV](https://raw.githubusercontent.com/rgriff23/Olympic_history/b14dd25bf2b63c562fc7771c70439d005696ea4c/data/athlete_events.csv).
It retains source athlete IDs, names, event names, NOC country codes, team entry
labels, and medal values, converting
`NA` medals to SQL `NULL`. It checks the download's SHA-256 checksum and validates
the generated SQL before saving `full_data.sql`.

To regenerate the included SQL, run `npm run import-data`. This downloads about
41 MB and replaces `full_data.sql` after validation; it does not modify either
database. The normal build uses the saved SQL without downloading anything.

Country names come from the source `Team` labels with numbered entry suffixes
removed (for example, `Germany-1` becomes `Germany`). These are Olympic delegation
labels, not citizenship or modern ISO country names. Historical source labels
are retained, including `SCG` / `Serbia and Montenegro`. Each result links to its
represented country; names are stored once in `country`.

Country medal totals count one medal per team entry, while keeping each medal in
individual events, including ties. `event.is_team_event` identifies the 18 team,
pair, doubles, and relay events; `result.team` preserves the original entry label
so separate teams from the same country stay distinct. This avoids counting every
hockey player as a separate country medal or collapsing the two Norwegian gold
medalists in the same individual pursuit event. The included query is:

```sh
sqlite3 -header -column olympics.db < country_medal_counts.sql
```

It returns Germany with 36 total medals, the United States with 34, and Norway
with 25 (including 13 golds), matching
[Olympedia's medal table](https://www.olympedia.org/editions/47).
Live AI checks on October 14, 2026 also generated correct SQL and answers for
“Which country won the most medals?” (Germany, 36) and “Which country won the most
gold medals?” (Norway, 13). Both queries handled team entries and individual ties.

Both local database files were upgraded after checking that every existing
athlete, event, venue, result, and venue link was preserved. Their previous
versions are saved as `olympics.before-countries.db` and
`olympics_sample.before-countries.db`; those backups use the old schema.

Venue mappings use [Olympedia's competition venues](https://www.olympedia.org/venues/editions/47).
The stadium used for ceremonies is excluded. Two source details needed clarification:

- [FIS's 2002 alpine event records](https://www.fis-ski.com/DB/general/event-details.html?eventid=8479&sectorcode=AL)
  place slalom at Deer Valley and giant slalom at Park City Mountain Resort.
  Some Olympedia venue listings reverse these; we follow FIS and the
  [official report's Park City venue page](https://digital.la84.org/digital/collection/p17103coll8/id/41762/rec/82).
- E Center's location is West Valley City, following the
  [city's historical timeline](https://www.wvc-ut.gov/our_community/about_us/history_of_west_valley_city/timeline.php),
  rather than the broader Salt Lake City label used by Olympedia.

The query returns Janica Kostelić and Ole Einar Bjørndalen tied with four medals,
consistent with [Olympedia's Games overview](https://www.olympedia.org/editions/47).
The CSV spells their names `Janica Kosteli` and `Ole Einar Bjrndalen`; original
spellings are retained in the database. Jochem Simon Uytdehaage now has all three
of his medals.

The import has been checked for counts, duplicate records, valid links, the medal
leaders, multi-venue events, and the shared gold medals in pairs figure skating.
Individual rows have not all been independently audited. The source sometimes
omits accented letters or uses full names and aliases. `NULL` only means no medal;
this schema does not distinguish disqualification, withdrawal, or finishing place.
Dates, scores, and individual hockey matches are outside the current schema.

## Design

Table names are singular throughout the schema, SQL, importer, and AI prompts.
Both working databases were renamed in place with every row and foreign key
checked. Pre-rename copies are saved as `olympics.before-singular.db` and
`olympics_sample.before-singular.db`.

- `athlete`: one athlete; names are not required to be unique.
- `event`: one medal competition, with a flag distinguishing team and individual events.
- `country`: one Olympic delegation, identified by the source's three-letter code.
- `venue`: one competition site. `location` can describe a city or a park.
- `result`: one athlete's outcome per medal event, including the country represented
  and source team entry label. `NULL` means no medal.
- `event_venue`: one event-venue connection; an event can use several venues.

Both linking tables use the pair of IDs as their primary key to prevent duplicate
connections. Foreign keys require the linked records to exist. SQLite connections
must enable `PRAGMA foreign_keys = ON`; the builder and tests do this.

Event-venue links identify sites used by the overall competition. They do not record
individual matches, each athlete's presence at each site, or where a medal was awarded.
Counting medals after joining all venues can count a result twice, so the overall
medal-count query uses only `athlete` and `result`.

## Sample data and sources

This is a manually transcribed sample of 9 athletes, 3 events, 3 venues, and 10 results.
It includes six countries and these podiums plus Ronny Ackermann's non-medal Nordic combined result:

- [Men's 5,000 m speed skating](https://www.olympedia.org/results/1113)
- [Men's 10,000 m speed skating](https://www.olympedia.org/results/1114)
- [Men's individual Nordic combined](https://www.olympedia.org/results/2321)

Each event page identifies its venue(s). Venue location labels also follow
[Utah Olympic Park](https://www.olympedia.org/venues/129) and
[Soldier Hollow](https://www.olympedia.org/venues/128).

The sample query returns Jochem Uytdehaage first with 2 medals **among the included
results only**. These are not complete athlete totals or a ranking for the whole Games.
Even the three selected events have competitors whose results are not included yet.

## First AI prompt

`prompt_zero_shot.txt` is our first complete prompt draft for “Which athletes won
the most medals?” It includes the original five-table schema and rules for interpreting the
data, with no worked question-and-SQL examples. That makes it a zero-shot prompt
under the [assigned paper's terminology](https://arxiv.org/html/2305.11853v3#S2).

The prompt asks for one read-only SQL query, all athletes tied for first, and a
clear unsupported response when the question needs data we do not store. The
schema is copied into this standalone draft for review. It remains a record of
our first experiment. The running app now reads `sql_instructions.txt` and the
current `schema.sql` directly, keeping instructions separate from the user question.
It also reads all 78 `event.name` values from `olympics.db` through a read-only
connection. Both prompting styles receive this list and instructions to use exact
names for specific events, distinguishing men's, women's, and mixed events.
The archived prompt draft and first saved query have also had their table names
changed to singular; their original experiment content is otherwise retained.

### Generate SQL

Save your API key in the local `.env` file as `OPENAI_API_KEY=your-key`, then run:

```sh
npm run generate-sql
```

The `.env` file is ignored by Git. `generate_sql.ts` sends the prompt to OpenAI's
Responses API using `gpt-6-luna`, low reasoning effort, a 2,048-token output limit,
and `store: false`. It prints the returned SQL; it does not execute it. The prompt
includes the schema, stored event names, interpretation rules, and question. The
database file and athlete/result rows are not included in this SQL-generation
request. SQL generation now requires `olympics.db` to read the event-name list.
Each run makes a billable API request and may produce different
SQL. Tests mock the API and make no billable requests.

### First live result

On October 14, 2026, the zero-shot prompt produced `first_ai_query.sql`. We reviewed
the SQL and executed it using a read-only SQLite connection. It returned:

| Athlete (source spelling) | Medals |
| --- | ---: |
| Janica Kosteli | 4 |
| Ole Einar Bjrndalen | 4 |

The query counts non-NULL medals per athlete, ranks the totals, and includes
everyone ranked first. Both names and counts match the known database results.
The database checksum was unchanged after execution. To rerun this saved query
without making another API request:

```sh
sqlite3 -readonly -header -column olympics.db < first_ai_query.sql
```

Type checking and all 35 automated tests pass, including the live event-name catalog, terminal prompt redraws, the terminal loop,
API failures, query permission checks, result limits, and query timeout. These
checks do not establish general AI accuracy. Database permissions are enforced
by code, independently of the prompt's read-only instruction.

### Turn the results into an answer

```sh
npm run answer
npm run answer -- "Which venues hosted men's ice hockey?"
```

`answer_question.ts` now generates fresh SQL for the supplied question, runs it
against `olympics.db` through the restricted query worker, and sends the returned
rows to OpenAI for a short answer. Without an argument, it asks our original
medal-leaders question. This makes two billable requests using the same model
and settings. `openai.ts` contains the shared API connection and response/error
handling. Tests mock that connection.

The answer instructions require the model to use only the supplied rows, include
ties, retain source spellings, and report when there are no results. This keeps
the database as the source of facts; model accuracy still needs checking.

The first live answer on October 14, 2026 was:

> Ole Einar Bjrndalen and Janica Kosteli tied for the most medals, with 4 each.

Both names, counts, and the tie match the query results. The missing accented
letters come from the source dataset, as described above.

The interactive terminal uses this same flow for each question and still defaults
to zero-shot. A separate comparison now tests zero-shot against Olympics teaching
examples, as documented below. The [schema picture](schema.webp), [class-post draft](CLASS_POST.md),
and [six additional examples](EXAMPLES.md) are included; posting and individual submission remain separate steps.

The first live terminal session on October 14, 2026 answered two questions in a
row and then exited normally. It returned both four-medal leaders, then E Center
and The Peaks Ice Arena for men's hockey, matching the stored data. One detail
to improve during prompt experiments: its hockey query used a name pattern that
also matches the women's event. Both events use the same venues here, so the
answer was correct despite that overly broad filter. The app enforces query
permissions, but does not automatically verify the meaning of generated SQL.

## Prompt comparison

The six questions below were selected before adding the few-shot teaching examples.
Their reference answers were checked against the current `olympics.db` on October
14, 2026, using the app's read-only query worker for the five supported questions.
These are the answer keys. Actual AI responses and the reviewed comparison are
linked below.

| Test question | Expected answer from our database | What it checks |
| --- | --- | --- |
| How many different athletes represented the United States? | 202 athletes | Count each athlete once, rather than all 313 participation records. |
| Which country won the most gold medals, and how many? Include all ties. | Norway, 13 gold medals | Count team medals once, preserve individual ties, and rank by golds. |
| How many medals did Canada win in men's ice hockey? | One gold medal | Count the team once instead of its 22 players; exclude the women's event. |
| Which medal events used more than one venue, and how many venues did each use? | Five events, two venues each | Group event-venue links without multiplying them by athlete results. |
| Which countries won gold in pairs figure skating? | Canada and Russia | Include both gold-winning countries, without repeating each pair's athletes. |
| What was the score of the men's ice hockey final? | Unsupported: matches and scores are not stored | Recognize missing data instead of guessing. |

The five events in the venue question are men's and women's ice hockey, and men's
individual, sprint, and team Nordic combined.

[`experiment_questions.json`](experiment_questions.json) contains the exact
questions, reference SQL, expected rows, and review notes. The reference SQL and
expected answers are for checking outputs; do not include them in the prompts for
these test questions.

`few_shot_examples.json` adds three separate Olympics question-and-SQL examples:
German medalists, Finnish bronze medals, and the men's Nordic combined sprint
venues. This is single-domain few-shot prompting because the examples use our
own database. Zero-shot has no worked examples. Both styles share the same model,
schema, event-name catalog, interpretation rules, query restrictions, and
answer-generation prompt. The original run below predates the event-name catalog;
the later naming-fix run includes it in both styles.

To repeat the comparison with your configured API key:

```sh
npm run compare-prompts
```

Each run creates a new dated directory under `experiments/`, checks the reference
answers before making requests, saves the exact prompts and settings, and records
each case as it finishes. Failed SQL and failed answer requests retain the SQL
and any available rows. Existing run directories are never overwritten. Each run
uses at most 24 API requests; the first used 22 because both score questions were
correctly rejected after one request. These are billable requests; the automated
tests use mocked API responses.

The first comparison completed on October 14, 2026:

| Strategy | Correct out of six |
| --- | ---: |
| Zero-shot | 5 |
| Single-domain few-shot, three examples | 4 |

Both styles missed the men's hockey medal question: zero-shot also selected
women's hockey and answered 2; few-shot used a nonexistent event name and answered
0. The correct answer is 1. Few-shot also used the wrong stored name for pairs
figure skating and returned no results. The demonstrations did not improve the
scores in this run. All SQL queries executed, so these were meaning errors rather
than database-permission failures.

Read the [review and explanation of each failure](experiments/2026-10-14T17-15-45-736Z/review.md)
and the [six examples with both SQL queries, rows, and answers](experiments/2026-10-14T17-15-45-736Z/results.md).
The run's manifest preserves its answer key, full prompts, and settings. The
database checksum was unchanged. Review both SQL meaning and English answers;
different SQL wording, column aliases, or row order can still be correct.

### Naming fix and follow-up

The shared prompt now includes all 78 stored event names and tells the model to
use exact names for specific events. It explicitly warns that `'%men%'` also
matches women's events. Both styles receive these additions; the three teaching
examples and six test questions stayed the same.

| Strategy | Original run | After naming fix |
| --- | ---: | ---: |
| Zero-shot | 5/6 | 6/6 |
| Single-domain few-shot | 4/6 | 6/6 |

In the follow-up, both hockey queries selected the exact men's event and returned
one medal. Both pairs figure-skating queries used the stored event name and
returned Canada and Russia. All other answers remained correct. The live run
used 22 API requests and left the database unchanged.

See the [before-and-after review](experiments/2026-10-14T17-24-56-933Z/review.md)
and [full follow-up outputs](experiments/2026-10-14T17-24-56-933Z/results.md).
The original run is preserved. This follow-up used one trial per question and
style after inspecting the earlier failures; it does not establish general
accuracy on new questions or isolate the effect of the catalog from the new rule.

A correct refusal on the score question counts as a success. Some of these
questions had been discussed already, and each style ran only once per question,
so this is a small classroom comparison rather than a general accuracy benchmark.
The six completed experiment records supply the additional examples requested by
the assignment; the review also identifies working and failing cases.
