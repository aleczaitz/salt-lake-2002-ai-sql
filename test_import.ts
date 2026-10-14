import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { createDatabase, PROJECT_DIR } from './build_db.ts';
import { generateDataSql } from './import_data.ts';

const header = 'ID,Name,Games,Year,Season,City,Sport,Event,Medal,NOC,Team\n';
const row = '1,"O\'Brien, ""Pat""",2002 Winter,2002,Winter,Salt Lake City,Nordic Combined,Nordic Combined Men\'s Individual,Gold,NOR,Norway\n';

it('imports quoted names, ignores other Games, and preserves distinct athlete IDs', () => {
  const csv = header + row + row.replace(/^1,/, '2,').replace(/Gold/, 'NA') + row.replace('2002 Winter', '2006 Winter');
  const connection = new DatabaseSync(':memory:');
  try {
    connection.exec('PRAGMA foreign_keys = ON');
    connection.exec(readFileSync(join(PROJECT_DIR, 'schema.sql'), 'utf8'));
    connection.exec(generateDataSql(csv));
    assert.deepEqual(connection.prepare('SELECT name FROM athlete').all().map(row => row.name), ['O\'Brien, "Pat"', 'O\'Brien, "Pat"']);
    assert.deepEqual(connection.prepare('SELECT medal FROM result ORDER BY athlete_id').all().map(row => row.medal), ['Gold', null]);
    assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM event_venue').get()?.n, 2);
    assert.deepEqual(connection.prepare('SELECT country_code, name FROM country').all().map(r => [r.country_code, r.name]), [['NOR', 'Norway']]);
  } finally {
    connection.close();
  }
});

it('rejects malformed, ambiguous, and duplicate source records', () => {
  for (const csv of [
    'wrong,columns\n1,2',
    header,
    header + row + row,
    header + row.replace('Gold', 'Platinum'),
    header + row.replace('NOR,Norway', 'NO,Norway'),
    header + row.replace('NOR,Norway', 'NOR,'),
    header + row + row.replace(/^1,/, '2,').replace('NOR,Norway', 'NOR,Different'),
    header + row.replace('2002,Winter', '2006,Winter'),
    header + row.replace(/^1,/, 'not-an-id,'),
    header + row.replaceAll('Nordic Combined', 'Unknown Sport'),
    header + row + row.replace('O\'Brien', 'Smith'),
    header + '"unclosed',
  ]) {
    assert.throws(() => generateDataSql(csv));
  }
});

describe('Full Salt Lake 2002 database', () => {
  let folder: string;
  let connection: DatabaseSync;

  before(() => {
    folder = mkdtempSync(join(tmpdir(), 'olympics-full-test-'));
    createDatabase(join(folder, 'full.db'), 'full_data.sql');
    connection = new DatabaseSync(join(folder, 'full.db'), { readOnly: true });
  });

  after(() => {
    connection?.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('covers all source athletes and events with valid links', () => {
    for (const [table, count] of Object.entries({ athlete: 2399, event: 78, country: 77, venue: 10, result: 4109, event_venue: 83 })) {
      assert.equal(connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, count);
    }
    assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM result WHERE medal IS NOT NULL').get()?.n, 478);
    assert.equal(connection.prepare('SELECT COUNT(DISTINCT event_id) AS n FROM event_venue').get()?.n, 78);
    assert.deepEqual(connection.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(connection.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  });

  it('matches known medal leaders and retains shared gold medals', () => {
    const query = readFileSync(join(PROJECT_DIR, 'medal_counts.sql'), 'utf8');
    const rows = connection.prepare(query).all();
    assert.deepEqual(rows.filter(row => row.medal_count === 4).map(row => row.name), ['Janica Kosteli', 'Ole Einar Bjrndalen']);
    assert.equal(rows[2]?.medal_count, 3);
    assert.equal(rows.find(row => row.name === 'Jochem Simon Uytdehaage')?.medal_count, 3);
    const pairs = connection.prepare('SELECT medal, COUNT(*) AS n FROM result JOIN event USING (event_id) WHERE name = ? AND medal IS NOT NULL GROUP BY medal ORDER BY medal').all('Figure Skating Mixed Pairs');
    assert.deepEqual(pairs.map(row => [row.medal, row.n]), [['Bronze', 2], ['Gold', 4]]);
  });

  it('links countries to results and matches country medal totals without losing individual ties', () => {
    const rows = connection.prepare(readFileSync(join(PROJECT_DIR, 'country_medal_counts.sql'), 'utf8')).all();
    assert.deepEqual(rows.slice(0, 3).map(r => [r.country_code, r.gold, r.silver, r.bronze, r.total]), [
      ['GER', 12, 16, 8, 36], ['USA', 10, 13, 11, 34], ['NOR', 13, 5, 7, 25],
    ]);
    assert.equal(rows.reduce((sum, row) => sum + Number(row.total), 0), 234);
    assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM event WHERE is_team_event = 1').get()?.n, 18);
    const winners = connection.prepare("SELECT DISTINCT a.name, c.country_code FROM athlete a JOIN result r USING (athlete_id) JOIN country c USING (country_code) WHERE a.athlete_id IN (63093, 11951) ORDER BY a.name").all();
    assert.deepEqual(winners.map(r => [r.name, r.country_code]), [['Janica Kosteli', 'CRO'], ['Ole Einar Bjrndalen', 'NOR']]);
    const countryPairs = connection.prepare("SELECT DISTINCT country_code, team, medal FROM result JOIN event USING (event_id) WHERE name = 'Figure Skating Mixed Pairs' AND medal = 'Gold' ORDER BY country_code").all();
    assert.deepEqual(countryPairs.map(r => r.country_code), ['CAN', 'RUS']);
  });

  it('maps alpine disciplines and both hockey and Nordic combined venues correctly', () => {
    const venueQuery = connection.prepare('SELECT venue.name FROM venue JOIN event_venue USING (venue_id) JOIN event USING (event_id) WHERE event.name = ? ORDER BY venue.name');
    assert.deepEqual(venueQuery.all("Alpine Skiing Men's Slalom").map(row => row.name), ['Deer Valley Resort']);
    assert.deepEqual(venueQuery.all("Alpine Skiing Women's Giant Slalom").map(row => row.name), ['Park City Mountain Resort']);
    for (const gender of ['Men', 'Women']) {
      assert.deepEqual(venueQuery.all(`Ice Hockey ${gender}'s Ice Hockey`).map(row => row.name), ['E Center', 'The Peaks Ice Arena']);
    }
    for (const discipline of ['Individual', 'Sprint', 'Team']) {
      assert.deepEqual(venueQuery.all(`Nordic Combined Men's ${discipline}`).map(row => row.name), ['Soldier Hollow', 'Utah Olympic Park']);
    }
  });

  it('builds the full database from the command and refuses to replace it', () => {
    const script = join(folder, 'build_db.mts');
    copyFileSync(join(PROJECT_DIR, 'build_db.ts'), script);
    for (const file of ['schema.sql', 'full_data.sql', 'medal_counts.sql']) {
      copyFileSync(join(PROJECT_DIR, file), join(folder, file));
    }
    const first = spawnSync(process.execPath, [script, '--full'], { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Janica Kosteli: 4/);
    const original = readFileSync(join(folder, 'olympics.db'));
    const second = spawnSync(process.execPath, [script, '--full'], { encoding: 'utf8' });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /left unchanged/);
    assert.deepEqual(readFileSync(join(folder, 'olympics.db')), original);
  });
});
