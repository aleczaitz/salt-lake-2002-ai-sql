WITH medal_awards AS (
    SELECT DISTINCT r.country_code, r.event_id, r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team ELSE CAST(r.athlete_id AS TEXT) END AS entry
    FROM result AS r
    JOIN event AS e ON e.event_id = r.event_id
    WHERE r.medal IS NOT NULL
)
SELECT c.country_code, c.name,
    SUM(m.medal = 'Gold') AS gold,
    SUM(m.medal = 'Silver') AS silver,
    SUM(m.medal = 'Bronze') AS bronze,
    COUNT(*) AS total
FROM medal_awards AS m
JOIN country AS c ON c.country_code = m.country_code
GROUP BY c.country_code, c.name
ORDER BY total DESC, gold DESC, c.name;
