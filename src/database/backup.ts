import 'dotenv/config';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const keepBackupCount = 30;

function getDatabasePath() {
  const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db';
  if (!connectionString.startsWith('file:')) {
    throw new Error('Automatic SQLite backup requires a file: DATABASE_URL.');
  }
  const filePath = decodeURIComponent(connectionString.slice('file:'.length).split('?')[0]);
  if (!filePath || filePath === ':memory:') {
    throw new Error('Automatic backup cannot be used with an in-memory database.');
  }
  return path.resolve(filePath);
}

function pruneBackups(backupDirectory: string) {
  const backups = readdirSync(backupDirectory)
    .filter((name) => name.endsWith('.db'))
    .map((name) => ({ name, modifiedAt: statSync(path.join(backupDirectory, name)).mtimeMs }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  for (const backup of backups.slice(keepBackupCount)) {
    unlinkSync(path.join(backupDirectory, backup.name));
  }
}

export async function createDatabaseBackup(beforeSchemaSync = false) {
  const databasePath = getDatabasePath();
  if (!existsSync(databasePath)) {
    console.info(`Database backup skipped; database does not exist yet: ${databasePath}`);
    return null;
  }

  const backupDirectory = process.env.DATABASE_BACKUP_DIR
    ? path.resolve(process.env.DATABASE_BACKUP_DIR)
    : path.join(path.dirname(databasePath), 'backups');
  mkdirSync(backupDirectory, { recursive: true });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const backupName = beforeSchemaSync
    ? `cafe-pre-sync-${now.toISOString().replace(/[:.]/g, '-')}.db`
    : `cafe-daily-${date}.db`;
  const backupPath = path.join(backupDirectory, backupName);
  if (!beforeSchemaSync && existsSync(backupPath)) {
    return backupPath;
  }

  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    await database.backup(backupPath);
  } finally {
    database.close();
  }
  pruneBackups(backupDirectory);
  console.info(`SQLite backup saved: ${backupPath}`);
  return backupPath;
}

if (require.main === module) {
  createDatabaseBackup(process.argv[2] === 'before-sync').catch((error: unknown) => {
    console.error('Could not back up the SQLite database:', error);
    process.exitCode = 1;
  });
}