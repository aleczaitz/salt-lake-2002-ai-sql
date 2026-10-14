# Prompt comparison: observed outputs

Started: 2026-10-14T17:15:46.078Z. Model: gpt-6-luna. One trial per question and style.
These are raw observations. Correctness requires reviewing the SQL and English answers against the answer key.

## How many different athletes represented the United States?

Reference answer: 202 athletes represented the United States.

### zero-shot

Status: answered

SQL-stage response:

````text
SELECT COUNT(DISTINCT r.athlete_id)
FROM result AS r
JOIN country AS c ON c.country_code = r.country_code
WHERE c.name = 'United States';
````

Database rows:

````json
[
  {
    "COUNT(DISTINCT r.athlete_id)": 202
  }
]
````

Answer: 202 different athletes represented the United States.

### few-shot

Status: answered

SQL-stage response:

````text
SELECT COUNT(DISTINCT r.athlete_id) AS athlete_count
FROM result AS r
JOIN country AS c ON c.country_code = r.country_code
WHERE c.name = 'United States';
````

Database rows:

````json
[
  {
    "athlete_count": 202
  }
]
````

Answer: 202 different athletes represented the United States.

## Which country won the most gold medals, and how many? Include all ties.

Reference answer: Norway won the most gold medals, with 13.

### few-shot

Status: answered

SQL-stage response:

````text
WITH gold_awards AS (
    SELECT DISTINCT
        r.country_code,
        r.event_id,
        r.medal,
        CASE
            WHEN e.is_team_event = 1 THEN r.team
            ELSE CAST(r.athlete_id AS TEXT)
        END AS entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal = 'Gold'
),
country_gold_totals AS (
    SELECT country_code, COUNT(*) AS gold_medals
    FROM gold_awards
    GROUP BY country_code
)
SELECT c.name AS country, t.gold_medals
FROM country_gold_totals AS t
JOIN country AS c ON c.country_code = t.country_code
WHERE t.gold_medals = (SELECT MAX(gold_medals) FROM country_gold_totals)
ORDER BY c.name;
````

Database rows:

````json
[
  {
    "country": "Norway",
    "gold_medals": 13
  }
]
````

Answer: Norway won the most gold medals, with 13.

### zero-shot

Status: answered

SQL-stage response:

````text
WITH country_medals AS (
    SELECT DISTINCT
        r.country_code,
        r.event_id,
        r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team
             ELSE CAST(r.athlete_id AS TEXT)
        END AS entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal IS NOT NULL
),
gold_counts AS (
    SELECT country_code, COUNT(*) AS gold_medals
    FROM country_medals
    WHERE medal = 'Gold'
    GROUP BY country_code
)
SELECT c.name AS country, g.gold_medals
FROM gold_counts AS g
JOIN country AS c ON c.country_code = g.country_code
WHERE g.gold_medals = (SELECT MAX(gold_medals) FROM gold_counts);
````

Database rows:

````json
[
  {
    "country": "Norway",
    "gold_medals": 13
  }
]
````

Answer: Norway won the most gold medals, with 13.

## How many medals did Canada win in men's ice hockey?

Reference answer: Canada won one medal in men's ice hockey: gold.

### zero-shot

Status: answered

SQL-stage response:

````text
SELECT COUNT(DISTINCT r.country_code || ':' || r.event_id || ':' || r.medal || ':' || r.team)
FROM result AS r
JOIN country AS c ON c.country_code = r.country_code
JOIN event AS e ON e.event_id = r.event_id
WHERE c.name = 'Canada'
  AND lower(e.name) LIKE '%ice hockey%'
  AND lower(e.name) LIKE '%men%'
  AND r.medal IS NOT NULL;
````

Database rows:

````json
[
  {
    "COUNT(DISTINCT r.country_code || ':' || r.event_id || ':' || r.medal || ':' || r.team)": 2
  }
]
````

Answer: Canada won 2 medals in men's ice hockey.

### few-shot

Status: answered

SQL-stage response:

````text
WITH medal_awards AS (
    SELECT DISTINCT
        r.country_code,
        r.event_id,
        r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team
             ELSE CAST(r.athlete_id AS TEXT)
        END AS entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    JOIN country AS c ON c.country_code = r.country_code
    WHERE c.name = 'Canada'
      AND e.name = 'Ice Hockey Men'
      AND r.medal IS NOT NULL
)
SELECT COUNT(*) AS medal_count
FROM medal_awards;
````

