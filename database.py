import os
from datetime import date
from config import Config


def get_db():
    """Get database connection."""
    if Config.use_postgres():
        import psycopg2
        import psycopg2.extras
        db = psycopg2.connect(Config.DATABASE_URL)
        db.autocommit = False
        return db
    else:
        import sqlite3
        db = sqlite3.connect(Config.DATABASE_PATH)
        db.row_factory = sqlite3.Row
        return db


def close_db(db):
    """Close database connection."""
    if db is not None:
        db.close()


def execute_query(db, query, params=None):
    """Execute a query, handling SQLite vs PostgreSQL placeholder differences."""
    if Config.use_postgres():
        # Convert ? placeholders to %s for psycopg2
        query = query.replace('?', '%s')
        # Convert BOOLEAN DEFAULT FALSE to PostgreSQL-compatible syntax
        import psycopg2.extras
        cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    else:
        cursor = db.cursor()

    if params:
        cursor.execute(query, params)
    else:
        cursor.execute(query)
    return cursor


def fetchall(db, query, params=None):
    """Execute query and return all rows as dicts."""
    cursor = execute_query(db, query, params)
    rows = cursor.fetchall()
    cursor.close()
    if Config.use_postgres():
        return [dict(row) for row in rows]
    else:
        return [dict(row) for row in rows]


def fetchone(db, query, params=None):
    """Execute query and return one row as dict."""
    cursor = execute_query(db, query, params)
    row = cursor.fetchone()
    cursor.close()
    if row is None:
        return None
    return dict(row)


def execute(db, query, params=None):
    """Execute a write query and return the cursor."""
    return execute_query(db, query, params)


def get_last_insert_id(db, cursor):
    """Get the last inserted row ID."""
    if Config.use_postgres():
        return cursor.fetchone()['id']
    else:
        return cursor.lastrowid


def init_db():
    """Initialize database with schema."""
    if Config.use_postgres():
        _init_postgres()
    else:
        _init_sqlite()


def _init_sqlite():
    """Initialize SQLite database."""
    import sqlite3
    os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)

    db = get_db()

    db.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            industry TEXT,
            location TEXT,
            renewal_date DATE,
            annual_value DECIMAL(12,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            activity_type TEXT NOT NULL,
            description TEXT NOT NULL,
            activity_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            due_date DATE,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            note_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS daily_touches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            touch_date DATE NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            UNIQUE(account_id, touch_date)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'discovery',
            value DECIMAL(12,2),
            products TEXT,
            expected_close_date DATE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            title TEXT,
            role TEXT,
            email TEXT,
            phone TEXT,
            notes TEXT,
            last_contacted DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    ''')

    db.execute('CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_notes_account_id ON notes(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_daily_touches_date ON daily_touches(touch_date)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id)')

    db.commit()
    close_db(db)


def _init_postgres():
    """Initialize PostgreSQL database."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            industry TEXT,
            location TEXT,
            renewal_date DATE,
            annual_value DECIMAL(12,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            activity_type TEXT NOT NULL,
            description TEXT NOT NULL,
            activity_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            title TEXT NOT NULL,
            description TEXT,
            due_date DATE,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            content TEXT NOT NULL,
            note_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_touches (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            touch_date DATE NOT NULL,
            UNIQUE(account_id, touch_date)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS deals (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            name TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'discovery',
            value DECIMAL(12,2),
            products TEXT,
            expected_close_date DATE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP,
            synced_to_sheets BOOLEAN DEFAULT FALSE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            name TEXT NOT NULL,
            title TEXT,
            role TEXT,
            email TEXT,
            phone TEXT,
            notes TEXT,
            last_contacted DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_account_id ON notes(account_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_daily_touches_date ON daily_touches(touch_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id)')

    cursor.close()
    db.commit()
    close_db(db)


def run_migrations():
    """Run migrations to add new columns to existing tables (idempotent)."""
    db = get_db()

    # Add renewal_date and annual_value to accounts if they don't exist
    if Config.use_postgres():
        cursor = db.cursor()
        try:
            cursor.execute('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS renewal_date DATE')
            cursor.execute('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS annual_value DECIMAL(12,2)')
        except Exception:
            pass
        cursor.close()
    else:
        # SQLite doesn't have IF NOT EXISTS for ALTER TABLE
        try:
            db.execute('ALTER TABLE accounts ADD COLUMN renewal_date DATE')
        except Exception:
            pass
        try:
            db.execute('ALTER TABLE accounts ADD COLUMN annual_value DECIMAL(12,2)')
        except Exception:
            pass

    db.commit()
    close_db(db)


def seed_accounts():
    """Seed the database with initial account data."""
    accounts = [
        ('Acuity, A Mutual Insurance Company', 'Insurance', 'Sheboygan, WI'),
        ('American Transmission Company, LLC', 'Utilities/Transmission', 'Waukesha, WI'),
        ('Crabel Capital Management', 'Financial Services/Investment', 'Milwaukee, WI'),
        ('Greenheck Fan Corporation', 'Manufacturing/HVAC', 'Schofield, WI'),
        ('Kohler Co.', 'Manufacturing/Consumer Products', 'Kohler, WI'),
        ('Kwik Trip, Inc.', 'Retail/Convenience', 'La Crosse, WI'),
        ('Menard, Inc.', 'Retail/Home Improvement', 'Eau Claire, WI'),
        ('Mortgage Guaranty Insurance Corporation (MGIC)', 'Insurance/Financial Services', 'Milwaukee, WI'),
        ('Navitus Health Solutions', 'Healthcare/Pharmacy Benefits', 'Madison, WI'),
        ('Oshkosh Corporation', 'Manufacturing/Defense', 'Oshkosh, WI'),
        ('Sentry Insurance Company', 'Insurance', 'Stevens Point, WI'),
        ('WEC Energy Group, Inc.', 'Utilities', 'Milwaukee, WI'),
        ('WPS Insurance Corporation (Wisconsin Physicians Service)', 'Insurance/Healthcare', 'Madison, WI'),
        ('Alliant Energy', 'Utilities', 'Madison, WI'),
    ]

    db = get_db()

    for name, industry, location in accounts:
        try:
            if Config.use_postgres():
                cursor = db.cursor()
                cursor.execute(
                    'INSERT INTO accounts (name, industry, location) VALUES (%s, %s, %s) ON CONFLICT (name) DO NOTHING',
                    (name, industry, location)
                )
                cursor.close()
            else:
                try:
                    db.execute(
                        'INSERT INTO accounts (name, industry, location) VALUES (?, ?, ?)',
                        (name, industry, location)
                    )
                except Exception:
                    pass
        except Exception:
            pass

    db.commit()
    close_db(db)


def reset_database():
    """Reset the database (delete and recreate)."""
    if Config.use_postgres():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('DROP TABLE IF EXISTS contacts')
        cursor.execute('DROP TABLE IF EXISTS deals')
        cursor.execute('DROP TABLE IF EXISTS daily_touches')
        cursor.execute('DROP TABLE IF EXISTS notes')
        cursor.execute('DROP TABLE IF EXISTS tasks')
        cursor.execute('DROP TABLE IF EXISTS activities')
        cursor.execute('DROP TABLE IF EXISTS accounts')
        cursor.close()
        db.commit()
        close_db(db)
    else:
        if os.path.exists(Config.DATABASE_PATH):
            os.remove(Config.DATABASE_PATH)
    init_db()
    seed_accounts()
