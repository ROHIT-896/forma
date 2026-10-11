import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, autoBackupDatabase } from '../src/main/db';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Phase 0: Database & Storage Integrity', () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-test-'));
    testDbPath = path.join(tempDir, 'forma-test.sqlite');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes SQLite database with WAL mode and schema_migrations table', () => {
    const { db, schemaVersion, dbPath } = initDatabase(testDbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(schemaVersion).toBeGreaterThanOrEqual(1);

    // Verify WAL mode
    const pragmaJournal = db.pragma('journal_mode', { simple: true });
    expect(pragmaJournal).toBe('wal');

    // Verify foreign keys enabled
    const pragmaFk = db.pragma('foreign_keys', { simple: true });
    expect(pragmaFk).toBe(1);

    // Verify migration applied
    const row = db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get() as { version: number };
    expect(row).toBeDefined();
    expect(row.version).toBe(2);

    // Verify seed exercises were inserted
    const exCountRow = db.prepare('SELECT count(*) as cnt FROM exercises').get() as { cnt: number };
    expect(exCountRow.cnt).toBeGreaterThanOrEqual(80);

    // Verify seed foods were inserted
    const foodCountRow = db.prepare('SELECT count(*) as cnt FROM foods').get() as { cnt: number };
    expect(foodCountRow.cnt).toBeGreaterThanOrEqual(25);

    // Verify app_meta table exists
    const metaRow = db.prepare("SELECT value FROM app_meta WHERE key = 'initialized_at'").get() as { value: string };
    expect(metaRow).toBeDefined();
    expect(metaRow.value).toBeTruthy();

    db.close();
  });

  it('performs auto-backup and prunes older backups beyond 5', () => {
    // 1. Create initial DB file
    const { db } = initDatabase(testDbPath);
    db.close();

    // 2. Perform 7 simulated backups
    const backupDir = path.join(tempDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    for (let i = 1; i <= 7; i++) {
      // Simulate file write
      fs.writeFileSync(path.join(backupDir, `forma-backup-2026-10-10T12-00-0${i}Z.sqlite`), `backup-${i}`);
    }

    const countBefore = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite')).length;
    expect(countBefore).toBe(7);

    // Trigger autoBackupDatabase
    const remaining = autoBackupDatabase(testDbPath);
    expect(remaining).toBe(5);

    const filesAfter = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite'));
    expect(filesAfter.length).toBe(5);
  });
});
