import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { it } from 'node:test';
import { runQuery } from './answer_question.ts';

it('runs counts, venue joins, and empty queries read-only', async () => {
  assert.deepEqual(await runQuery('SELECT COUNT(*) AS n FROM athlete;'), [{ n: 2399 }]);
  assert.deepEqual(await runQuery("SELECT v.name FROM venue v JOIN event_venue ev USING (venue_id) JOIN event e USING (event_id) WHERE e.name = 'Ice Hockey Men''s Ice Hockey' ORDER BY v.name;"), [{ name: 'E Center' }, { name: 'The Peaks Ice Arena' }]);
  assert.deepEqual(await runQuery('SELECT name FROM athlete WHERE athlete_id = -1;'), []);
});

it('allows country joins and country medal totals through the read-only query worker', async () => {
  assert.deepEqual(await runQuery('SELECT COUNT(*) AS n FROM country;'), [{ n: 77 }]);
  const rows = await runQuery(readFileSync(join(import.meta.dirname, 'country_medal_counts.sql'), 'utf8'));
  assert.equal(rows[0]?.name, 'Germany');
  assert.equal(rows[0]?.total, 36);
  assert.equal(rows.find(r => r.country_code === 'NOR')?.gold, 13);
});

it('counts CTE results, including China medals, without rejecting temporary names', async () => {
  assert.deepEqual(await runQuery(`
    WITH medals AS (
      SELECT DISTINCT r.country_code, r.event_id, r.medal,
        CASE WHEN e.is_team_event = 1 THEN r.team ELSE CAST(r.athlete_id AS TEXT) END AS entry
      FROM result AS r
      JOIN event AS e ON e.event_id = r.event_id
      JOIN country AS c ON c.country_code = r.country_code
      WHERE c.name = 'China' AND r.medal IS NOT NULL
    )
    SELECT COUNT(*) AS medal_count FROM medals;
  `), [{ medal_count: 8 }]);
  assert.deepEqual(await runQuery('WITH x AS (SELECT 1), y AS (SELECT * FROM x) SELECT COUNT(*) AS n FROM y;'), [{ n: 1 }]);
  assert.deepEqual(await runQuery('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 3) SELECT COUNT(*) AS n FROM n;'), [{ n: 3 }]);
});

it('rejects writes, extra statements, attachments, metadata, and non-approved functions', async () => {
  const databasePath = join(import.meta.dirname, 'olympics.db');
  const before = readFileSync(databasePath);
  for (const sql of [
    'DELETE FROM athlete;',
    'WITH x AS (SELECT 1) DELETE FROM athlete;',
    'SELECT 1; DELETE FROM athlete;',
    'SELECT 1; SELECT 2;',
    "ATTACH ':memory:' AS other;",
    'PRAGMA query_only = OFF;',
    'SELECT * FROM sqlite_master;',
    'SELECT COUNT(*) FROM sqlite_schema;',
    'WITH athlete AS (SELECT COUNT(*) AS n FROM sqlite_master) SELECT * FROM athlete;',
    'WITH sqlite_master AS (SELECT 1) SELECT (SELECT COUNT(*) FROM main.sqlite_master) FROM sqlite_master;',
    "SELECT * FROM pragma_table_info('athlete');",
    "SELECT COUNT(*) FROM pragma_table_info('athlete');",
    "SELECT load_extension('fake');",
    'SELECT randomblob(1000000000);',
    '```sql\nSELECT 1;\n```',
  ]) await assert.rejects(runQuery(sql), sql);
  assert.deepEqual(readFileSync(databasePath), before);
});

it('does not treat unapproved stored tables or views as CTEs', () => {
  const folder = mkdtempSync(join(tmpdir(), 'olympics-query-test-'));
  try {
    const script = join(folder, 'query_worker.mts');
    copyFileSync(join(import.meta.dirname, 'query_worker.ts'), script);
    const database = new DatabaseSync(join(folder, 'olympics.db'));
    try {
      database.exec('CREATE TABLE private_data (value TEXT); INSERT INTO private_data VALUES (\'secret\'); CREATE VIEW private_view AS SELECT * FROM private_data;');
    } finally {
      database.close();
    }
    for (const sql of [
      'SELECT COUNT(*) FROM private_data;',
      'SELECT COUNT(*) FROM private_view;',
      'WITH athlete AS (SELECT COUNT(*) AS n FROM private_data) SELECT * FROM athlete;',
      'WITH private_data AS (SELECT 1) SELECT (SELECT COUNT(*) FROM main.private_data) FROM private_data;',
    ]) {
      const result = spawnSync(process.execPath, [script, sql], { encoding: 'utf8', timeout: 2000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(JSON.parse(result.stdout).error, /not authorized|prohibited/, sql);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

it('rejects oversized results instead of silently truncating the answer', async () => {
  await assert.rejects(runQuery('SELECT name FROM athlete;'), /Too many results/);
  await assert.rejects(runQuery('SELECT group_concat(name) AS names FROM athlete;'), /Too many results/);
});

it('terminates a query that never finishes', async () => {
  await assert.rejects(runQuery('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT SUM(x) FROM n;'), /two-second limit/);
});
