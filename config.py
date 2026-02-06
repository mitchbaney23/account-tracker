import os
from datetime import datetime, timezone, timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Central Time (UTC-6 standard, UTC-5 daylight)
CENTRAL_TZ = timezone(timedelta(hours=-6))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DATABASE_URL = os.environ.get('DATABASE_URL', '')
    DATABASE_PATH = os.path.join(BASE_DIR, 'data', 'tracker.db')
    GOOGLE_SHEETS_CREDENTIALS_PATH = os.environ.get('GOOGLE_SHEETS_CREDENTIALS_PATH', 'credentials.json')
    GOOGLE_SHEETS_SPREADSHEET_ID = os.environ.get('GOOGLE_SHEETS_SPREADSHEET_ID', '')
    TIMEZONE = os.environ.get('TIMEZONE', 'US/Central')

    @staticmethod
    def use_postgres():
        return bool(os.environ.get('DATABASE_URL', ''))

    @staticmethod
    def today():
        """Get today's date in Central Time."""
        return datetime.now(CENTRAL_TZ).date()

    @staticmethod
    def now():
        """Get current datetime in Central Time."""
        return datetime.now(CENTRAL_TZ)
