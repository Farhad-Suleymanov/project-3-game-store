import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const wasmDirectory = path.dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));

export async function loadDatabase(databasePath) {
  if (!existsSync(databasePath)) {
    throw new Error(`Database not found at ${databasePath}. Run \"npm run db:rebuild\" first.`);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDirectory, file)
  });

  return new SQL.Database(readFileSync(databasePath));
}

export function queryAll(database, sql, parameters = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(parameters);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

export function queryOne(database, sql, parameters = []) {
  return queryAll(database, sql, parameters)[0] ?? null;
}
