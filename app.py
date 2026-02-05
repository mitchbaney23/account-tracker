from flask import Flask, jsonify, request, render_template
from flask.json.provider import DefaultJSONProvider
from datetime import date, datetime
import os


class CustomJSONProvider(DefaultJSONProvider):
    """Custom JSON provider that handles date/datetime serialization."""
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)

from config import Config
from database import init_db, seed_accounts
import models

app = Flask(__name__)
app.json_provider_class = CustomJSONProvider
app.json = CustomJSONProvider(app)
app.config.from_object(Config)

# ============================================================================
# Initialize Database
# ============================================================================

def initialize_app():
    """Initialize database if it doesn't exist."""
    if Config.use_postgres():
        print("Using PostgreSQL database...")
        init_db()
        seed_accounts()
        print("PostgreSQL database initialized.")
    elif not os.path.exists(Config.DATABASE_PATH):
        print("Initializing SQLite database...")
        init_db()
        seed_accounts()
        print("SQLite database initialized with 13 accounts.")

# ============================================================================
# Main Routes
# ============================================================================

@app.route('/')
def index():
    """Serve the main SPA page."""
    return render_template('index.html')

@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})

# ============================================================================
# Account API Routes
# ============================================================================

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    """Get all accounts with today's status and stats."""
    accounts = models.get_all_accounts()

    touched_count = sum(1 for a in accounts if a['touched_today'])
    total_count = len(accounts)

    return jsonify({
        'accounts': accounts,
        'summary': {
            'total': total_count,
            'touched_today': touched_count,
            'untouched_today': total_count - touched_count
        }
    })

@app.route('/api/accounts/<int:account_id>', methods=['GET'])
def get_account(account_id):
    """Get single account with full details."""
    account = models.get_account(account_id)

    if not account:
        return jsonify({'error': 'Account not found'}), 404

    return jsonify(account)

# ============================================================================
# Activity API Routes
# ============================================================================

@app.route('/api/activities', methods=['POST'])
def create_activity():
    """Create a new activity."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    account_id = data.get('account_id')
    activity_type = data.get('activity_type')
    description = data.get('description')
    activity_date = data.get('activity_date', date.today().isoformat())

    if not account_id or not activity_type or not description:
        return jsonify({'error': 'account_id, activity_type, and description are required'}), 400

    valid_types = ['call', 'email', 'meeting', 'research', 'event_invite', 'internal', 'other']
    if activity_type not in valid_types:
        return jsonify({'error': f'activity_type must be one of: {", ".join(valid_types)}'}), 400

    activity_id = models.create_activity(account_id, activity_type, description, activity_date)

    return jsonify({
        'id': activity_id,
        'message': 'Activity logged successfully'
    }), 201

@app.route('/api/accounts/<int:account_id>/activities', methods=['GET'])
def get_account_activities(account_id):
    """Get activities for an account."""
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)

    activities = models.get_account_activities(account_id, limit, offset)

    return jsonify({'activities': activities})

# ============================================================================
# Task API Routes
# ============================================================================

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    account_id = data.get('account_id')
    title = data.get('title')
    description = data.get('description')
    due_date = data.get('due_date')

    if not account_id or not title:
        return jsonify({'error': 'account_id and title are required'}), 400

    task_id = models.create_task(account_id, title, description, due_date)

    return jsonify({
        'id': task_id,
        'message': 'Task created successfully'
    }), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    result = models.update_task(
        task_id,
        title=data.get('title'),
        description=data.get('description'),
        due_date=data.get('due_date'),
        status=data.get('status')
    )

    if not result:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify({'message': 'Task updated successfully'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    models.delete_task(task_id)
    return jsonify({'message': 'Task deleted successfully'})

@app.route('/api/accounts/<int:account_id>/tasks', methods=['GET'])
def get_account_tasks(account_id):
    """Get tasks for an account."""
    tasks = models.get_account_tasks(account_id)
    return jsonify({'tasks': tasks})

# ============================================================================
# Note API Routes
# ============================================================================

@app.route('/api/notes', methods=['POST'])
def create_note():
    """Create a new note."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    account_id = data.get('account_id')
    content = data.get('content')
    note_date = data.get('note_date', date.today().isoformat())

    if not account_id or not content:
        return jsonify({'error': 'account_id and content are required'}), 400

    note_id = models.create_note(account_id, content, note_date)

    return jsonify({
        'id': note_id,
        'message': 'Note added successfully'
    }), 201

@app.route('/api/accounts/<int:account_id>/notes', methods=['GET'])
def get_account_notes(account_id):
    """Get notes for an account."""
    notes = models.get_account_notes(account_id)
    return jsonify({'notes': notes})

# ============================================================================
# Dashboard API Routes
# ============================================================================

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard summary stats."""
    stats = models.get_dashboard_stats()
    return jsonify(stats)

# ============================================================================
# Sync API Routes
# ============================================================================

@app.route('/api/sync/status', methods=['GET'])
def get_sync_status():
    """Get count of unsynced items."""
    status = models.get_sync_status()
    return jsonify(status)

@app.route('/api/sync', methods=['POST'])
def sync_to_sheets():
    """Sync all unsynced data to Google Sheets."""
    try:
        from sheets_sync import SheetsSync

        sync = SheetsSync(
            Config.GOOGLE_SHEETS_CREDENTIALS_PATH,
            Config.GOOGLE_SHEETS_SPREADSHEET_ID
        )

        result = sync.full_sync()
        return jsonify(result)

    except ImportError:
        return jsonify({'error': 'Google Sheets sync not configured'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Run Application
# ============================================================================

initialize_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
