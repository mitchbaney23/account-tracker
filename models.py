from datetime import date, datetime, timedelta
from database import get_db, close_db, fetchall, fetchone, execute, get_last_insert_id
from config import Config

# ============================================================================
# Account Functions
# ============================================================================

def get_all_accounts():
    """Get all accounts with today's touch status and stats."""
    db = get_db()
    today = Config.today().isoformat()

    query = '''
        SELECT
            a.id,
            a.name,
            a.industry,
            a.location,
            a.renewal_date,
            a.annual_value,
            a.created_at,
            CASE WHEN dt.id IS NOT NULL THEN 1 ELSE 0 END as touched_today,
            (SELECT COUNT(*) FROM activities WHERE account_id = a.id AND activity_date = ?) as today_activity_count,
            (SELECT COUNT(*) FROM tasks WHERE account_id = a.id AND status = 'open') as open_tasks,
            (SELECT MAX(activity_date) FROM activities WHERE account_id = a.id) as last_activity_date,
            (SELECT description FROM activities WHERE account_id = a.id ORDER BY activity_date DESC, created_at DESC LIMIT 1) as last_activity_description,
            (SELECT COUNT(*) FROM deals WHERE account_id = a.id AND stage NOT IN ('closed_won', 'closed_lost')) as active_deals,
            (SELECT COALESCE(SUM(value), 0) FROM deals WHERE account_id = a.id AND stage NOT IN ('closed_won', 'closed_lost')) as pipeline_value,
            (SELECT stage FROM deals WHERE account_id = a.id AND stage NOT IN ('closed_won', 'closed_lost') ORDER BY
                CASE stage
                    WHEN 'negotiation' THEN 1
                    WHEN 'proposal' THEN 2
                    WHEN 'design' THEN 3
                    WHEN 'discovery' THEN 4
                END
            LIMIT 1) as top_deal_stage,
            (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) as contact_count
        FROM accounts a
        LEFT JOIN daily_touches dt ON a.id = dt.account_id AND dt.touch_date = ?
        ORDER BY a.name
    '''

    accounts = fetchall(db, query, (today, today))
    close_db(db)
    return accounts

def get_account(account_id):
    """Get single account with full details."""
    db = get_db()
    today = Config.today().isoformat()

    query = '''
        SELECT
            a.id,
            a.name,
            a.industry,
            a.location,
            a.renewal_date,
            a.annual_value,
            a.created_at,
            CASE WHEN dt.id IS NOT NULL THEN 1 ELSE 0 END as touched_today,
            (SELECT COUNT(*) FROM activities WHERE account_id = a.id) as total_activities,
            (SELECT COUNT(*) FROM tasks WHERE account_id = a.id AND status = 'open') as open_tasks,
            (SELECT COUNT(*) FROM notes WHERE account_id = a.id) as total_notes,
            (SELECT COUNT(*) FROM deals WHERE account_id = a.id AND stage NOT IN ('closed_won', 'closed_lost')) as active_deals,
            (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) as contact_count
        FROM accounts a
        LEFT JOIN daily_touches dt ON a.id = dt.account_id AND dt.touch_date = ?
        WHERE a.id = ?
    '''

    account = fetchone(db, query, (today, account_id))
    close_db(db)
    return account

def update_account(account_id, **kwargs):
    """Update account metadata. Only updates fields present in kwargs."""
    db = get_db()

    account = fetchone(db, 'SELECT * FROM accounts WHERE id = ?', (account_id,))
    if not account:
        close_db(db)
        return None

    # Use new value if provided in kwargs, otherwise keep existing
    _sentinel = object()
    name = kwargs.get('name', _sentinel)
    name = name if name is not _sentinel else account['name']
    industry = kwargs.get('industry', _sentinel)
    industry = industry if industry is not _sentinel else account['industry']
    location = kwargs.get('location', _sentinel)
    location = location if location is not _sentinel else account['location']
    renewal_date = kwargs.get('renewal_date', _sentinel)
    renewal_date = renewal_date if renewal_date is not _sentinel else account['renewal_date']
    annual_value = kwargs.get('annual_value', _sentinel)
    annual_value = annual_value if annual_value is not _sentinel else account['annual_value']

    execute(db, '''
        UPDATE accounts
        SET name = ?, industry = ?, location = ?, renewal_date = ?, annual_value = ?
        WHERE id = ?
    ''', (name, industry, location, renewal_date, annual_value, account_id))

    db.commit()
    close_db(db)
    return account_id

