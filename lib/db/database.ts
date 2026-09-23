import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { hashPassword } from '@/lib/auth/password';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'pitch_and_prosper.db');
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode and foreign keys for high performance and integrity
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);
  seedInitialData(db);

  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cohort TEXT NOT NULL DEFAULT 'Alpha 2024',
      submission_id TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roster_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('TEAM_LEADER', 'TEAM_MEMBER')),
      registered_user_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR')),
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      email_verified INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
      anonymous_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      track TEXT NOT NULL,
      category_tag TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      innovation TEXT NOT NULL,
      impact TEXT NOT NULL,
      why_invest TEXT NOT NULL,
      tech_stack TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_budget INTEGER NOT NULL DEFAULT 100,
      allocated INTEGER NOT NULL DEFAULT 0,
      remaining INTEGER NOT NULL DEFAULT 100,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK(amount > 0),
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_config (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      min_per_idea INTEGER NOT NULL DEFAULT 10,
      max_per_idea INTEGER NOT NULL DEFAULT 50,
      total_budget INTEGER NOT NULL DEFAULT 100,
      investment_started_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_roster_team ON roster_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_ideas_team ON ideas(team_id);
    CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
    CREATE INDEX IF NOT EXISTS idx_investments_idea ON investments(idea_id);
  `);

  // Safe migrations for existing SQLite databases
  try {
    db.exec('ALTER TABLE ideas ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    db.exec('ALTER TABLE event_config ADD COLUMN investment_started_at INTEGER;');
  } catch {}
}

/**
 * Checks whether investment has started (i.e. event is OPEN, PAUSED, CLOSED, or REVEALED,
 * or investment_started_at timestamp is set).
 */
export function isInvestmentPeriodActive(db?: DatabaseSync): boolean {
  const targetDb = db || getDatabase();
  const event = targetDb
    .prepare('SELECT status, investment_started_at FROM event_config WHERE id = ?')
    .get('evt-main') as { status: string; investment_started_at: number | null } | undefined;

  if (!event) return false;

  const lockedStatuses = ['OPEN', 'PAUSED', 'CLOSED', 'REVEALED'];
  return lockedStatuses.includes(event.status) || event.investment_started_at !== null;
}

/**
 * Transactionally marks all approved ideas as locked.
 */
export function lockAllApprovedIdeas(db?: DatabaseSync): void {
  const targetDb = db || getDatabase();
  targetDb.prepare(`
    UPDATE ideas
    SET is_locked = 1, updated_at = ?
    WHERE status IN ('APPROVED', 'OPEN') OR is_locked = 0
  `).run(Date.now());
}

function seedInitialData(db: DatabaseSync) {
  const now = Date.now();

  // Event Config
  const eventRow = db.prepare('SELECT id FROM event_config WHERE id = ?').get('evt-main');
  if (!eventRow) {
    db.prepare(`
      INSERT INTO event_config (id, title, status, min_per_idea, max_per_idea, total_budget)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('evt-main', 'PITCH AND PROSPER Arena 2024', 'DRAFT', 10, 50, 100);
  }

  // Root Administrator: pradeshkannan64@gmail.com
  const rootEmail = 'pradeshkannan64@gmail.com';
  const adminRow = db.prepare('SELECT id FROM users WHERE email = ?').get(rootEmail);
  if (!adminRow) {
    const adminPassHash = hashPassword('pradesh@2006K');
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, team_id, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('usr-root-admin', rootEmail, 'Pradesh Kannan C', adminPassHash, 'ADMIN', null, 1, now, now);
  }
}
