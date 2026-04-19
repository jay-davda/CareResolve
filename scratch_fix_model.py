import requests
import json
import time

def fix_model():
    print("Adding correct label to the learning database...")
    learn_url = "http://127.0.0.1:8000/learn"
    payload = {
        "text": "I used your new wellness supplement yesterday and had a severe allergic reaction. I had to go to the hospital because my throat started closing up. This is extremely dangerous!",
        "category": "Product",
        "priority": "High"
    }
    headers = {"Content-Type": "application/json"}
    
    # 1. Send data to learn
    try:
        response = requests.post(learn_url, json=payload, headers=headers)
        print("Learn response:", response.json())
    except Exception as e:
        print("Error calling /learn:", e)
        return

    # 2. Add some more similar examples to heavily weight it
    extra_payloads = [
        {
            "text": "Severe allergic reaction to the product, went to hospital.",
            "category": "Product",
            "priority": "High"
        },
        {
            "text": "The wellness supplement caused a bad reaction and throat closing.",
            "category": "Product",
            "priority": "High"
        },
        {
            "text": "Allergic reaction dangerous hospital supplement.",
            "category": "Product",
            "priority": "High"
        }
    ]
    for ep in extra_payloads:
        requests.post(learn_url, json=ep, headers=headers)

    print("\nRetraining the models...")
    retrain_url = "http://127.0.0.1:8000/retrain"
    try:
        # Increase timeout just in case training takes a few seconds
        response = requests.post(retrain_url, headers=headers, timeout=30)
        print("Retrain response:", response.json())
    except Exception as e:
        print("Error calling /retrain:", e)
        return
        
    print("\nTesting prediction...")
    predict_url = "http://127.0.0.1:8000/predict"
    test_payload = {"text": "I used your new wellness supplement yesterday and had a severe allergic reaction. I had to go to the hospital because my throat started closing up. This is extremely dangerous!"}
    try:
        response = requests.post(predict_url, json=test_payload, headers=headers)
        print("Predict response:", response.json())
    except Exception as e:
        print("Error calling /predict:", e)

if __name__ == "__main__":
    fix_model()
