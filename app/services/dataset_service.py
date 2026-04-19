import pandas as pd
import os

# Global cache variable
_dataset_df = None

def load_dataset():
    """
    Load dataset from CSV and cache it in memory.
    """
    global _dataset_df

    # If already loaded, return cached data
    if _dataset_df is not None:
        return _dataset_df

    # 🔥 Correct path handling (VERY IMPORTANT)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    # BASE_DIR is y:\CareResolve_AI
    filepath = os.path.join(BASE_DIR, "data", "tsdata.csv")

    try:
        # Read CSV file
        _dataset_df = pd.read_csv(filepath)

        # Replace NaN with None (for JSON compatibility)
        _dataset_df = _dataset_df.astype(object).where(pd.notnull(_dataset_df), None)

        # Debug print (you can remove later)
        print("✅ DATA LOADED:", _dataset_df.shape)

        return _dataset_df

    except FileNotFoundError:
        print(f"❌ Dataset file not found at: {filepath}")
        return pd.DataFrame()

    except Exception as e:
        print(f"❌ Error loading dataset: {e}")
        return pd.DataFrame()


def get_all_records():
    """
    Return all records from dataset.
    """
    df = load_dataset()
    return df.to_dict(orient="records")


def get_records_by_category(category):
    """
    Return records filtered by category (case-insensitive).
    """
    df = load_dataset()

    if df.empty or "category" not in df.columns:
        return []

    filtered_df = df[df["category"].str.lower() == category.lower()]
    return filtered_df.to_dict(orient="records")


def get_sample_records(limit=10):
    """
    Return sample records (default: 10 rows).
    """
    df = load_dataset()

    if df.empty:
        return []

    return df.head(limit).to_dict(orient="records")