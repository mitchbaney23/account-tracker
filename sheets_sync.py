"""Google Sheets synchronization module for Account Daily Tracker."""

import os
from datetime import datetime, date

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import models


def to_str(value):
    """Convert a value to string, handling date/datetime objects."""
    if value is None:
        return ''
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


class SheetsSync:
    """Handle synchronization with Google Sheets."""

    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

    def __init__(self, credentials_path, spreadsheet_id):
        """Initialize the Sheets sync with credentials and spreadsheet ID.

        Args:
            credentials_path: Path to the service account JSON credentials file.
            spreadsheet_id: The ID of the Google Sheet to sync with.
        """
        self.spreadsheet_id = spreadsheet_id
        self.service = None

        if not spreadsheet_id:
            raise ValueError("Google Sheets spreadsheet ID is not configured")

        if not os.path.exists(credentials_path):
            raise FileNotFoundError(f"Credentials file not found: {credentials_path}")

        try:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=self.SCOPES
            )
            self.service = build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Google Sheets service: {e}")

    def _ensure_sheet_exists(self, sheet_name):
        """Ensure a sheet/tab exists, create if it doesn't."""
        try:
            # Get spreadsheet metadata
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()

            sheet_names = [s['properties']['title'] for s in spreadsheet['sheets']]

            if sheet_name not in sheet_names:
                # Create the sheet
                request = {
                    'addSheet': {
                        'properties': {
                            'title': sheet_name
                        }
                    }
                }
                self.service.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={'requests': [request]}
                ).execute()

        except HttpError as e:
            print(f"Error ensuring sheet exists: {e}")

    def _append_rows(self, sheet_name, rows):
        """Append rows to a sheet."""
        if not rows:
            return 0

        try:
            self._ensure_sheet_exists(sheet_name)

            body = {'values': rows}
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f'{sheet_name}!A1',
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()

            return result.get('updates', {}).get('updatedRows', 0)

        except HttpError as e:
            print(f"Error appending rows to {sheet_name}: {e}")
            return 0

    def _setup_headers(self, sheet_name, headers):
        """Set up headers for a sheet if it's empty."""
        try:
            self._ensure_sheet_exists(sheet_name)

            # Check if sheet has data
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f'{sheet_name}!A1:A1'
            ).execute()

            if not result.get('values'):
                # Sheet is empty, add headers
                body = {'values': [headers]}
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=f'{sheet_name}!A1',
                    valueInputOption='RAW',
                    body=body
                ).execute()

        except HttpError as e:
            print(f"Error setting up headers for {sheet_name}: {e}")

    def sync_activities(self):
        """Sync unsynced activities to Google Sheets.

        Returns:
            Number of activities synced.
        """
        activities = models.get_unsynced_activities()

        if not activities:
            return 0

        # Set up headers
        headers = ['Date', 'Account', 'Activity Type', 'Description', 'Logged At']
        self._setup_headers('Activity Log', headers)

        # Prepare rows
        rows = []
        activity_ids = []

        for activity in activities:
            rows.append([
                to_str(activity['activity_date']),
                to_str(activity['account_name']),
                to_str(activity['activity_type']),
                to_str(activity['description']),
                to_str(activity['created_at'])
            ])
            activity_ids.append(activity['id'])

        # Append to sheet
        synced = self._append_rows('Activity Log', rows)

        if synced > 0:
            models.mark_activities_synced(activity_ids)

        return synced

    def sync_tasks(self):
        """Sync unsynced tasks to Google Sheets.

        Returns:
            Number of tasks synced.
        """
        tasks = models.get_unsynced_tasks()

        if not tasks:
            return 0

        # Set up headers
        headers = ['Account', 'Task', 'Description', 'Due Date', 'Status', 'Created', 'Completed']
        self._setup_headers('Tasks', headers)

        # Prepare rows
        rows = []
        task_ids = []

        for task in tasks:
            rows.append([
                to_str(task['account_name']),
                to_str(task['title']),
                to_str(task['description']),
                to_str(task['due_date']),
                to_str(task['status']),
                to_str(task['created_at']),
                to_str(task['completed_at'])
            ])
            task_ids.append(task['id'])

        # Append to sheet
        synced = self._append_rows('Tasks', rows)

        if synced > 0:
            models.mark_tasks_synced(task_ids)

        return synced

    def sync_notes(self):
        """Sync unsynced notes to Google Sheets.

        Returns:
            Number of notes synced.
        """
        notes = models.get_unsynced_notes()

        if not notes:
            return 0

        # Set up headers
        headers = ['Date', 'Account', 'Note', 'Logged At']
        self._setup_headers('Notes', headers)

        # Prepare rows
        rows = []
        note_ids = []

        for note in notes:
            rows.append([
                to_str(note['note_date']),
                to_str(note['account_name']),
                to_str(note['content']),
                to_str(note['created_at'])
            ])
            note_ids.append(note['id'])

        # Append to sheet
        synced = self._append_rows('Notes', rows)

        if synced > 0:
            models.mark_notes_synced(note_ids)

        return synced

    def full_sync(self):
        """Perform a full sync of all unsynced data.

        Returns:
            Dictionary with sync results.
        """
        activities_synced = self.sync_activities()
        tasks_synced = self.sync_tasks()
        notes_synced = self.sync_notes()

        return {
            'success': True,
            'activities_synced': activities_synced,
            'tasks_synced': tasks_synced,
            'notes_synced': notes_synced,
            'total_synced': activities_synced + tasks_synced + notes_synced,
            'synced_at': datetime.now().isoformat()
        }
