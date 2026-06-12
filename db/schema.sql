-- =============================================================================
-- Regni d'Oriente — SQLite Database Schema
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- accounts
-- Stores login credentials and session metadata for each player account.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login    TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts (username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_accounts_email    ON accounts (email    COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- characters
-- One account can have multiple characters (up to the client-enforced limit).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    class      TEXT    NOT NULL CHECK(class IN ('guerriero','ninja','mago','sciamano')),
    level      INTEGER NOT NULL DEFAULT 1  CHECK(level  >= 1),
    xp         INTEGER NOT NULL DEFAULT 0  CHECK(xp     >= 0),
    hp         INTEGER NOT NULL DEFAULT 100,
    mp         INTEGER NOT NULL DEFAULT 50,
    x          REAL    NOT NULL DEFAULT 1600.0,
    y          REAL    NOT NULL DEFAULT 1600.0,
    map_id     TEXT    NOT NULL DEFAULT 'village',
    gold       INTEGER NOT NULL DEFAULT 0   CHECK(gold   >= 0),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_characters_account_id ON characters (account_id);
CREATE INDEX IF NOT EXISTS idx_characters_name       ON characters (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_characters_level      ON characters (level DESC);
CREATE INDEX IF NOT EXISTS idx_characters_gold       ON characters (gold  DESC);

-- ---------------------------------------------------------------------------
-- character_stats
-- Derived and accumulated combat stats, plus unspent stat points.
-- Kept separate from characters for cleaner updates and joins.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS character_stats (
    character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    atk          INTEGER NOT NULL DEFAULT 0,
    matk         INTEGER NOT NULL DEFAULT 0,
    def          INTEGER NOT NULL DEFAULT 0,
    speed        INTEGER NOT NULL DEFAULT 200,
    crit         INTEGER NOT NULL DEFAULT 0,
    free_points  INTEGER NOT NULL DEFAULT 0 CHECK(free_points >= 0)
);

CREATE INDEX IF NOT EXISTS idx_character_stats_cid ON character_stats (character_id);

-- ---------------------------------------------------------------------------
-- inventory
-- Each row is one item stack occupying one bag slot or equipment slot.
-- slot_index 0-based position in the bag (ignored when equipped = 1).
-- equip_slot is NULL unless the item is equipped; value matches the slot key
-- defined in GameData.CLASSES[class].equipmentSlots.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_id      TEXT    NOT NULL,
    slot_index   INTEGER NOT NULL DEFAULT 0 CHECK(slot_index >= 0),
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK(quantity  >= 1),
    equipped     INTEGER NOT NULL DEFAULT 0 CHECK(equipped  IN (0, 1)),
    equip_slot   TEXT,   -- e.g. 'weapon', 'body', 'ring', NULL when in bag
    enhanced     INTEGER NOT NULL DEFAULT 0 CHECK(enhanced BETWEEN 0 AND 9),
    instance_data TEXT   -- JSON: { bonuses:[{stat,val}], gems:[itemId] }
);

CREATE INDEX IF NOT EXISTS idx_inventory_character_id ON inventory (character_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_id      ON inventory (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_equipped     ON inventory (character_id, equipped);

-- ---------------------------------------------------------------------------
-- quests
-- Tracks per-character quest progress.
-- objectives is stored as JSON: [{"type":"kill","target":"wolf","count":10,"current":4,"text":"..."}]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    quest_id     TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
    objectives   TEXT    NOT NULL DEFAULT '[]',   -- JSON array
    started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    UNIQUE(character_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quests_character_id ON quests (character_id);
CREATE INDEX IF NOT EXISTS idx_quests_quest_id     ON quests (quest_id);
CREATE INDEX IF NOT EXISTS idx_quests_status       ON quests (character_id, status);

-- ---------------------------------------------------------------------------
-- dungeon_completions
-- Records each dungeon run a character has finished, used for repeatable
-- rewards and leaderboard purposes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dungeon_completions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id    INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    dungeon_id      TEXT    NOT NULL,
    completed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    times_completed INTEGER NOT NULL DEFAULT 1 CHECK(times_completed >= 1)
);

CREATE INDEX IF NOT EXISTS idx_dungeon_completions_character_id ON dungeon_completions (character_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_completions_dungeon_id   ON dungeon_completions (dungeon_id);
-- Enforce one summary row per (character, dungeon) by using a partial unique constraint
-- managed at the application layer; raw rows are used for history.

-- ---------------------------------------------------------------------------
-- chat_messages
-- Persists recent chat for channel replay on join.
-- Channels: 'global', 'local', 'party', 'system'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    channel      TEXT    NOT NULL DEFAULT 'global' CHECK(channel IN ('global','local','party','system')),
    message      TEXT    NOT NULL CHECK(length(message) <= 500),
    sent_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel    ON chat_messages (channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_character  ON chat_messages (character_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at    ON chat_messages (sent_at DESC);

-- ---------------------------------------------------------------------------
-- leaderboard (VIEW)
-- Joins character and stat data for fast ranking queries.
-- Primary sort: level DESC; secondary sort: xp DESC; tertiary: gold DESC.
-- ---------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS leaderboard AS
SELECT
    c.id            AS character_id,
    c.name          AS character_name,
    c.class,
    c.level,
    c.xp,
    c.gold,
    c.map_id,
    cs.atk,
    cs.matk,
    cs.def,
    cs.crit,
    cs.speed,
    a.username      AS account_name,
    c.created_at
FROM characters  c
JOIN accounts    a  ON a.id = c.account_id
LEFT JOIN character_stats cs ON cs.character_id = c.id
ORDER BY
    c.level DESC,
    c.gold  DESC,
    c.xp    DESC;