Database rows:

````json
[
  {
    "medal_count": 0
  }
]
````

Answer: Canada won 0 medals in men's ice hockey.

## Which medal events used more than one venue, and how many venues did each use?

Reference answer: Five events used two venues each: men's and women's ice hockey, and men's individual, sprint, and team Nordic combined.

### few-shot

Status: answered

SQL-stage response:

````text
SELECT e.name AS event, COUNT(DISTINCT ev.venue_id) AS venue_count
FROM event AS e
JOIN result AS r ON r.event_id = e.event_id
JOIN event_venue AS ev ON ev.event_id = e.event_id
WHERE r.medal IS NOT NULL
GROUP BY e.event_id, e.name
HAVING COUNT(DISTINCT ev.venue_id) > 1
ORDER BY e.name;
````

Database rows:

````json
[
  {
    "event": "Ice Hockey Men's Ice Hockey",
    "venue_count": 2
  },
  {
    "event": "Ice Hockey Women's Ice Hockey",
    "venue_count": 2
  },
  {
    "event": "Nordic Combined Men's Individual",
    "venue_count": 2
  },
  {
    "event": "Nordic Combined Men's Sprint",
    "venue_count": 2
  },
  {
    "event": "Nordic Combined Men's Team",
    "venue_count": 2
  }
]
````

Answer: Ice Hockey Men's Ice Hockey, Ice Hockey Women's Ice Hockey, Nordic Combined Men's Individual, Nordic Combined Men's Sprint, and Nordic Combined Men's Team each used 2 venues.

### zero-shot

Status: answered

SQL-stage response:

````text
SELECT e.name AS event_name, COUNT(ev.venue_id) AS venue_count
FROM event AS e
JOIN event_venue AS ev ON ev.event_id = e.event_id
GROUP BY e.event_id, e.name
HAVING COUNT(ev.venue_id) > 1
ORDER BY e.name;
````

Database rows:

````json
[
  {
    "event_name": "Ice Hockey Men's Ice Hockey",
    "venue_count": 2
  },
  {
    "event_name": "Ice Hockey Women's Ice Hockey",
    "venue_count": 2
  },
  {
    "event_name": "Nordic Combined Men's Individual",
    "venue_count": 2
  },
  {
    "event_name": "Nordic Combined Men's Sprint",
    "venue_count": 2
  },
  {
    "event_name": "Nordic Combined Men's Team",
    "venue_count": 2
  }
]
````

Answer: Five events used more than one venue, and each used 2 venues: Ice Hockey Men's Ice Hockey, Ice Hockey Women's Ice Hockey, Nordic Combined Men's Individual, Nordic Combined Men's Sprint, and Nordic Combined Men's Team.

## Which countries won gold in pairs figure skating?

Reference answer: Canada and Russia both won gold in pairs figure skating.

### zero-shot

Status: answered

SQL-stage response:

````text
SELECT DISTINCT country.name
FROM result
JOIN event ON event.event_id = result.event_id
JOIN country ON country.country_code = result.country_code
WHERE event.name LIKE '%Figure Skating%'
  AND event.name LIKE '%Pairs%'
  AND result.medal = 'Gold';
````

Database rows:

````json
[
  {
    "name": "Russia"
  },
  {
    "name": "Canada"
  }
]
````

Answer: Russia and Canada won gold in pairs figure skating.

### few-shot

Status: answered

SQL-stage response:

````text
SELECT DISTINCT c.name AS country
FROM result AS r
JOIN event AS e ON e.event_id = r.event_id
JOIN country AS c ON c.country_code = r.country_code
WHERE e.name = 'Figure Skating Pairs'
  AND r.medal = 'Gold'
ORDER BY c.name;
````

Database rows:

````json
[]
````

Answer: The query returned no results.

## What was the score of the men's ice hockey final?

Reference answer: This database cannot answer that question because it does not store individual matches or scores.

### few-shot

Status: unsupported

SQL-stage response:

````text
UNSUPPORTED: Scores and individual matches are not stored in this database.
````

Database rows:

````json
null
````

Answer: This database cannot answer that question. Scores and individual matches are not stored in this database.

### zero-shot

Status: unsupported

SQL-stage response:

````text
UNSUPPORTED: Match scores are not stored in the database.
````

Database rows:

````json
null
````

Answer: This database cannot answer that question. Match scores are not stored in the database.
