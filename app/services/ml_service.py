from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pandas as pd
import os
import csv

from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from app.services.dataset_service import load_dataset

# Global variables to cache our models and vectorizer
# This ensures we only train them once (lazy loading)
_vectorizer = None
_category_model = None
_priority_model = None
_is_trained = False
_solution_bank = None # Cache for RAG
_solution_vectors = None

def train_models():
    """
    Loads the dataset, trains Logistic Regression models for category and priority
    classification, and stores them in global variables for future predictions.
    """
    global _vectorizer, _category_model, _priority_model, _is_trained
    
    # If already trained, skip to avoid redundant work
    if _is_trained:
        return
        
    print("Initializing machine learning pipeline...")
    
    # 1. Get the FULL dataset using the existing dataset service
    df = load_dataset()
    
    # 1b. Check for and append new learned data
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    new_data_path = os.path.join(BASE_DIR, "data", "new_data.csv")
    if os.path.exists(new_data_path):
        try:
            new_df = pd.read_csv(new_data_path)
            if not new_df.empty:
                df = pd.concat([df, new_df], ignore_index=True)
                print(f"Loaded {len(new_df)} new learned records from new_data.csv.")
        except Exception as e:
            print(f"Error loading new_data.csv: {e}")
            
    # 1c. Check for and append QA ground truth dataset
    qa_data_path = os.path.join(BASE_DIR, "data", "ground_truth_dataset.csv")
    if os.path.exists(qa_data_path):
        try:
            qa_df = pd.read_csv(qa_data_path)
            if not qa_df.empty:
                # Map 'corrected_category' to 'category' so the model can learn the true label
                qa_df_mapped = pd.DataFrame({
                    'text': qa_df['text'],
                    'category': qa_df['corrected_category'],
                    'priority': 'Medium' # Placeholder since QA currently only corrects category
                })
                df = pd.concat([df, qa_df_mapped], ignore_index=True)
                print(f"Loaded {len(qa_df)} ground truth records from QA team.")
        except Exception as e:
            print(f"Error loading ground_truth_dataset.csv: {e}")
            
    if df is None or df.empty:
        print("Warning: Dataset could not be loaded or is empty. ML training aborted.")
        return
        
    # Drop rows that are missing necessary columns to prevent training errors
    df = df.dropna(subset=['text', 'category', 'priority'])
    
    # Convert text column to strings just in case
    df['text'] = df['text'].astype(str)
    
    num_rows = len(df)
    if num_rows == 0:
        print("Warning: No valid data available for training.")
        return

    print(f" Training models on the FULL dataset: {num_rows} rows...")

    # 2. Setup TF-IDF Vectorizer with n-grams for much higher accuracy
    # ngram_range=(1, 2) means it looks at single words AND two-word phrases
    _vectorizer = TfidfVectorizer(stop_words='english', max_features=10000, ngram_range=(1, 2))
    
    # Transform all text data into our feature matrix X
    X = _vectorizer.fit_transform(df['text'])
    
    # Target variables
    y_category = df['category']
    y_priority = df['priority']
    
    # 3. Train Category Model
    # Split into train/test (80% training, 20% testing)
    X_train_cat, X_test_cat, y_train_cat, y_test_cat = train_test_split(
        X, y_category, test_size=0.2, random_state=42
    )
    
    # Using class_weight='balanced' to handle any imbalanced classes better
    _category_model = LogisticRegression(max_iter=1000, class_weight='balanced', C=2.0)
    _category_model.fit(X_train_cat, y_train_cat)
    
    cat_preds = _category_model.predict(X_test_cat)
    cat_acc = accuracy_score(y_test_cat, cat_preds)
    print(f"✅ Category Model Accuracy (Tested on {X_test_cat.shape[0]} rows): {cat_acc:.2%}")

    # 4. Train Priority Model
    X_train_pri, X_test_pri, y_train_pri, y_test_pri = train_test_split(
        X, y_priority, test_size=0.2, random_state=42
    )
    
    _priority_model = LogisticRegression(max_iter=1000, class_weight='balanced', C=2.0)
    _priority_model.fit(X_train_pri, y_train_pri)
    
    pri_preds = _priority_model.predict(X_test_pri)
    pri_acc = accuracy_score(y_test_pri, pri_preds)
    print(f"✅ Priority Model Accuracy (Tested on {X_test_pri.shape[0]} rows): {pri_acc:.2%}")
    
    _is_trained = True
    
    # Sync RAG vectors with the new vectorizer to avoid dimensionality mismatch
    _load_solution_bank()
    
    print("🚀 Models successfully trained and cached in memory!")

