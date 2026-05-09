# CareResolve 🚀

An AI-powered customer complaint classification and resolution recommendation platform built during the TarkShaastra 2k26 Hackathon.

## 📌 Problem Statement

Customer support teams often face delays and inefficiencies due to manual complaint handling and prioritization.  
CareResolve solves this problem using Machine Learning to automatically classify complaints, assign priorities, and recommend solutions.

---

## ✨ Features

- AI-based complaint classification
- Automatic priority prediction
- RAG-based solution recommendation
- Human-in-the-loop feedback system
- Explainable AI (XAI)
- Role-Based Access Control (RBAC)
- Real-time SLA analytics dashboard
- Bulk complaint/email processing

---

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- React Router
- Recharts

### Backend
- FastAPI
- Python
- SQLAlchemy

### Database
- SQLite

### AI/ML
- Scikit-learn
- TF-IDF Vectorization
- Logistic Regression
- Cosine Similarity

---

## 🧠 How It Works

1. User submits complaint
2. AI analyzes complaint text
3. System predicts:
   - Complaint category
   - Priority level
4. RAG engine suggests possible solutions
5. Low-confidence predictions are sent to QA review
6. System continuously improves through retraining

---

## 📊 Key Highlights

- Real-time complaint triaging
- Continuous learning AI pipeline
- Explainable predictions
- Live analytics dashboard

---

## 👨‍💻 Team Innovate X

- Rudra — Team Leader
- Deven — Developer
- Dhruvil — Developer
- Jay — Developer

## 🚀 Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📂 Project Structure

```bash
frontend/
backend/
README.md
```

---

## 🌟 Hackathon Details

Project built during:
- TarkShaastra 2k26 Hackathon
- Lakshya 2.0 TechFest
- L.D. College of Engineering, Ahmedabad

---


## 📜 License

This project was built for educational and hackathon purposes.