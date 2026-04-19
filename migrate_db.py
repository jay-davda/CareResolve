import sqlite3

def migrate():
    # Connect to the SQLite database directly
    # Adjust the path if wellsense.db is located somewhere else.
    conn = sqlite3.connect('wellsense.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE complaints ADD COLUMN priority VARCHAR(50);")
        conn.commit()
        print("Successfully added 'priority' column to the 'complaints' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("The 'priority' column already exists in the 'complaints' table.")
        else:
            print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