# ============================================================================
# Activity Functions
# ============================================================================

def create_activity(account_id, activity_type, description, activity_date=None):
    """Create a new activity and mark account as touched."""
    if activity_date is None:
        activity_date = Config.today().isoformat()

    db = get_db()

    if Config.use_postgres():
        cursor = execute(db, '''
            INSERT INTO activities (account_id, activity_type, description, activity_date)
            VALUES (?, ?, ?, ?) RETURNING id
        ''', (account_id, activity_type, description, activity_date))
        activity_id = get_last_insert_id(db, cursor)
    else:
        cursor = execute(db, '''
            INSERT INTO activities (account_id, activity_type, description, activity_date)
            VALUES (?, ?, ?, ?)
        ''', (account_id, activity_type, description, activity_date))
        activity_id = get_last_insert_id(db, cursor)

    # Mark account as touched for this date
    try:
        if Config.use_postgres():
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?) ON CONFLICT DO NOTHING
            ''', (account_id, activity_date))
        else:
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?)
            ''', (account_id, activity_date))
    except Exception:
        pass

    db.commit()
    close_db(db)
    return activity_id

def get_account_activities(account_id, limit=50, offset=0):
    """Get activities for an account."""
    db = get_db()

    activities = fetchall(db, '''
        SELECT id, account_id, activity_type, description, activity_date, created_at
        FROM activities
        WHERE account_id = ?
        ORDER BY activity_date DESC, created_at DESC
        LIMIT ? OFFSET ?
    ''', (account_id, limit, offset))

    close_db(db)
    return activities

def mark_touched(account_id, touch_date=None):
    """Mark an account as touched for a specific date."""
    if touch_date is None:
        touch_date = Config.today().isoformat()

    db = get_db()

    try:
        if Config.use_postgres():
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?) ON CONFLICT DO NOTHING
            ''', (account_id, touch_date))
        else:
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?)
            ''', (account_id, touch_date))
        db.commit()
    except Exception:
        pass

    close_db(db)

# ============================================================================
# Task Functions
# ============================================================================

def create_task(account_id, title, description=None, due_date=None):
    """Create a new task."""
    db = get_db()

    if Config.use_postgres():
        cursor = execute(db, '''
            INSERT INTO tasks (account_id, title, description, due_date)
            VALUES (?, ?, ?, ?) RETURNING id
        ''', (account_id, title, description, due_date))
        task_id = get_last_insert_id(db, cursor)
    else:
        cursor = execute(db, '''
            INSERT INTO tasks (account_id, title, description, due_date)
            VALUES (?, ?, ?, ?)
        ''', (account_id, title, description, due_date))
        task_id = get_last_insert_id(db, cursor)

    db.commit()
    close_db(db)
    return task_id

