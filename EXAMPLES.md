# Six additional examples

Actual zero-shot responses from October 14, 2026. These questions differ from the two featured in [the class post](CLASS_POST.md). SQL and answers below are preserved from the saved runs.

## 1. How many different athletes represented the United States?

```sql
SELECT COUNT(DISTINCT r.athlete_id)
FROM result AS r
JOIN country AS c ON c.country_code = r.country_code
WHERE c.name = 'United States';
```

**Answer:** 202 different athletes represented the United States.

[Saved response](experiments/2026-10-14T17-24-56-933Z/zero-shot-distinct-athletes.json)

## 2. Which country won the most gold medals, and how many? Include all ties.

```sql
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
```

**Answer:** Norway won the most gold medals, with 13.

[Saved response](experiments/2026-10-14T17-24-56-933Z/zero-shot-country-gold-leader.json)

## 3. Which medal events used more than one venue, and how many venues did each use?

```sql
SELECT e.name, COUNT(DISTINCT ev.venue_id) AS venue_count
FROM event AS e
JOIN event_venue AS ev ON ev.event_id = e.event_id
GROUP BY e.event_id, e.name
HAVING COUNT(DISTINCT ev.venue_id) > 1;
```

**Answer:** Ice Hockey Men's Ice Hockey and Ice Hockey Women's Ice Hockey each used 2 venues. Nordic Combined Men's Individual, Nordic Combined Men's Sprint, and Nordic Combined Men's Team also each used 2 venues.

[Saved response](experiments/2026-10-14T17-24-56-933Z/zero-shot-multiple-venues.json)

## 4. Which countries won gold in pairs figure skating?

```sql
SELECT DISTINCT c.name
FROM result AS r
JOIN event AS e ON e.event_id = r.event_id
JOIN country AS c ON c.country_code = r.country_code
WHERE e.name = 'Figure Skating Mixed Pairs'
  AND r.medal = 'Gold';
```

**Answer:** Russia and Canada won gold in pairs figure skating.

[Saved response](experiments/2026-10-14T17-24-56-933Z/zero-shot-pairs-gold-tie.json)

## 5. What was the score of the men's ice hockey final?

UNSUPPORTED: Match-level scores are not stored; results describe athletes by event only.

**Answer:** This database cannot answer that question. Match-level scores are not stored; results describe athletes by event only.

[Saved response](experiments/2026-10-14T17-24-56-933Z/zero-shot-unsupported-final-score.json)

## 6. How many medals did China win at the 2002 Winter Olympics?

```sql
WITH medal_entries AS (
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
    WHERE r.medal IS NOT NULL
)
SELECT COUNT(*) AS medal_count
FROM medal_entries AS m
JOIN country AS c ON c.country_code = m.country_code
WHERE c.name = 'China';
```

**Answer:** China won 8 medals at the 2002 Winter Olympics.

[Saved response](examples/china-medals.json)
