SELECT athlete.name, COUNT(*) AS medal_count
FROM athlete
JOIN result ON result.athlete_id = athlete.athlete_id
WHERE result.medal IS NOT NULL
GROUP BY athlete.athlete_id, athlete.name
ORDER BY medal_count DESC, athlete.name, athlete.athlete_id;
