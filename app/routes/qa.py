from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import csv
import pandas as pd
from sklearn.metrics import precision_recall_fscore_support

from app.database import get_db
from app.services.auth_service import requires_role
from app.services import ml_service
from app.models.user import User
from app.models.complaint import Complaint
from app.schemas.complaint import ComplaintResponse, QACorrectionRequest

router = APIRouter(prefix="/qa", tags=["Quality Assurance"])


@router.get("/uncertain-complaints", response_model=List[ComplaintResponse])
def get_uncertain_complaints(db: Session = Depends(get_db), current_user: User = Depends(requires_role("qa"))):
    """
    Returns complaints flagged as uncertain (confidence < threshold) for QA review.
    """
    complaints = db.query(Complaint).filter(Complaint.is_uncertain == True).order_by(Complaint.created_at.desc()).all()
    
    result = []
    for c in complaints:
        exp = ml_service.explain_prediction(c.description)
        c_dict = ComplaintResponse.model_validate(c).model_dump()
        c_dict["explanation"] = exp["explanation"]
        c_dict["alternatives"] = exp["alternatives"]
        c_dict["supporting_keywords"] = exp["supporting_keywords"]
        c_dict["mismatched_keywords"] = exp["mismatched_keywords"]
        result.append(c_dict)
        
    return result