# Keywords that identify non-complaint noise inputs.
# Add more patterns here as needed.
_NOISE_PATTERNS = [
    "hi", "hello", "hey", "thanks", "thank you", "bye", "goodbye",
    "good morning", "good evening", "okay", "ok", "sure", "what time",
    "do you open", "are you open", "how are you", "who are you",
    "what is your", "can i ask", "just checking", "is anyone there",
    "have a good", "great job", "nice work"
]

# Minimum confidence threshold for a valid prediction.
# If the model isn't at least this confident, it flags the input for QA.
CONFIDENCE_THRESHOLD = 0.75

def is_noise(text: str) -> bool:
    """
    Fast keyword-based pre-filter to detect greetings and non-complaint inputs,
    preventing them from being classified as complaints.
    """
    text_lower = text.lower().strip()
    for pattern in _NOISE_PATTERNS:
        if text_lower.startswith(pattern) or text_lower == pattern:
            return True
    # Very short texts are likely noise (less than 4 words)
    if len(text_lower.split()) < 4:
        return True
    return False

import re

def extract_main_complaint(text: str) -> str:
    """
    Strips out common email boilerplate (Date, Customer Name, Account Number, Greetings)
    to isolate the actual complaint content.
    """
    # Remove Date block
    text = re.sub(r"(?i)Date:\s*.*?(?=Customer Name:|$)", "", text)
    # Remove Customer Name block
    text = re.sub(r"(?i)Customer Name:\s*.*?(?=Account/Order Number:|Account Number:|$)", "", text)
    # Remove Account/Order Number block
    text = re.sub(r"(?i)Account(?:/Order)? Number:\s*[A-Za-z0-9-]+\s*", "", text)
    
    # Remove greetings
    greetings = [
        r"(?i)To the Customer Service Team,?",
        r"(?i)Dear Customer Service,?",
        r"(?i)To Whom It May Concern,?",
        r"(?i)Hi Support Team,?",
        r"(?i)Hello,?",
        r"(?i)Hi,?"
    ]
    for g in greetings:
        text = re.sub(g, "", text)
        
    return text.strip()

def _load_solution_bank():
    """
    Loads the solution bank CSV and pre-calculates TF-IDF vectors for RAG.
    """
    global _solution_bank, _solution_vectors, _vectorizer, _is_trained
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    sb_path = os.path.join(BASE_DIR, "data", "solution_bank.csv")
    
    if os.path.exists(sb_path):
        try:
            _solution_bank = pd.read_csv(sb_path)
            # Ensure we have a vectorizer (either from train_models or initial load)
            if _vectorizer is not None:
                _solution_vectors = _vectorizer.transform(_solution_bank['complaint_pattern'])
                print(f"✅ RAG Knowledge Base loaded: {len(_solution_bank)} solutions.")
            else:
                # If no vectorizer yet, we can't vectorize solutions. 
                # They will be vectorized during the first train_models() call.
                pass
        except Exception as e:
            print(f"Error loading solution_bank.csv: {e}")
    else:
        print(f"Warning: solution_bank.csv not found at {sb_path}")

# Initial load of solution bank
_load_solution_bank()

