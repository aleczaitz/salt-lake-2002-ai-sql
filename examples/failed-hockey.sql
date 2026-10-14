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
