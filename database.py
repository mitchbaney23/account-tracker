import sqlite3
import os
from datetime import date
from config import Config

def get_db():
    """Get database connection with Row factory for dict-like access."""
    db = sqlite3.connect(Config.DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db

def close_db(db):
    """Close database connection."""
    if db is not None:
        db.close()

def init_db():
    """Initialize database with schema."""
    os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)

    db = get_db()

    # Create accounts table
    db.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            industry TEXT,
            location TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create activities table
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

    # Create tasks table
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

    # Create notes table
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

    # Create daily_touches table
    db.execute('''
        CREATE TABLE IF NOT EXISTS daily_touches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            touch_date DATE NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            UNIQUE(account_id, touch_date)
        )
    ''')

    # Create indexes for performance
    db.execute('CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_notes_account_id ON notes(account_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_daily_touches_date ON daily_touches(touch_date)')

    db.commit()
    close_db(db)

def seed_accounts():
    """Seed the database with initial account data."""
    accounts = [
        ('Acuity Insurance', 'Insurance', 'Sheboygan, WI'),
        ('MGIC Investment Corporation', 'Insurance/Financial Services', 'Milwaukee, WI'),
        ('Rockwell Automation', 'Manufacturing/Industrial Automation', 'Milwaukee, WI'),
        ('Oshkosh Corporation', 'Manufacturing/Defense', 'Oshkosh, WI'),
        ('Kohler Co', 'Manufacturing/Consumer Products', 'Kohler, WI'),
        ('Johnson Controls', 'Manufacturing/Building Technology', 'Milwaukee, WI'),
        ('Harley-Davidson', 'Manufacturing/Automotive', 'Milwaukee, WI'),
        ('WEC Energy Group', 'Utilities', 'Milwaukee, WI'),
        ('Northwestern Mutual', 'Financial Services/Insurance', 'Milwaukee, WI'),
        ('Fiserv', 'Financial Services/Fintech', 'Brookfield, WI'),
        ('Exact Sciences', 'Healthcare/Diagnostics', 'Madison, WI'),
        ('Epic Systems', 'Healthcare/Software', 'Verona, WI'),
        ('American Family Insurance', 'Insurance', 'Madison, WI'),
    ]

    db = get_db()

    for name, industry, location in accounts:
        try:
            db.execute(
                'INSERT INTO accounts (name, industry, location) VALUES (?, ?, ?)',
                (name, industry, location)
            )
        except sqlite3.IntegrityError:
            # Account already exists, skip
            pass

    db.commit()
    close_db(db)

def reset_database():
    """Reset the database (delete and recreate)."""
    if os.path.exists(Config.DATABASE_PATH):
        os.remove(Config.DATABASE_PATH)
    init_db()
    seed_accounts()