def get_rag_solutions(text: str, top_k: int = 3):
    """
    Retrieves the most relevant solutions from the knowledge base using RAG (Cosine Similarity).
    """
    global _solution_bank, _solution_vectors, _vectorizer
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    sb_path = os.path.join(BASE_DIR, "data", "solution_bank.csv")
    
    # Lazy load the solution bank
    if _solution_bank is None:
        if os.path.exists(sb_path):
            _solution_bank = pd.read_csv(sb_path)
            # Pre-vectorize the patterns
            if _vectorizer:
                _solution_vectors = _vectorizer.transform(_solution_bank['complaint_pattern'])
        else:
            return ["No solution bank found. Please contact support."]

    if _solution_vectors is None or _vectorizer is None:
        return ["RAG Engine not initialized."]

    # Vectorize the input text
    input_vector = _vectorizer.transform([text])
    
    # Calculate cosine similarity
    similarities = cosine_similarity(input_vector, _solution_vectors).flatten()
    
    # Get top_k indices
    top_indices = similarities.argsort()[-top_k:][::-1]
    
    solutions = []
    for idx in top_indices:
        # Only include if similarity is reasonable (> 0.1)
        if similarities[idx] > 0.1:
            solutions.append(_solution_bank.iloc[idx]['solution'])
            
    if not solutions:
        return ["No specific recommendation found. Escalating to manual review."]
        
    return solutions

def predict(text: str) -> dict:
    """
    Takes a complaint string and predicts its category and priority.
    Includes:
    - Noise pre-filter (greetings, short texts)
    - OOD (Out-of-Distribution) detection via predict_proba confidence check
    """
    # Lazy load/train the models if they haven't been already
    if not _is_trained:
        train_models()
        
    # Handle empty or invalid inputs safely
    if not text or not text.strip() or not _is_trained:
        return {
            "status": "error",
            "category": "Unknown",
            "priority": "Unknown",
            "recommended_solutions": [],
            "flag": None
        }
        
    # Pre-process text to remove noise/metadata
    text = extract_main_complaint(text)
    
    # --- STEP 1: Noise Pre-Filter ---
    # Catches greetings and short irrelevant inputs before they reach the ML model.
    if is_noise(text):
        return {
            "status": "ignored",
            "category": "Not a Complaint",
            "priority": "N/A",
            "recommended_solutions": ["This input appears to be a greeting or general inquiry, not a complaint."],
            "flag": "noise"
        }

    # --- STEP 2: Transform text using the TF-IDF Vectorizer ---
    X_input = _vectorizer.transform([text])

    # --- STEP 3: OOD Detection via predict_proba ---
    # Instead of predict(), we use predict_proba() which returns the confidence
    # score for every possible class. This lets us detect low-confidence predictions.
    import numpy as np
    
    cat_probs = _category_model.predict_proba(X_input)[0]
    pri_probs = _priority_model.predict_proba(X_input)[0]
    
    cat_max_confidence = float(np.max(cat_probs))
    pri_max_confidence = float(np.max(pri_probs))
    
    cat_class_idx = int(np.argmax(cat_probs))
    pri_class_idx = int(np.argmax(pri_probs))
    
    predicted_cat = _category_model.classes_[cat_class_idx]
    predicted_pri = _priority_model.classes_[pri_class_idx]
    
    # --- STEP 4: Generate RAG-based Recommended Solutions ---
    solutions = get_rag_solutions(text)
    
    if "high" in predicted_pri.lower() or "critical" in predicted_pri.lower():
        solutions.insert(0, "🚨 URGENT: Escalate to manager within 24 hours")

    # If confidence is too low, route to manual QA instead of guessing
    if cat_max_confidence < CONFIDENCE_THRESHOLD:
        return {
            "status": "review",
            "category": "Miscellaneous",
            "priority": predicted_pri,
            "confidence": round(cat_max_confidence, 2),
            "recommended_solutions": solutions, # Show RAG solutions even in review mode
            "flag": "low_confidence"
        }

    return {
        "status": "ok",
        "category": predicted_cat,
        "priority": predicted_pri,
        "confidence": round(cat_max_confidence, 2),
        "recommended_solutions": solutions,
        "flag": None
    }


def learn(text: str, category: str = None, priority: str = None):
    """
    Appends a new complaint to data/new_data.csv for future learning.
    """
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    new_data_path = os.path.join(data_dir, "new_data.csv")
    
    file_exists = os.path.isfile(new_data_path)
    
    with open(new_data_path, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['text', 'category', 'priority'])
        writer.writerow([text, category, priority])
        
    return {"message": "Data stored successfully for future training"}

