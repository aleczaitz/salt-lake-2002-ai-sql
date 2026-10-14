import { join } from 'node:path';
import { constants, DatabaseSync } from 'node:sqlite';

export function executeQuery(sql: string) {
  if (!/^(SELECT|WITH)\b/i.test(sql.trim()) || sql.length > 20_000) {
    throw new Error('Expected a single SELECT query. Please rephrase your question.');
  }
  const database = new DatabaseSync(join(import.meta.dirname, 'olympics.db'), {
    readOnly: true,
    allowExtension: false,
  });
  try {
    database.exec('PRAGMA query_only = ON; PRAGMA temp_store = MEMORY; BEGIN;');
    const tables = new Set(['athlete', 'event', 'country', 'venue', 'result', 'event_venue']);
    // Keep a schema snapshot so real tables and views cannot pass as temporary CTE names.
    const storedRelations = new Set(database.prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view')")
      .all().map(row => (row.name as string).toLowerCase()));
    const functions = new Set(['count', 'sum', 'min', 'max', 'avg', 'total', 'coalesce', 'ifnull',
      'nullif', 'length', 'lower', 'upper', 'trim', 'ltrim', 'rtrim', 'replace', 'substr',
      'substring', 'like', 'glob', 'instr', 'round', 'abs', 'rank', 'dense_rank', 'row_number', 'group_concat']);
    database.setAuthorizer((action, table, columnOrFunction, dbName) => {
      if (action === constants.SQLITE_SELECT || action === constants.SQLITE_RECURSIVE) return constants.SQLITE_OK;
      // SQLite reports no database name for COUNT(*) reads; attachments remain forbidden.
      if (action === constants.SQLITE_READ && (dbName === 'main' || dbName === null) && tables.has(table ?? '')) return constants.SQLITE_OK;
      // CTE counts also produce a column-free read; their underlying reads are checked separately.
      if (action === constants.SQLITE_READ && dbName === null && columnOrFunction === '' && table
        && !table.toLowerCase().startsWith('sqlite_') && !storedRelations.has(table.toLowerCase())) return constants.SQLITE_OK;
      if (action === constants.SQLITE_FUNCTION && functions.has(columnOrFunction?.toLowerCase() ?? '')) return constants.SQLITE_OK;
      return constants.SQLITE_DENY;
    });
    const statement = database.prepare(sql);
    if (statement.sourceSQL.trim() !== sql.trim()) throw new Error('Only one SQL statement is allowed.');
    const rows = [];
    let size = 0;
    for (const row of statement.iterate()) {
      size += JSON.stringify(row).length;
      if (rows.length >= 100 || size > 30_000) {
        throw new Error('Too many results. Ask for a smaller group or a summary.');
      }
      rows.push(row);
    }
    return rows;
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify({ rows: executeQuery(process.argv[2] ?? '') }));
  } catch (error) {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : 'Query failed.' }));
  }
}