def update_task(task_id, title=None, description=None, due_date=None, status=None):
    """Update a task."""
    db = get_db()

    task = fetchone(db, 'SELECT * FROM tasks WHERE id = ?', (task_id,))
    if not task:
        close_db(db)
        return None

    new_title = title if title is not None else task['title']
    new_description = description if description is not None else task['description']
    new_due_date = due_date if due_date is not None else task['due_date']
    new_status = status if status is not None else task['status']

    completed_at = None
    if new_status == 'completed' and task['status'] != 'completed':
        completed_at = Config.now().isoformat()
    elif new_status != 'completed':
        completed_at = None
    else:
        completed_at = task['completed_at']

    execute(db, '''
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
    execute(db, 'DELETE FROM tasks WHERE id = ?', (task_id,))
    db.commit()
    close_db(db)

def get_account_tasks(account_id):
    """Get all tasks for an account."""
    db = get_db()

    if Config.use_postgres():
        tasks = fetchall(db, '''
            SELECT id, account_id, title, description, due_date, status, created_at, completed_at
            FROM tasks
            WHERE account_id = ?
            ORDER BY
                CASE WHEN status = 'open' THEN 0 ELSE 1 END,
                due_date ASC NULLS LAST,
                created_at DESC
        ''', (account_id,))
    else:
        tasks = fetchall(db, '''
            SELECT id, account_id, title, description, due_date, status, created_at, completed_at
            FROM tasks
            WHERE account_id = ?
            ORDER BY
                CASE WHEN status = 'open' THEN 0 ELSE 1 END,
                due_date ASC NULLS LAST,
                created_at DESC
        ''', (account_id,))

    close_db(db)
    return tasks

# ============================================================================
# Note Functions
# ============================================================================

def create_note(account_id, content, note_date=None):
    """Create a new note and mark account as touched."""
    if note_date is None:
        note_date = Config.today().isoformat()

    db = get_db()

    if Config.use_postgres():
        cursor = execute(db, '''
            INSERT INTO notes (account_id, content, note_date)
            VALUES (?, ?, ?) RETURNING id
        ''', (account_id, content, note_date))
        note_id = get_last_insert_id(db, cursor)
    else:
        cursor = execute(db, '''
            INSERT INTO notes (account_id, content, note_date)
            VALUES (?, ?, ?)
        ''', (account_id, content, note_date))
        note_id = get_last_insert_id(db, cursor)

    # Mark account as touched for this date
    try:
        if Config.use_postgres():
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?) ON CONFLICT DO NOTHING
            ''', (account_id, note_date))
        else:
            execute(db, '''
                INSERT INTO daily_touches (account_id, touch_date)
                VALUES (?, ?)
            ''', (account_id, note_date))
    except Exception:
        pass

    db.commit()
    close_db(db)
    return note_id

def get_account_notes(account_id):
    """Get all notes for an account."""
    db = get_db()

    notes = fetchall(db, '''
        SELECT id, account_id, content, note_date, created_at
        FROM notes
        WHERE account_id = ?
        ORDER BY note_date DESC, created_at DESC
    ''', (account_id,))

    close_db(db)
    return notes

# ============================================================================
# Deal Functions
# ============================================================================

