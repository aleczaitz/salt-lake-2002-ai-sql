# Prompt comparison: observed outputs

Started: 2026-10-14T17:24:57.277Z. Model: gpt-6-luna. One trial per question and style.
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
        CASE WHEN e.is_team_event = 1 THEN r.team ELSE CAST(r.athlete_id AS TEXT) END AS entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal = 'Gold'
),
country_totals AS (
    SELECT country_code, COUNT(*) AS gold_medals
    FROM gold_awards
    GROUP BY country_code
)
SELECT c.name AS country, ct.gold_medals
FROM country_totals AS ct
JOIN country AS c ON c.country_code = ct.country_code
WHERE ct.gold_medals = (SELECT MAX(gold_medals) FROM country_totals)
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
WITH gold_medals AS (
    SELECT DISTINCT
        r.country_code,
        r.event_id,
        r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team
             ELSE CAST(r.athlete_id AS TEXT)
        END AS medal_entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal = 'Gold'
),
country_totals AS (
    SELECT country_code, COUNT(*) AS gold_medals
    FROM gold_medals
    GROUP BY country_code
)
SELECT c.name AS country, ct.gold_medals
FROM country_totals AS ct
JOIN country AS c ON c.country_code = ct.country_code
WHERE ct.gold_medals = (SELECT MAX(gold_medals) FROM country_totals);
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
WITH medal_units AS (
    SELECT DISTINCT
        r.country_code,
        r.event_id,
        r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team ELSE CAST(r.athlete_id AS TEXT) END AS medal_unit
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal IS NOT NULL
      AND r.country_code = 'CAN'
      AND e.name = 'Ice Hockey Men''s Ice Hockey'
)
SELECT COUNT(*) AS medal_count
FROM medal_units;
````

Database rows:

````json
[
  {
    "medal_count": 1
  }
]
````

Answer: Canada won 1 medal in men's ice hockey.

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
      AND e.name = 'Ice Hockey Men''s Ice Hockey'
      AND r.medal IS NOT NULL
)
SELECT COUNT(*) AS medal_count
FROM medal_awards;
````

Database rows:

````json
[
  {
    "medal_count": 1
  }
]
````

Answer: Canada won 1 medal in men's ice hockey.

## Which medal events used more than one venue, and how many venues did each use?

Reference answer: Five events used two venues each: men's and women's ice hockey, and men's individual, sprint, and team Nordic combined.

### few-shot

Status: answered

SQL-stage response:

````text
SELECT e.name AS event, COUNT(DISTINCT ev.venue_id) AS venue_count
FROM event AS e
JOIN event_venue AS ev ON ev.event_id = e.event_id
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
SELECT e.name, COUNT(DISTINCT ev.venue_id) AS venue_count
FROM event AS e
JOIN event_venue AS ev ON ev.event_id = e.event_id
GROUP BY e.event_id, e.name
HAVING COUNT(DISTINCT ev.venue_id) > 1;
````

Database rows:

````json
[
  {
    "name": "Ice Hockey Men's Ice Hockey",
    "venue_count": 2
  },
  {
    "name": "Ice Hockey Women's Ice Hockey",
    "venue_count": 2
  },
  {
    "name": "Nordic Combined Men's Individual",
    "venue_count": 2
  },
  {
    "name": "Nordic Combined Men's Sprint",
    "venue_count": 2
  },
  {
    "name": "Nordic Combined Men's Team",
    "venue_count": 2
  }
]
````

Answer: Ice Hockey Men's Ice Hockey and Ice Hockey Women's Ice Hockey each used 2 venues. Nordic Combined Men's Individual, Nordic Combined Men's Sprint, and Nordic Combined Men's Team also each used 2 venues.

## Which countries won gold in pairs figure skating?

Reference answer: Canada and Russia both won gold in pairs figure skating.

### zero-shot

Status: answered

SQL-stage response:

````text
SELECT DISTINCT c.name
FROM result AS r
JOIN event AS e ON e.event_id = r.event_id
JOIN country AS c ON c.country_code = r.country_code
WHERE e.name = 'Figure Skating Mixed Pairs'
  AND r.medal = 'Gold';
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
WHERE e.name = 'Figure Skating Mixed Pairs'
  AND r.medal = 'Gold'
ORDER BY c.name;
````

Database rows:

````json
[
  {
    "country": "Canada"
  },
  {
    "country": "Russia"
  }
]
````

Answer: Canada and Russia won gold in pairs figure skating.

## What was the score of the men's ice hockey final?

Reference answer: This database cannot answer that question because it does not store individual matches or scores.

### few-shot

Status: unsupported

SQL-stage response:

````text
UNSUPPORTED: Individual matches, dates, finishing places, and scores are not stored.
````

Database rows:

````json
null
````

Answer: This database cannot answer that question. Individual matches, dates, finishing places, and scores are not stored.

### zero-shot

Status: unsupported

SQL-stage response:

````text
UNSUPPORTED: Match-level scores are not stored; results describe athletes by event only.
````

Database rows:

````json
null
````

Answer: This database cannot answer that question. Match-level scores are not stored; results describe athletes by event only.
