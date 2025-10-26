# ==========================================================
# 🐔 DATABASE MODULE for Early Bird Flu Detection System
# Using SQLite (Offline, Built-In)
# ==========================================================
import sqlite3
from datetime import datetime
import os

# ------------------------------------------
# 1️⃣ Initialize / Create Database
# ------------------------------------------
DB_NAME = "results.db"

def init_db():
    """Create database and table if not existing."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS analysis_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        temperature REAL NOT NULL,
        result TEXT NOT NULL,
        date TEXT NOT NULL
    )
    ''')
    conn.commit()
    conn.close()

# ------------------------------------------
# 2️⃣ Save New Analysis Result
# ------------------------------------------
def save_result(filename, temperature, result):
    """Insert new detection result into database."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    date_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute('''
    INSERT INTO analysis_results (filename, temperature, result, date)
    VALUES (?, ?, ?, ?)
    ''', (filename, temperature, result, date_now))
    conn.commit()
    conn.close()
    print(f"✅ Saved result: {filename} | {temperature}°C | {result}")

# ------------------------------------------
# 3️⃣ Retrieve All Results
# ------------------------------------------
def get_all_results():
    """Fetch all analysis records."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analysis_results ORDER BY id DESC")
    results = cursor.fetchall()
    conn.close()
    return results

# ------------------------------------------
# 4️⃣ Search by Date or Result
# ------------------------------------------
def search_results(keyword):
    """Search records by date or result text."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
    SELECT * FROM analysis_results
    WHERE date LIKE ? OR result LIKE ?
    ORDER BY id DESC
    ''', (f"%{keyword}%", f"%{keyword}%"))
    results = cursor.fetchall()
    conn.close()
    return results

# ------------------------------------------
# 5️⃣ Delete Record (optional)
# ------------------------------------------
def delete_result(record_id):
    """Delete a record by ID."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM analysis_results WHERE id=?", (record_id,))
    conn.commit()
    conn.close()
    print(f"🗑️ Deleted record ID {record_id}")

# ------------------------------------------
# Auto initialize database on import
# ------------------------------------------
if not os.path.exists(DB_NAME):
    init_db()
    print("📦 Database created successfully!")
else:
    print("✅ Database loaded.")