def retrain_models():
    """
    Forces a retraining of the ML models using both the original dataset
    and any new data collected in new_data.csv.
    """
    global _is_trained
    _is_trained = False
    
    print("Starting retraining process...")
    train_models()
    
    return {"message": "Models retrained successfully"}

def cluster_complaints(texts: list[str]) -> list[dict]:
    """
    Uses DBSCAN with cosine distance on TF-IDF embeddings to discover
    semantic clusters (Recurring Issues) in a list of texts.
    Returns a list of clusters sorted by size.
    """
    if not texts or len(texts) < 2:
        return []
        
    # Ensure models (and vectorizer) are loaded
    if not _is_trained:
        train_models()
        
    from sklearn.cluster import DBSCAN
    
    # Transform texts into embeddings
    X = _vectorizer.transform(texts)
    
    # DBSCAN: cosine distance is excellent for sparse TF-IDF vectors
    # eps=0.4 means texts must have at least 60% cosine similarity to be clustered
    # min_samples=2 means at least 2 similar complaints form a cluster
    clustering = DBSCAN(eps=0.4, min_samples=2, metric='cosine')
    labels = clustering.fit_predict(X)
    
    clusters = {}
    for i, label in enumerate(labels):
        if label == -1:
            # -1 is noise (does not belong to any dense cluster)
            continue
            
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(texts[i])
        
    # Format output: list of dicts, sorted by density (largest cluster first)
    result = []
    for label, items in clusters.items():
        result.append({
            "cluster_id": int(label),
            "size": len(items),
            "representative_samples": items[:3] # Show up to 3 examples
        })
        
    result.sort(key=lambda x: x["size"], reverse=True)
    return result

def explain_prediction(text: str) -> dict:
    """
    Provides explainability metrics for a given complaint prediction.
    Extracts top supporting and mismatched keywords based on TF-IDF weights.
    """
    if not _is_trained:
        train_models()
        
    if not _is_trained or not text:
        return {
            "primary": {"category": "Unknown", "confidence": 0.0},
            "alternatives": [],
            "supporting_keywords": [],
            "mismatched_keywords": [],
            "explanation": "Model not trained or input invalid."
        }
        
    import numpy as np
    
    text = extract_main_complaint(text)
    X_input = _vectorizer.transform([text])
    cat_probs = _category_model.predict_proba(X_input)[0]
    
    top_indices = np.argsort(cat_probs)[::-1]
    
    primary = {"category": _category_model.classes_[top_indices[0]], "confidence": float(cat_probs[top_indices[0]])}
    alternatives = [{"category": _category_model.classes_[i], "confidence": float(cat_probs[i])} for i in top_indices[1:4]]
    
    feature_names = _vectorizer.get_feature_names_out()
    coef = _category_model.coef_[top_indices[0]]
    
    non_zero_idx = X_input.nonzero()[1]
    word_weights = []
    for idx in non_zero_idx:
        word_weights.append({
            "word": feature_names[idx],
            "weight": float(coef[idx])
        })
        
    word_weights.sort(key=lambda x: x["weight"], reverse=True)
    
    supporting_keywords = [w["word"] for w in word_weights if w["weight"] > 0][:5]
    # Lowest weights are the most conflicting/mismatched keywords
    mismatched_keywords = [w["word"] for w in word_weights if w["weight"] < 0]
    mismatched_keywords = mismatched_keywords[-5:] if mismatched_keywords else []
    
    if supporting_keywords:
        explanation = f"The AI categorized this as '{primary['category']}' primarily due to keywords like: {', '.join(supporting_keywords)}."
    else:
        explanation = f"The AI categorized this as '{primary['category']}' based on general contextual patterns."
        
    return {
        "primary": primary,
        "alternatives": alternatives,
        "supporting_keywords": supporting_keywords,
        "mismatched_keywords": mismatched_keywords,
        "explanation": explanation
    }
