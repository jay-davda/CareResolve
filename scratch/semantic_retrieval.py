import numpy as np
import json
from sentence_transformers import SentenceTransformer, util

# ==============================================================================
# 1. Create a 'Solution Bank' (Truncated to 40 for brevity, representing 100+)
# ==============================================================================
# In production, this would be loaded from a database or JSON file.
SOLUTION_BANK = [
    # Packaging Solutions
    {"id": 1, "text": "Check packaging seal integrity logs from the factory.", "tags": ["Packaging", "QA"]},
    {"id": 2, "text": "Dispatch a replacement box with reinforced bubble wrap.", "tags": ["Packaging", "Logistics"]},
    {"id": 3, "text": "Escalate repeating broken bottle issues to Manufacturing Plant B.", "tags": ["Packaging", "Escalation"]},
    {"id": 4, "text": "Review the heat-sealing machine calibration on Line 3.", "tags": ["Packaging", "Machine"]},
    {"id": 5, "text": "Offer customer a 20% discount on next purchase for cosmetic box damage.", "tags": ["Packaging", "CS"]},
    
    # Trade / Shipping Solutions
    {"id": 6, "text": "Contact the regional distributor regarding recurring delay patterns.", "tags": ["Trade", "Logistics"]},
    {"id": 7, "text": "Review tracking info and file a claim with the carrier.", "tags": ["Trade", "Logistics"]},
    {"id": 8, "text": "Expedite a replacement shipment via overnight air.", "tags": ["Trade", "Priority"]},
    {"id": 9, "text": "Audit cold-chain storage conditions at the transit warehouse.", "tags": ["Trade", "Storage"]},
    {"id": 10, "text": "Verify wholesale pricing agreement with the B2B client.", "tags": ["Trade", "B2B"]},
    
    # Product / Quality Solutions
    {"id": 11, "text": "Initiate an emergency product recall protocol for the specified batch.", "tags": ["Product", "Critical"]},
    {"id": 12, "text": "Request the customer to provide the batch number and expiration date.", "tags": ["Product", "Investigation"]},
    {"id": 13, "text": "Send a prepaid return label to retrieve the defective supplement for lab testing.", "tags": ["Product", "QA"]},
    {"id": 14, "text": "Cross-reference the reported allergic reaction against known allergen cross-contamination logs.", "tags": ["Product", "Safety"]},
    {"id": 15, "text": "Instruct customer to immediately cease using the product and consult a physician.", "tags": ["Product", "Medical"]},
    
    # Add 85 more similar granular solutions to reach 100+...
]
# For the sake of the script, extracting just the texts:
solution_texts = [s["text"] for s in SOLUTION_BANK]

# ==============================================================================
# 2. Loading the Pre-Trained Model
# ==============================================================================
# all-MiniLM-L6-v2 is an extremely fast and efficient transformer model 
# specifically fine-tuned for semantic similarity and embedding generation.
print("Loading Sentence-Transformer model (this may take a moment on first run)...")
# Note: You must `pip install sentence-transformers` for this to work.
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Failed to load model. Ensure sentence-transformers is installed: {e}")
    model = None

# Pre-compute embeddings for the entire solution bank.
# In a real app, you compute this ONCE at startup and cache it.
if model:
    print("Pre-computing solution bank embeddings...")
    solution_embeddings = model.encode(solution_texts, convert_to_tensor=True)

# ==============================================================================
# 3. Semantic Retrieval Function
# ==============================================================================
def retrieve_top_solutions(complaint_text: str, top_k: int = 3, is_high_priority: bool = False):
    """
    Uses Cosine Similarity to find the most semantically relevant solutions.
    """
    if not model:
        return ["Model not loaded."]
        
    # 1. Generate an embedding for the incoming complaint
    complaint_embedding = model.encode(complaint_text, convert_to_tensor=True)
    
    # 2. Compute Cosine Similarity between the complaint and ALL solutions
    # This returns a tensor of scores between -1 and 1.
    cosine_scores = util.cos_sim(complaint_embedding, solution_embeddings)[0]
    
    # 3. Find the Top-K highest scores
    # torch.topk returns both the values and the indices
    import torch
    top_results = torch.topk(cosine_scores, k=min(top_k + 5, len(solution_texts))) # get extra for filtering
    
    retrieved_solutions = []
    
    for score, idx in zip(top_results[0], top_results[1]):
        solution = SOLUTION_BANK[idx.item()]
        
        # 4. Integrate Priority Tagging (Requirement #4)
        # If the complaint is High-Priority, we might want to bump solutions 
        # that are tagged as 'Critical', 'Safety', or 'Medical'.
        is_critical_solution = any(tag in solution["tags"] for tag in ["Critical", "Medical", "Safety", "Priority"])
        
        if is_high_priority and is_critical_solution:
            # We explicitly prioritize this one
            retrieved_solutions.insert(0, f"[URGENT] {solution['text']} (Score: {score:.2f})")
        else:
            retrieved_solutions.append(f"{solution['text']} (Score: {score:.2f})")
            
    # Return exactly top_k after priority reshuffling
    return retrieved_solutions[:top_k]

# ==============================================================================
# 5. Testing the Retrieval
# ==============================================================================
if __name__ == "__main__":
    if model:
        print("\n--- Semantic Retrieval Test ---")
        
        test_complaints = [
            ("The supplement pills made my throat swell up.", True),  # High Priority
            ("My shipping box was crushed and the bottle broke.", False), # Medium
        ]
        
        for text, is_high in test_complaints:
            print(f"\nComplaint: '{text}' (High Priority: {is_high})")
            best_solutions = retrieve_top_solutions(text, top_k=3, is_high_priority=is_high)
            for i, sol in enumerate(best_solutions, 1):
                print(f"  {i}. {sol}")
