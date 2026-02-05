from datetime import date, datetime
from database import get_db, close_db

# ============================================================================
# Account Functions
# ============================================================================

def get_all_accounts():
    """Get all accounts with today's touch status and stats."""
    db = get_db()
    today = date.today().isoformat()

    accounts = db.execute('''
        SELECT
            a.id,
            a.name,
            a.industry,
            a.location,
            a.created_at,
            CASE WHEN dt.id IS NOT NULL THEN 1 ELSE 0 END as touched_today,
            (SELECT COUNT(*) FROM activities WHERE account_id = a.id AND activity_date = ?) as today_activity_count,
            (SELECT COUNT(*) FROM tasks WHERE account_id = a.id AND status = 'open') as open_tasks,
            (SELECT MAX(activity_date) FROM activities WHERE account_id = a.id) as last_activity_date,
            (SELECT description FROM activities WHERE account_id = a.id ORDER BY activity_date DESC, created_at DESC LIMIT 1) as last_activity_description
        FROM accounts a
        LEFT JOIN daily_touches dt ON a.id = dt.account_id AND dt.touch_date = ?
        ORDER BY a.name
    ''', (today, today)).fetchall()

    close_db(db)
    return [dict(row) for row in accounts]

def get_account(account_id):
    """Get single account with full details."""
    db = get_db()
    today = date.today().isoformat()

    account = db.execute('''
        SELECT
            a.id,
            a.name,
            a.industry,
            a.location,
            a.created_at,
            CASE WHEN dt.id IS NOT NULL THEN 1 ELSE 0 END as touched_today,
            (SELECT COUNT(*) FROM activities WHERE account_id = a.id) as total_activities,
            (SELECT COUNT(*) FROM tasks WHERE account_id = a.id AND status = 'open') as open_tasks,
            (SELECT COUNT(*) FROM notes WHERE account_id = a.id) as total_notes
        FROM accounts a
        LEFT JOIN daily_touches dt ON a.id = dt.account_id AND dt.touch_date = ?
        WHERE a.id = ?
    ''', (today, account_id)).fetchone()

    close_db(db)
    return dict(account) if account else None

# ============================================================================
# Activity Functions
# ============================================================================

def create_activity(account_id, activity_type, description, activity_date=None):
    """Create a new activity and mark account as touched."""
    if activity_date is None:
        activity_date = date.today().isoformat()

    db = get_db()

    cursor = db.execute('''
        INSERT INTO activities (account_id, activity_type, description, activity_date)
        VALUES (?, ?, ?, ?)
    ''', (account_id, activity_type, description, activity_date))

    activity_id = cursor.lastrowid

    # Mark account as touched for this date (use same connection)
    try:
        db.execute('''
            INSERT INTO daily_touches (account_id, touch_date)
            VALUES (?, ?)
        ''', (account_id, activity_date))
    except Exception:
        # Already touched today, ignore
        pass

    db.commit()
    close_db(db)
    return activity_id

def get_account_activities(account_id, limit=50, offset=0):
    """Get activities for an account."""
    db = get_db()

    activities = db.execute('''
        SELECT id, account_id, activity_type, description, activity_date, created_at
        FROM activities
        WHERE account_id = ?
        ORDER BY activity_date DESC, created_at DESC
        LIMIT ? OFFSET ?
    ''', (account_id, limit, offset)).fetchall()

    close_db(db)
    return [dict(row) for row in activities]

def mark_touched(account_id, touch_date=None):
    """Mark an account as touched for a specific date."""
    if touch_date is None:
        touch_date = date.today().isoformat()

    db = get_db()

    try:
        db.execute('''
            INSERT INTO daily_touches (account_id, touch_date)
            VALUES (?, ?)
        ''', (account_id, touch_date))
        db.commit()
    except Exception:
        # Already touched today, ignore
        pass

    close_db(db)

# ============================================================================
# Task Functions
# ============================================================================

def create_task(account_id, title, description=None, due_date=None):
    """Create a new task."""
    db = get_db()

    cursor = db.execute('''
        INSERT INTO tasks (account_id, title, description, due_date)
        VALUES (?, ?, ?, ?)
    ''', (account_id, title, description, due_date))

    task_id = cursor.lastrowid
    db.commit()
    close_db(db)
    return task_id

def update_task(task_id, title=None, description=None, due_date=None, status=None):
    """Update a task."""
    db = get_db()

    task = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if not task:
        close_db(db)
        return None

    new_title = title if title is not None else task['title']
    new_description = description if description is not None else task['description']
    new_due_date = due_date if due_date is not None else task['due_date']
    new_status = status if status is not None else task['status']

    completed_at = None
    if new_status == 'completed' and task['status'] != 'completed':
        completed_at = datetime.now().isoformat()
    elif new_status != 'completed':
        completed_at = None
    else:
        completed_at = task['completed_at']

    db.execute('''
        UPDATE tasks
        SET title = ?, description = ?, due_date = ?, status = ?, completed_at = ?
        WHERE id = ?
    ''', (new_title, new_description, new_due_date, new_status, completed_at, task_id))

    db.commit()
    close_db(db)
    return task_id

def delete_task(task_id):
    """Delete a task."""
    db = get_db()
    db.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    db.commit()
    close_db(db)

def get_account_tasks(account_id):
    """Get all tasks for an account."""
    db = get_db()

    tasks = db.execute('''
        SELECT id, account_id, title, description, due_date, status, created_at, completed_at
        FROM tasks
        WHERE account_id = ?
        ORDER BY
            CASE WHEN status = 'open' THEN 0 ELSE 1 END,
            due_date ASC NULLS LAST,
            created_at DESC
    ''', (account_id,)).fetchall()

    close_db(db)
    return [dict(row) for row in tasks]

