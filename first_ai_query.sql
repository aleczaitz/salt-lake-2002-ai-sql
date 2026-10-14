WITH medal_counts AS (
    SELECT athlete_id, COUNT(*) AS medal_count
    FROM result
    WHERE medal IS NOT NULL
    GROUP BY athlete_id
),
ranked AS (
    SELECT athlete_id, medal_count,
           RANK() OVER (ORDER BY medal_count DESC) AS medal_rank
    FROM medal_counts
)
SELECT a.name, r.medal_count
FROM ranked AS r
JOIN athlete AS a ON a.athlete_id = r.athlete_id
WHERE r.medal_rank = 1;