@router.post("/corrections/{complaint_id}")
def submit_qa_correction(
    complaint_id: int, 
    payload: QACorrectionRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: User = Depends(requires_role("qa"))
):
    """
    Accepts a corrected category from the QA team.
    Updates the database and logs to ground_truth_dataset.csv for retraining.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    original_category = complaint.category
    
    # Update database
    complaint.category = payload.corrected_category
    complaint.is_uncertain = False
    complaint.status = "Reviewed"
    db.commit()
    
    # Log to ground_truth_dataset.csv
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, "ground_truth_dataset.csv")
    
    file_exists = os.path.isfile(csv_path)
    with open(csv_path, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['text', 'original_prediction', 'corrected_category'])
        writer.writerow([complaint.description, original_category, payload.corrected_category])
        
    # Trigger background retraining immediately after a correction
    background_tasks.add_task(ml_service.retrain_models)
        
    return {"message": "Correction saved and logged. AI retraining triggered."}


@router.get("/recurring-issues")
def get_recurring_issues(db: Session = Depends(get_db), current_user: User = Depends(requires_role("qa"))):
    """
    Returns list of recurring complaint issues discovered via Semantic Clustering.
    """
    # 1. Fetch all complaint texts from the database
    complaints = db.query(Complaint.description).filter(Complaint.description.isnot(None)).all()
    texts = [c[0] for c in complaints if c[0] and len(c[0].strip()) > 5]
    
    if not texts:
        return {
            "recurring_issues": [],
            "message": "Not enough data to run semantic clustering."
        }
    
    # 2. Run DBSCAN semantic clustering
    clusters = ml_service.cluster_complaints(texts)
    
    # 3. Format the clusters for the frontend
    recurring_issues = []
    for cluster in clusters:
        # Generate a summarized "issue name" based on the first sample
        # (A real system might use an LLM here, but we will truncate the first sample)
        sample = cluster["representative_samples"][0]
        issue_name = sample[:60] + "..." if len(sample) > 60 else sample
        
        recurring_issues.append({
            "issue": issue_name,
            "count": cluster["size"],
            "samples": cluster["representative_samples"]
        })
        
    return {
        "role_verified": current_user.role.value,
        "recurring_issues": recurring_issues,
        "message": f"DBSCAN clustering discovered {len(recurring_issues)} recurring issues."
    }


@router.get("/accuracy")
def get_model_accuracy(current_user: User = Depends(requires_role("qa"))):
    """
    Calculates real-time precision, recall, and f1-score using sklearn 
    based on the ground_truth_dataset.csv.
    """
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    csv_path = os.path.join(BASE_DIR, "data", "ground_truth_dataset.csv")
    
    if not os.path.exists(csv_path):
        return {
            "message": "No QA corrections found yet.",
            "metrics": None
        }
        
    df = pd.read_csv(csv_path)
    if df.empty or len(df) < 2:
        return {
            "message": "Not enough data to calculate metrics.",
            "metrics": None
        }
        
    y_true = df['corrected_category']
    y_pred = df['original_prediction']
    
    # Calculate metrics with zero_division handled
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average='weighted', zero_division=0
    )
    
    return {
        "message": "Real-time accuracy computed from ground truth dataset.",
        "metrics": {
            "precision": f"{precision:.1%}",
            "recall": f"{recall:.1%}",
            "f1_score": f"{f1:.1%}",
            "total_reviews": len(df)
        }
    }


@router.get("/trends")
def get_complaint_trends(db: Session = Depends(get_db), current_user: User = Depends(requires_role("qa"))):
    """
    Returns real-time complaint category trend data from the database.
    Groups complaints by their actual created_at date.
    """
    from datetime import datetime, timedelta
    from collections import defaultdict
    import statistics
    
    categories = ["Product", "Packaging", "Trade", "Miscellaneous"]
    
    # 1. Fetch all complaints with their creation dates
    complaints = db.query(Complaint).filter(Complaint.created_at.isnot(None)).all()
    
    if not complaints:
        return {
            "time_series": [],
            "alerts": [],
            "period": "No data",
            "message": "No complaints found in database."
        }
    
    # 2. Group complaints by actual created_at date and category
    daily_data = defaultdict(lambda: {cat: 0 for cat in categories})
    for c in complaints:
        date_key = c.created_at.strftime("%Y-%m-%d")
        cat = c.category if c.category in categories else "Miscellaneous"
        daily_data[date_key][cat] += 1
    
    # 3. Build continuous date range from earliest complaint to today
    sorted_dates = sorted(daily_data.keys())
    start_date = datetime.strptime(sorted_dates[0], "%Y-%m-%d").date()
    end_date = datetime.now().date()
    
    time_series = []
    history_stats = {cat: [] for cat in categories}
    
    current = start_date
    while current <= end_date:
        date_str_key = current.strftime("%Y-%m-%d")
        display_date = current.strftime("%b %d")
        
        day_counts = daily_data.get(date_str_key, {cat: 0 for cat in categories})
        
        for cat in categories:
            history_stats[cat].append(day_counts.get(cat, 0))
        
        time_series.append({
            "date": display_date,
            **{cat: day_counts.get(cat, 0) for cat in categories}
        })
        current += timedelta(days=1)
    
    # 4. Anomaly detection: flag today if any category exceeds 1.5 std devs
    alerts = []
    today_key = datetime.now().strftime("%Y-%m-%d")
    today_counts = daily_data.get(today_key, {cat: 0 for cat in categories})
    
    for cat in categories:
        historical = history_stats[cat][:-1]  # exclude today
        if len(historical) < 2:
            continue
            
        mean = statistics.mean(historical)
        stdev = statistics.stdev(historical)
        today_val = today_counts.get(cat, 0)
        threshold = mean + (1.5 * stdev)
        
        if today_val > threshold and today_val > 0:
            alerts.append({
                "category": cat,
                "message": f"🚨 Trend Alert: '{cat}' complaints spiked to {today_val} today. (Historical Average: {mean:.1f}, Threshold: {threshold:.1f})"
            })
    
    return {
        "time_series": time_series,
        "alerts": alerts,
        "period": f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}",
        "message": "Trend data based on actual complaint creation dates."
    }


@router.get("/consistency")
def get_consistency_metrics(db: Session = Depends(get_db), current_user: User = Depends(requires_role("qa"))):
    """
    Calculates Classification & Resolution Consistency metrics.
    Compares AI Recommended Action vs Actual Executive Action.
    Returns Variance Score and SLA Correlation data.
    """
    from difflib import SequenceMatcher
    from datetime import timedelta
    
    # Fetch resolved complaints that have both AI and executive actions
    resolved = db.query(Complaint).filter(
        Complaint.status == "Resolved",
        Complaint.ai_recommended_action.isnot(None),
        Complaint.executive_action.isnot(None)
    ).order_by(Complaint.resolved_at.desc()).all()
    
    if not resolved:
        return {
            "message": "No resolved complaints with action tracking yet.",
            "comparison_table": [],
            "variance_score": None,
            "sla_correlation": None
        }
    
    comparison_table = []
    followed_count = 0
    ignored_count = 0
    followed_times = []
    ignored_times = []
    
    for c in resolved:
        # Fuzzy match: check if exec action is similar to any AI recommendation
        ai_actions = c.ai_recommended_action or ""
        exec_action = c.executive_action or ""
        
        # Calculate similarity ratio between exec action and AI recommendations
        similarity = SequenceMatcher(None, ai_actions.lower(), exec_action.lower()).ratio()
        followed = similarity > 0.3  # 30% similarity threshold (generous for partial matches)
        
        # Calculate resolution time
        resolution_hours = None
        if c.resolved_at and c.created_at:
            delta = c.resolved_at - c.created_at
            resolution_hours = round(delta.total_seconds() / 3600, 1)
            
            if followed:
                followed_times.append(resolution_hours)
            else:
                ignored_times.append(resolution_hours)
        
        if followed:
            followed_count += 1
        else:
            ignored_count += 1
            
        comparison_table.append({
            "id": c.id,
            "title": c.title,
            "ai_recommended": ai_actions[:100] + "..." if len(ai_actions) > 100 else ai_actions,
            "executive_action": exec_action,
            "match": followed,
            "similarity": f"{similarity:.0%}",
            "resolution_hours": resolution_hours
        })
    
    total = followed_count + ignored_count
    variance_pct = round((ignored_count / total) * 100, 1) if total > 0 else 0
    
    avg_followed = round(sum(followed_times) / len(followed_times), 1) if followed_times else None
    avg_ignored = round(sum(ignored_times) / len(ignored_times), 1) if ignored_times else None
    
    return {
        "message": f"Consistency analysis across {total} resolved complaints.",
        "comparison_table": comparison_table,
        "variance_score": {
            "total_resolved": total,
            "ai_followed": followed_count,
            "ai_ignored": ignored_count,
            "variance_percentage": variance_pct,
            "interpretation": "High variance — executives may need training or AI recommendations need improvement." if variance_pct > 40 else "Good consistency — executives are largely following AI guidance."
        },
        "sla_correlation": {
            "avg_hours_ai_followed": avg_followed,
            "avg_hours_ai_ignored": avg_ignored,
            "insight": f"Cases following AI advice resolve in {avg_followed}h vs {avg_ignored}h when ignored." if avg_followed and avg_ignored else "Not enough data for SLA comparison yet."
        }
    }
