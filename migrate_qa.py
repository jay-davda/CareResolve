import sqlite3

def migrate():
    conn = sqlite3.connect('wellsense.db')
    cursor = conn.cursor()
    
    # All columns to ensure exist on the complaints table
    columns = [
        ("confidence", "FLOAT"),
        ("is_uncertain", "BOOLEAN DEFAULT 0"),
        ("ai_recommended_action", "TEXT"),
        ("executive_action", "TEXT"),
        ("resolved_at", "DATETIME"),
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE complaints ADD COLUMN {col_name} {col_type};")
            print(f"  + Added column '{col_name}' ({col_type})")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"  = Column '{col_name}' already exists, skipping.")
            else:
                print(f"  ! Error adding '{col_name}': {e}")
    
    conn.commit()
    conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
