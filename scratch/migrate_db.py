import sqlite3
import os

db_path = "wellsense.db"
if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Add the resolution_source column if it doesn't exist
        cursor.execute("ALTER TABLE complaints ADD COLUMN resolution_source TEXT")
        conn.commit()
        conn.close()
        print("Successfully added resolution_source column to complaints table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column resolution_source already exists.")
        else:
            print(f"Error updating database: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
else:
    print("wellsense.db not found. It will be created on next startup.")
