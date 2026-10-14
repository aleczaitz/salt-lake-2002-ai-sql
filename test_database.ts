import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { PROJECT_DIR, createDatabase } from './build_db.ts';

describe('Olympics database', () => {
  let folder: string;
  let databasePath: string;
  let connection: DatabaseSync;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'olympics-test-'));
    databasePath = join(folder, 'sample.db');
    createDatabase(databasePath);
    connection = new DatabaseSync(databasePath);
    connection.exec('PRAGMA foreign_keys = ON');
  });

  afterEach(() => {
    connection.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('counts medals and excludes non-medal results', () => {
    const query = readFileSync(join(PROJECT_DIR, 'medal_counts.sql'), 'utf8');
    const rows = connection.prepare(query).all();
    assert.equal(rows[0]?.name, 'Jochem Uytdehaage');
    assert.deepEqual(rows.map(row => row.medal_count), [2, 1, 1, 1, 1, 1, 1, 1]);
    assert.equal(rows.some(row => row.name === 'Ronny Ackermann'), false);
  });

  it('connects one event to two venues', () => {
    const rows = connection.prepare(
      'SELECT venue.name FROM venue ' +
      'JOIN event_venue USING (venue_id) WHERE event_id = 3 ORDER BY venue.name',
    ).all();
    assert.deepEqual(rows.map(row => row.name), ['Soldier Hollow', 'Utah Olympic Park']);
    assert.deepEqual(connection.prepare('PRAGMA foreign_key_check').all(), []);
  });

  it('rejects invalid and duplicate records', () => {
    const statements = [
      "INSERT INTO result VALUES (999, 1, 'Gold', 'NED', 'Netherlands')",
      "INSERT INTO result VALUES (1, 999, 'Gold', 'NED', 'Netherlands')",
      "INSERT INTO result VALUES (2, 2, 'Platinum', 'NED', 'Netherlands')",
      "INSERT INTO result VALUES (1, 1, 'Gold', 'NED', 'Netherlands')",
      "INSERT INTO result VALUES (NULL, 1, 'Gold', 'NED', 'Netherlands')",
      "INSERT INTO result VALUES (2, 2, 'Gold', 'XXX', 'Unknown')",
      "INSERT INTO result VALUES (2, 2, 'Gold', NULL, 'Netherlands')",
      "INSERT INTO country VALUES ('NL', 'Invalid')",
      "INSERT INTO country VALUES (NULL, 'Invalid')",
      "INSERT INTO country VALUES ('NED', 'Duplicate')",
      "INSERT INTO event VALUES (4, 'Invalid event', 2)",
      'INSERT INTO event_venue VALUES (3, 2)',
      'INSERT INTO event_venue VALUES (999, 1)',
      'INSERT INTO event_venue VALUES (1, 999)',
      'INSERT INTO event_venue VALUES (1, NULL)',
    ];
    for (const statement of statements) {
      assert.throws(() => connection.exec(statement), /constraint failed/i);
    }
  });

  it('preserves an existing database on rebuild', () => {
    const original = readFileSync(databasePath);
    assert.throws(() => createDatabase(databasePath), { code: 'EEXIST' });
    assert.deepEqual(readFileSync(databasePath), original);
  });

  it('removes an incomplete database after a failed build', () => {
    const script = join(folder, 'build_db.mts');
    copyFileSync(join(PROJECT_DIR, 'build_db.ts'), script);
    writeFileSync(join(folder, 'schema.sql'), 'invalid SQL;');
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /syntax error/i);
    assert.equal(existsSync(join(folder, 'olympics_sample.db')), false);
  });

  it('builds and prints medal counts when run as a script', () => {
    const script = join(folder, 'build_db.mts');
    copyFileSync(join(PROJECT_DIR, 'build_db.ts'), script);
    for (const file of ['schema.sql', 'sample_data.sql', 'medal_counts.sql']) {
      copyFileSync(join(PROJECT_DIR, file), join(folder, file));
    }
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Jochem Uytdehaage: 2/);
    assert.doesNotMatch(result.stdout, /Ronny Ackermann:/);
    assert.equal(existsSync(join(folder, 'olympics_sample.db')), true);
  });
});
