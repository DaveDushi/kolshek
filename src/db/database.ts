import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

let _db: Database | null = null;

/**
 * Initialize the SQLite database: open, configure pragmas, run migrations.
 */
export function initDatabase(dbPath: string): Database {
  if (_db) return _db;

  const db = new Database(dbPath, { create: true });

  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("PRAGMA temp_store=2");

  runMigrations(db);

  _db = db;
  return db;
}

/**
 * Get the singleton database instance. Throws if not initialized.
 */
export function getDatabase(): Database {
  if (!_db) {
    throw new Error(
      "Database not initialized. Call initDatabase() first.",
    );
  }
  return _db;
}

/**
 * Close the database connection and clear the singleton.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Run all pending SQL migrations from the migrations directory.
 * Tracks applied migrations in a _migrations table.
 */
function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = join(import.meta.dir, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = db
      .prepare("SELECT 1 FROM _migrations WHERE name = $name")
      .get({ $name: file });

    if (!applied) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES ($name)").run({
        $name: file,
      });
    }
  }
}