def create_deal(account_id, name, stage='discovery', value=None, products=None, expected_close_date=None, notes=None):
    """Create a new deal."""
    db = get_db()

    if Config.use_postgres():
        cursor = execute(db, '''
            INSERT INTO deals (account_id, name, stage, value, products, expected_close_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
        ''', (account_id, name, stage, value, products, expected_close_date, notes))
        deal_id = get_last_insert_id(db, cursor)
    else:
        cursor = execute(db, '''
            INSERT INTO deals (account_id, name, stage, value, products, expected_close_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (account_id, name, stage, value, products, expected_close_date, notes))
        deal_id = get_last_insert_id(db, cursor)

    db.commit()
    close_db(db)
    return deal_id

def get_account_deals(account_id):
    """Get all deals for an account."""
    db = get_db()

    deals = fetchall(db, '''
        SELECT id, account_id, name, stage, value, products, expected_close_date, notes,
               created_at, updated_at, closed_at
        FROM deals
        WHERE account_id = ?
        ORDER BY
            CASE WHEN stage IN ('closed_won', 'closed_lost') THEN 1 ELSE 0 END,
            CASE stage
                WHEN 'negotiation' THEN 1
                WHEN 'proposal' THEN 2
                WHEN 'design' THEN 3
                WHEN 'discovery' THEN 4
                ELSE 5
            END,
            created_at DESC
    ''', (account_id,))

    close_db(db)
    return deals

def update_deal(deal_id, **kwargs):
    """Update a deal."""
    db = get_db()

    deal = fetchone(db, 'SELECT * FROM deals WHERE id = ?', (deal_id,))
    if not deal:
        close_db(db)
        return None

    new_name = kwargs.get('name', deal['name'])
    new_stage = kwargs.get('stage', deal['stage'])
    new_value = kwargs.get('value', deal['value'])
    new_products = kwargs.get('products', deal['products'])
    new_close_date = kwargs.get('expected_close_date', deal['expected_close_date'])
    new_notes = kwargs.get('notes', deal['notes'])
    updated_at = Config.now().isoformat()

    closed_at = deal['closed_at']
    if new_stage in ('closed_won', 'closed_lost') and deal['stage'] not in ('closed_won', 'closed_lost'):
        closed_at = Config.now().isoformat()
    elif new_stage not in ('closed_won', 'closed_lost'):
        closed_at = None

    execute(db, '''
        UPDATE deals
        SET name = ?, stage = ?, value = ?, products = ?, expected_close_date = ?,
            notes = ?, updated_at = ?, closed_at = ?
        WHERE id = ?
    ''', (new_name, new_stage, new_value, new_products, new_close_date,
          new_notes, updated_at, closed_at, deal_id))

    db.commit()
    close_db(db)
    return deal_id

def delete_deal(deal_id):
    """Delete a deal."""
    db = get_db()
    execute(db, 'DELETE FROM deals WHERE id = ?', (deal_id,))
    db.commit()
    close_db(db)

# ============================================================================
# Contact Functions
# ============================================================================

def create_contact(account_id, name, title=None, role=None, email=None, phone=None, notes=None):
    """Create a new contact."""
    db = get_db()

    if Config.use_postgres():
        cursor = execute(db, '''
            INSERT INTO contacts (account_id, name, title, role, email, phone, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
        ''', (account_id, name, title, role, email, phone, notes))
        contact_id = get_last_insert_id(db, cursor)
    else:
        cursor = execute(db, '''
            INSERT INTO contacts (account_id, name, title, role, email, phone, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (account_id, name, title, role, email, phone, notes))
        contact_id = get_last_insert_id(db, cursor)

    db.commit()
    close_db(db)
    return contact_id

def get_account_contacts(account_id):
    """Get all contacts for an account."""
    db = get_db()

    contacts = fetchall(db, '''
        SELECT id, account_id, name, title, role, email, phone, notes, last_contacted, created_at
        FROM contacts
        WHERE account_id = ?
        ORDER BY
            CASE role
                WHEN 'champion' THEN 1
                WHEN 'decision_maker' THEN 2
                WHEN 'technical_eval' THEN 3
                WHEN 'influencer' THEN 4
                WHEN 'blocker' THEN 5
                ELSE 6
            END,
            name ASC
    ''', (account_id,))

    close_db(db)
    return contacts

def update_contact(contact_id, **kwargs):
    """Update a contact."""
    db = get_db()

    contact = fetchone(db, 'SELECT * FROM contacts WHERE id = ?', (contact_id,))
    if not contact:
        close_db(db)
        return None

    new_name = kwargs.get('name', contact['name'])
    new_title = kwargs.get('title', contact['title'])
    new_role = kwargs.get('role', contact['role'])
    new_email = kwargs.get('email', contact['email'])
    new_phone = kwargs.get('phone', contact['phone'])
    new_notes = kwargs.get('notes', contact['notes'])
    new_last_contacted = kwargs.get('last_contacted', contact['last_contacted'])

    execute(db, '''
        UPDATE contacts
        SET name = ?, title = ?, role = ?, email = ?, phone = ?, notes = ?, last_contacted = ?
        WHERE id = ?
    ''', (new_name, new_title, new_role, new_email, new_phone, new_notes, new_last_contacted, contact_id))

    db.commit()
    close_db(db)
    return contact_id

def delete_contact(contact_id):
    """Delete a contact."""
    db = get_db()
    execute(db, 'DELETE FROM contacts WHERE id = ?', (contact_id,))
    db.commit()
    close_db(db)

# ============================================================================
# Dashboard Functions
# ============================================================================

def get_dashboard_stats():
    """Get dashboard summary statistics including pipeline and renewal data."""
    db = get_db()
    today = Config.today()
    today_str = today.isoformat()

    # Calculate start of current week (Monday)
    week_start = (today - timedelta(days=today.weekday())).isoformat()

    total_accounts = fetchone(db, 'SELECT COUNT(*) as count FROM accounts')['count']

    touched_today = fetchone(db, '''
        SELECT COUNT(DISTINCT account_id) as count
        FROM daily_touches
        WHERE touch_date = ?
    ''', (today_str,))['count']

    total_open_tasks = fetchone(db, '''
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'open'
    ''')['count']

    overdue_tasks = fetchone(db, '''
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'open' AND due_date < ?
    ''', (today_str,))['count']

    # Weekly touch count (distinct accounts touched this week)
    weekly_touches = fetchone(db, '''
        SELECT COUNT(DISTINCT account_id) as count
        FROM daily_touches
        WHERE touch_date >= ?
    ''', (week_start,))['count']

    # Weekly activity count
    weekly_activities = fetchone(db, '''
        SELECT COUNT(*) as count
        FROM activities
        WHERE activity_date >= ?
    ''', (week_start,))['count']

    # Total pipeline value (active deals only)
    pipeline_result = fetchone(db, '''
        SELECT COALESCE(SUM(value), 0) as total
        FROM deals
        WHERE stage NOT IN ('closed_won', 'closed_lost')
    ''')
    total_pipeline = float(pipeline_result['total']) if pipeline_result['total'] else 0

    # Upcoming renewals within 30 days
    thirty_days = (today + timedelta(days=30)).isoformat()
    upcoming_renewals = fetchone(db, '''
        SELECT COUNT(*) as count
        FROM accounts
        WHERE renewal_date IS NOT NULL AND renewal_date <= ? AND renewal_date >= ?
    ''', (thirty_days, today_str))['count']

    # Touch streak - consecutive days with at least one activity
    streak = _calculate_streak(db, today)

    close_db(db)

    return {
        'total_accounts': total_accounts,
        'touched_today': touched_today,
        'untouched_today': total_accounts - touched_today,
        'total_open_tasks': total_open_tasks,
        'overdue_tasks': overdue_tasks,
        'weekly_touches': weekly_touches,
        'weekly_activities': weekly_activities,
        'total_pipeline': total_pipeline,
        'upcoming_renewals': upcoming_renewals,
        'touch_streak': streak
    }

def _calculate_streak(db, today):
    """Calculate consecutive days with logged activity."""
    streak = 0
    check_date = today

    for _ in range(365):  # Max 1 year lookback
        result = fetchone(db, '''
            SELECT COUNT(*) as count
            FROM activities
            WHERE activity_date = ?
        ''', (check_date.isoformat(),))

        if result['count'] > 0:
            streak += 1
            check_date = check_date - timedelta(days=1)
        else:
            break

    return streak

# ============================================================================
# Sync Functions
# ============================================================================

def get_unsynced_activities():
    """Get activities that haven't been synced to Google Sheets."""
    db = get_db()

    activities = fetchall(db, '''
        SELECT a.id, a.activity_type, a.description, a.activity_date, a.created_at,
               acc.name as account_name
        FROM activities a
        JOIN accounts acc ON a.account_id = acc.id
        WHERE a.synced_to_sheets = FALSE
        ORDER BY a.activity_date DESC
    ''')

    close_db(db)
    return activities

def get_unsynced_tasks():
    """Get tasks that haven't been synced to Google Sheets."""
    db = get_db()

    tasks = fetchall(db, '''
        SELECT t.id, t.title, t.description, t.due_date, t.status, t.created_at, t.completed_at,
               acc.name as account_name
        FROM tasks t
        JOIN accounts acc ON t.account_id = acc.id
        WHERE t.synced_to_sheets = FALSE
        ORDER BY t.created_at DESC
    ''')

    close_db(db)
    return tasks

def get_unsynced_notes():
    """Get notes that haven't been synced to Google Sheets."""
    db = get_db()

    notes = fetchall(db, '''
        SELECT n.id, n.content, n.note_date, n.created_at,
               acc.name as account_name
        FROM notes n
        JOIN accounts acc ON n.account_id = acc.id
        WHERE n.synced_to_sheets = FALSE
        ORDER BY n.note_date DESC
    ''')

    close_db(db)
    return notes

def get_unsynced_deals():
    """Get deals that haven't been synced to Google Sheets."""
    db = get_db()

    deals = fetchall(db, '''
        SELECT d.id, d.name, d.stage, d.value, d.products, d.expected_close_date,
               d.notes, d.created_at, d.closed_at,
               acc.name as account_name
        FROM deals d
        JOIN accounts acc ON d.account_id = acc.id
        WHERE d.synced_to_sheets = FALSE
        ORDER BY d.created_at DESC
    ''')

    close_db(db)
    return deals

def mark_activities_synced(activity_ids):
    """Mark activities as synced."""
    if not activity_ids:
        return

    db = get_db()
    if Config.use_postgres():
        cursor = db.cursor()
        cursor.execute(
            'UPDATE activities SET synced_to_sheets = TRUE WHERE id = ANY(%s)',
            (activity_ids,)
        )
        cursor.close()
    else:
        placeholders = ','.join('?' * len(activity_ids))
        db.execute(f'UPDATE activities SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', activity_ids)
    db.commit()
    close_db(db)

def mark_tasks_synced(task_ids):
    """Mark tasks as synced."""
    if not task_ids:
        return

    db = get_db()
    if Config.use_postgres():
        cursor = db.cursor()
        cursor.execute(
            'UPDATE tasks SET synced_to_sheets = TRUE WHERE id = ANY(%s)',
            (task_ids,)
        )
        cursor.close()
    else:
        placeholders = ','.join('?' * len(task_ids))
        db.execute(f'UPDATE tasks SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', task_ids)
    db.commit()
    close_db(db)

def mark_notes_synced(note_ids):
    """Mark notes as synced."""
    if not note_ids:
        return

    db = get_db()
    if Config.use_postgres():
        cursor = db.cursor()
        cursor.execute(
            'UPDATE notes SET synced_to_sheets = TRUE WHERE id = ANY(%s)',
            (note_ids,)
        )
        cursor.close()
    else:
        placeholders = ','.join('?' * len(note_ids))
        db.execute(f'UPDATE notes SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', note_ids)
    db.commit()
    close_db(db)

def mark_deals_synced(deal_ids):
    """Mark deals as synced."""
    if not deal_ids:
        return

    db = get_db()
    if Config.use_postgres():
        cursor = db.cursor()
        cursor.execute(
            'UPDATE deals SET synced_to_sheets = TRUE WHERE id = ANY(%s)',
            (deal_ids,)
        )
        cursor.close()
    else:
        placeholders = ','.join('?' * len(deal_ids))
        db.execute(f'UPDATE deals SET synced_to_sheets = TRUE WHERE id IN ({placeholders})', deal_ids)
    db.commit()
    close_db(db)

def get_sync_status():
    """Get count of unsynced items."""
    db = get_db()

    unsynced_activities = fetchone(db,
        'SELECT COUNT(*) as count FROM activities WHERE synced_to_sheets = FALSE'
    )['count']

    unsynced_tasks = fetchone(db,
        'SELECT COUNT(*) as count FROM tasks WHERE synced_to_sheets = FALSE'
    )['count']

    unsynced_notes = fetchone(db,
        'SELECT COUNT(*) as count FROM notes WHERE synced_to_sheets = FALSE'
    )['count']

    unsynced_deals = fetchone(db,
        'SELECT COUNT(*) as count FROM deals WHERE synced_to_sheets = FALSE'
    )['count']

    close_db(db)

    return {
        'unsynced_activities': unsynced_activities,
        'unsynced_tasks': unsynced_tasks,
        'unsynced_notes': unsynced_notes,
        'unsynced_deals': unsynced_deals,
        'total_unsynced': unsynced_activities + unsynced_tasks + unsynced_notes + unsynced_deals
    }
