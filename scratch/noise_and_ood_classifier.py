import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# ==============================================================================
# 1. Dataset Sample
# ==============================================================================
# In a real system, you'd load this from a CSV.
data = [
    # Noise Examples
    {"text": "Hi there", "intent": "Noise"},
    {"text": "Thanks for the help", "intent": "Noise"},
    {"text": "What time do you open?", "intent": "Noise"},
    {"text": "Okay", "intent": "Noise"},
    {"text": "Bye", "intent": "Noise"},
    {"text": "Hello, is anyone there?", "intent": "Noise"},
    {"text": "Have a good day!", "intent": "Noise"},
    # Complaint Examples
    {"text": "My package arrived damaged.", "intent": "Complaint"},
    {"text": "The bottle was open and spilling everywhere.", "intent": "Complaint"},
    {"text": "I had a severe allergic reaction to your supplement.", "intent": "Complaint"},
    {"text": "Shipping took 4 weeks longer than expected.", "intent": "Complaint"},
    {"text": "The pills taste expired and look weird.", "intent": "Complaint"},
]
df = pd.DataFrame(data)

# ==============================================================================
# 2. Text Preprocessing
# ==============================================================================
def preprocess_text(text: str) -> str:
    """Strips non-informative characters and standardizes text."""
    if not isinstance(text, str):
        return ""
    # Lowercase
    text = text.lower()
    # Remove all non-alphanumeric characters except basic punctuation
    text = re.sub(r'[^a-z0-9\s.,?!]', '', text)
    # Remove excess whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

df['clean_text'] = df['text'].apply(preprocess_text)

# ==============================================================================
# 3. Training Logic (Binary Intent Classifier)
# ==============================================================================
# Using class_weight='balanced' ensures the model doesn't ignore the 'Noise' 
# class even if you have 10,000 complaints and only 100 noise examples.
intent_pipeline = Pipeline([
    ('vectorizer', TfidfVectorizer(stop_words='english', ngram_range=(1, 2))),
    ('classifier', LogisticRegression(class_weight='balanced', max_iter=1000))
])

print("Training Intent Classifier...")
intent_pipeline.fit(df['clean_text'], df['intent'])
print("Training Complete!\n")

# ==============================================================================
# 4. Out-of-Distribution (OOD) Detection Wrapper
# ==============================================================================
# Mock main classification model (Normally this is your TS-14 pipeline)
# For demonstration, we'll pretend we have a trained category model.
mock_category_pipeline = Pipeline([
    ('vectorizer', TfidfVectorizer()),
    ('classifier', LogisticRegression())
])
# Mock fit just to enable predict_proba
mock_category_pipeline.fit(
    ["damaged package", "allergic reaction", "shipping delay"],
    ["Packaging", "Product", "Trade"]
)

def analyze_complaint(input_text: str) -> dict:
    """
    Wraps the Intent Filter, the Main Classifier, and OOD Detection.
    """
    clean_input = preprocess_text(input_text)
    
    # STEP 1: Intent Pre-Filter
    intent_pred = intent_pipeline.predict([clean_input])[0]
    if intent_pred == "Noise":
        return {
            "status": "Ignored",
            "reason": "Classified as General Noise / Non-Complaint",
            "input": input_text
        }
        
    # STEP 2: Main Classification with OOD Detection
    # Instead of predict(), we use predict_proba() to get confidence scores.
    probabilities = mock_category_pipeline.predict_proba([clean_input])[0]
    
    # Get the highest probability and its corresponding class index
    max_prob = np.max(probabilities)
    class_index = np.argmax(probabilities)
    predicted_class = mock_category_pipeline.classes_[class_index]
    
    # OOD Threshold Logic
    CONFIDENCE_THRESHOLD = 0.5
    
    if max_prob < CONFIDENCE_THRESHOLD:
        return {
            "status": "Processed",
            "category": "Miscellaneous",
            "flag": "Low Confidence (OOD) - Needs QA Review",
            "confidence": round(max_prob, 3),
            "input": input_text
        }
    
    return {
        "status": "Processed",
        "category": predicted_class,
        "confidence": round(max_prob, 3),
        "input": input_text
    }

# ==============================================================================
# 5. Testing the Pipeline
# ==============================================================================
if __name__ == "__main__":
    tests = [
        "Hey how are you?",                       # Expected: Noise
        "The safety seal was completely broken.", # Expected: Processed (Packaging)
        "dfg dfkjgh dfgjkh",                      # Expected: Miscellaneous (OOD)
        "Where is your store located?"            # Expected: Noise
    ]
    
    for t in tests:
        print(f"Input: '{t}'")
        res = analyze_complaint(t)
        import json
        print(json.dumps(res, indent=2))
        print("-" * 40)
