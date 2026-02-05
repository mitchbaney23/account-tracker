# Account Daily Tracker

A local web application for sales account executives to track daily engagement across 13 strategic accounts. Ensures every account receives attention each day through a card-based interface with daily reset functionality.

## Features

- **Card-based Dashboard**: View all 13 accounts at a glance with touch status, activity count, and open tasks
- **Activity Logging**: Log calls, emails, meetings, research, events, and more
- **Task Management**: Create, complete, and delete tasks with due dates
- **Notes**: Add notes to accounts for important reminders
- **Daily Touch Tracking**: Visual indicators show which accounts have been touched today
- **Daily Reset**: Touch status automatically resets each day
- **Google Sheets Sync**: Push data to Google Sheets for team visibility (optional)

## Quick Start

1. Install dependencies:
   ```bash
   pip3 install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python3 app.py
   ```

3. Open your browser to `http://localhost:5001`

The database will be created automatically on first run with the 13 pre-configured accounts.

## Pre-configured Accounts

| Account | Industry | Location |
|---------|----------|----------|
| Acuity Insurance | Insurance | Sheboygan, WI |
| MGIC Investment Corporation | Insurance/Financial Services | Milwaukee, WI |
| Rockwell Automation | Manufacturing/Industrial Automation | Milwaukee, WI |
| Oshkosh Corporation | Manufacturing/Defense | Oshkosh, WI |
| Kohler Co | Manufacturing/Consumer Products | Kohler, WI |
| Johnson Controls | Manufacturing/Building Technology | Milwaukee, WI |
| Harley-Davidson | Manufacturing/Automotive | Milwaukee, WI |
| WEC Energy Group | Utilities | Milwaukee, WI |
| Northwestern Mutual | Financial Services/Insurance | Milwaukee, WI |
| Fiserv | Financial Services/Fintech | Brookfield, WI |
| Exact Sciences | Healthcare/Diagnostics | Madison, WI |
| Epic Systems | Healthcare/Software | Verona, WI |
| American Family Insurance | Insurance | Madison, WI |

## Usage

### Logging Activities

1. Click "Log Activity" on any account card
2. Select the activity type (call, email, meeting, etc.)
3. Enter a description
4. Submit - the account will be marked as "touched" for today

### Managing Tasks

1. Click "Task" on any account card
2. Enter a title and optional description/due date
3. View tasks in the account detail view
4. Check the box to mark complete, or click the trash icon to delete

### Adding Notes

1. Click the account card to open details
2. Click "Add Note"
3. Enter your note content
4. Notes also mark the account as touched

### Filtering & Sorting

- Use the filter buttons (All, Untouched, Touched) to filter accounts
- Use the sort dropdown to sort by name, touch status, or open tasks

## Google Sheets Integration (Optional)

To sync data to Google Sheets:

1. Create a Google Cloud project and enable the Google Sheets API
2. Create a service account and download the credentials JSON file
3. Create a Google Sheet with three tabs:
   - "Activity Log"
   - "Tasks"
   - "Notes"
4. Share the Google Sheet with your service account email
5. Set environment variables:
   ```bash
   export GOOGLE_SHEETS_CREDENTIALS_PATH=/path/to/credentials.json
   export GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
   ```
6. Click the "Sync" button in the app header

## API Endpoints

### Accounts
- `GET /api/accounts` - List all accounts with today's status
- `GET /api/accounts/<id>` - Get single account details

### Activities
- `POST /api/activities` - Log new activity
- `GET /api/accounts/<id>/activities` - Get activities for account

### Tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/<id>` - Update task
- `DELETE /api/tasks/<id>` - Delete task
- `GET /api/accounts/<id>/tasks` - Get tasks for account

### Notes
- `POST /api/notes` - Add note
- `GET /api/accounts/<id>/notes` - Get notes for account

### Dashboard & Sync
- `GET /api/dashboard` - Get summary stats
- `GET /api/sync/status` - Get unsynced item count
- `POST /api/sync` - Sync to Google Sheets

## File Structure

```
account-tracker/
├── app.py                 # Flask application
├── config.py              # Configuration
├── database.py            # Database initialization
├── models.py              # Data access layer
├── sheets_sync.py         # Google Sheets integration
├── requirements.txt       # Python dependencies
├── static/
│   ├── css/styles.css     # Custom styles
│   └── js/app.js          # Frontend JavaScript
├── templates/
│   └── index.html         # Main page template
└── data/
    └── tracker.db         # SQLite database
```

## Tech Stack

- **Backend**: Python 3.11+ with Flask
- **Database**: SQLite
- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **Optional**: Google Sheets API for data sync

## Daily Reset Behavior

The app tracks which accounts have been "touched" each day. When you:
- Log an activity
- Add a note

The account is automatically marked as touched for today. The touch status resets at midnight (based on your local time). A "New Day" notification appears when you open the app on a new day.

## Development

To reset the database and start fresh:

```python
from database import reset_database
reset_database()
```
