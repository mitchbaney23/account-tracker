import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DATABASE_PATH = os.path.join(BASE_DIR, 'data', 'tracker.db')
    GOOGLE_SHEETS_CREDENTIALS_PATH = os.environ.get('GOOGLE_SHEETS_CREDENTIALS_PATH', 'credentials.json')
    GOOGLE_SHEETS_SPREADSHEET_ID = os.environ.get('GOOGLE_SHEETS_SPREADSHEET_ID', '')
