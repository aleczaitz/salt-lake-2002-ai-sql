import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const PROJECT_DIR = import.meta.dirname;

export function createDatabase(databasePath: string, dataFile = 'sample_data.sql'): void {
  // Exclusive creation protects an existing database from accidental replacement.
  closeSync(openSync(databasePath, 'wx'));
  try {
    const connection = new DatabaseSync(databasePath);
    try {
      connection.exec('PRAGMA foreign_keys = ON; BEGIN;');
      connection.exec(readFileSync(join(PROJECT_DIR, 'schema.sql'), 'utf8'));
      connection.exec(readFileSync(join(PROJECT_DIR, dataFile), 'utf8'));
      connection.exec('COMMIT;');
    } finally {
      connection.close();
    }
  } catch (error) {
    unlinkSync(databasePath);
    throw error;
  }
}

if (import.meta.main) {
  const full = process.argv[2] === '--full';
  if (process.argv.length > 3 || (process.argv[2] && !full)) {
    console.error('Usage: node build_db.ts [--full]');
    process.exit(1);
  }
  const databaseName = full ? 'olympics.db' : 'olympics_sample.db';
  const databasePath = join(PROJECT_DIR, databaseName);
  try {
    createDatabase(databasePath, full ? 'full_data.sql' : 'sample_data.sql');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      console.error(`${databaseName} already exists; it was left unchanged.`);
      process.exit(1);
    }
    throw error;
  }

  console.log(`Created ${databaseName}. ${full ? 'First 10 athletes by medal count:' : 'Medal counts in the sample only:'}`);
  const connection = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const query = readFileSync(join(PROJECT_DIR, 'medal_counts.sql'), 'utf8');
    for (const row of connection.prepare(query).all().slice(0, full ? 10 : undefined)) {
      console.log(`${row.name}: ${row.medal_count}`);
    }
  } finally {
    connection.close();
  }
}
