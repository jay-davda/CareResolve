import os
import csv
import random

def generate_mock_data():
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    tsdata_path = os.path.join(data_dir, "tsdata.csv")
    solution_bank_path = os.path.join(data_dir, "solution_bank.csv")
    
    # 1. Generate tsdata.csv
    if not os.path.exists(tsdata_path):
        categories = ['Product', 'Packaging', 'Trade', 'Miscellaneous']
        priorities = ['High', 'Medium', 'Low']
        
        complaint_templates = [
            ("The {product} I received was completely broken and unusable.", "Product", "High"),
            ("The taste of the {product} is awful and seems expired.", "Product", "High"),
            ("I found a foreign object inside the {product}. This is unacceptable.", "Product", "High"),
            ("The packaging for {product} was completely crushed during delivery.", "Packaging", "Medium"),
            ("The seal on the {product} bottle was broken when I opened the box.", "Packaging", "High"),
            ("The label on the {product} is peeling off and unreadable.", "Packaging", "Low"),
            ("The distributor for {product} has not replied to my emails for a week.", "Trade", "Medium"),
            ("My wholesale order of {product} is missing 50 units.", "Trade", "High"),
            ("The pricing on the invoice for {product} does not match our contract.", "Trade", "High"),
            ("I just wanted to ask if {product} is vegan.", "Miscellaneous", "Low"),
            ("Where can I find the nearest store that sells {product}?", "Miscellaneous", "Low"),
            ("Do you offer bulk discounts for {product}?", "Miscellaneous", "Low"),
        ]
        
        products = ["Vitamin C Serum", "Protein Powder", "Herbal Tea", "Face Wash", "Multivitamins", "Shampoo", "Conditioner", "Energy Bar", "Yoga Mat", "Essential Oil"]
        
        with open(tsdata_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['text', 'category', 'priority'])
            
            # Generate 500 rows to ensure good training
            for _ in range(500):
                template, cat, pri = random.choice(complaint_templates)
                product = random.choice(products)
                text = template.format(product=product)
                
                # Add some random noise/variations
                if random.random() > 0.7:
                    text = f"Hello, {text} Please fix this."
                elif random.random() > 0.8:
                    text = f"{text} I want a refund ASAP!"
                    
                writer.writerow([text, cat, pri])
        print(f"Generated {tsdata_path}")

    # 2. Generate solution_bank.csv
    if not os.path.exists(solution_bank_path):
        solutions = [
            ("broken unusable foreign object taste awful expired", "Apologize profusely. Request batch number and photos. Issue immediate full refund and a 20% discount code for their next purchase. Escalate to QA."),
            ("crushed packaging broken seal", "Apologize for the shipping issue. Offer a free replacement immediately. Log the courier service for internal review."),
            ("missing units invoice pricing wholesale", "Assign to the B2B Trade team. Verify the invoice against the contract. If there's a discrepancy, issue a credit note within 24 hours."),
            ("vegan store nearest bulk discount", "Provide a polite informative response. Share links to the FAQ, store locator, and wholesale inquiry form.")
        ]
        
        with open(solution_bank_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['complaint_pattern', 'solution'])
            for pattern, sol in solutions:
                writer.writerow([pattern, sol])
        print(f"Generated {solution_bank_path}")

if __name__ == "__main__":
    generate_mock_data()