# ============================================================================
# Note Functions
# ============================================================================

def create_note(account_id, content, note_date=None):
    """Create a new note and mark account as touched."""
    if note_date is None:
        note_date = date.today().isoformat()

    db = get_db()

    cursor = db.execute('''
        INSERT INTO notes (account_id, content, note_date)
        VALUES (?, ?, ?)
    ''', (account_id, content, note_date))

    note_id = cursor.lastrowid

    # Mark account as touched for this date (use same connection)
    try:
        db.execute('''
            INSERT INTO daily_touches (account_id, touch_date)
            VALUES (?, ?)
        ''', (account_id, note_date))
    except Exception:
        # Already touched today, ignore
        pass

    db.commit()
    close_db(db)
    return note_id

def get_account_notes(account_id):
    """Get all notes for an account."""
    db = get_db()

    notes = db.execute('''
        SELECT id, account_id, content, note_date, created_at
        FROM notes
        WHERE account_id = ?
        ORDER BY note_date DESC, created_at DESC
    ''', (account_id,)).fetchall()

    close_db(db)
    return [dict(row) for row in notes]

# ============================================================================
# Dashboard Functions
# ============================================================================

def get_dashboard_stats():
    """Get dashboard summary statistics."""
    db = get_db()
    today = date.today().isoformat()

    total_accounts = db.execute('SELECT COUNT(*) as count FROM accounts').fetchone()['count']

    touched_today = db.execute('''
        SELECT COUNT(DISTINCT account_id) as count
        FROM daily_touches
        WHERE touch_date = ?
    ''', (today,)).fetchone()['count']

    total_open_tasks = db.execute('''
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'open'
    ''').fetchone()['count']

    overdue_tasks = db.execute('''
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'open' AND due_date < ?
    ''', (today,)).fetchone()['count']

    close_db(db)

    return {
        'total_accounts': total_accounts,
        'touched_today': touched_today,
        'untouched_today': total_accounts - touched_today,
        'total_open_tasks': total_open_tasks,
        'overdue_tasks': overdue_tasks
    }

# ============================================================================
# Sync Functions
# ============================================================================

def get_unsynced_activities():
    """Get activities that haven't been synced to Google Sheets."""
    db = get_db()

    activities = db.execute('''
        SELECT a.id, a.activity_type, a.description, a.activity_date, a.created_at,
               acc.name as account_name
        FROM activities a
        JOIN accounts acc ON a.account_id = acc.id
        WHERE a.synced_to_sheets = FALSE
        ORDER BY a.activity_date DESC
    ''').fetchall()

    close_db(db)
    return [dict(row) for row in activities]

def get_unsynced_tasks():
    """Get tasks that haven't been synced to Google Sheets."""
    db = get_db()

    tasks = db.execute('''
        SELECT t.id, t.title, t.description, t.due_date, t.status, t.created_at, t.completed_at,
               acc.name as account_name
        FROM tasks t
        JOIN accounts acc ON t.account_id = acc.id
        WHERE t.synced_to_sheets = FALSE
        ORDER BY t.created_at DESC
    ''').fetchall()

    close_db(db)
    return [dict(row) for row in tasks]

def get_unsynced_notes():
    """Get notes that haven't been synced to Google Sheets."""
    db = get_db()

    notes = db.execute('''
        SELECT n.id, n.content, n.note_date, n.created_at,
               acc.name as account_name
        FROM notes n
        JOIN accounts acc ON n.account_id = acc.id
        WHERE n.synced_to_sheets = FALSE
        ORDER BY n.note_date DESC
    ''').fetchall()

    close_db(db)
    return [dict(row) for row in notes]

def mark_activities_synced(activity_ids):
    """Mark activities as synced."""
    if not activity_ids:
        return

    db = get_db()
    placeholders = ','.join('?' * len(activity_ids))
    db.execute(f'UPDATE activities SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', activity_ids)
    db.commit()
    close_db(db)

def mark_tasks_synced(task_ids):
    """Mark tasks as synced."""
    if not task_ids:
        return

    db = get_db()
    placeholders = ','.join('?' * len(task_ids))
    db.execute(f'UPDATE tasks SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', task_ids)
    db.commit()
    close_db(db)

def mark_notes_synced(note_ids):
    """Mark notes as synced."""
    if not note_ids:
        return

    db = get_db()
    placeholders = ','.join('?' * len(note_ids))
    db.execute(f'UPDATE notes SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', note_ids)
    db.commit()
    close_db(db)

def get_sync_status():
    """Get count of unsynced items."""
    db = get_db()

    unsynced_activities = db.execute(
        'SELECT COUNT(*) as count FROM activities WHERE synced_to_sheets = FALSE'
    ).fetchone()['count']

    unsynced_tasks = db.execute(
        'SELECT COUNT(*) as count FROM tasks WHERE synced_to_sheets = FALSE'
    ).fetchone()['count']

    unsynced_notes = db.execute(
        'SELECT COUNT(*) as count FROM notes WHERE synced_to_sheets = FALSE'
    ).fetchone()['count']

    close_db(db)

    return {
        'unsynced_activities': unsynced_activities,
        'unsynced_tasks': unsynced_tasks,
        'unsynced_notes': unsynced_notes,
        'total_unsynced': unsynced_activities + unsynced_tasks + unsynced_notes
    }
