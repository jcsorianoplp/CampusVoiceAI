# ai_classifier_api.py - Complete AI Classifier API for AdminAICategories.html

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import sqlite3
import requests
import json
import re
import uuid
from pathlib import Path

# ============ CONFIGURATION ============
OPENROUTER_API_KEY = "sk-XDA6pyWv67P0DRi5ay5W6CbS0yigJJyDv6U6YszQWYe1dlcA"
MODEL = "ling-2.6-flash:free"
OPENROUTER_URL = "https://api.routeway.ai/v1/chat/completions"

# ============ FASTAPI SETUP ============
app = FastAPI(title="Campus Voice AI - AI Classifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ DATABASE SETUP ============
DB_PATH = "ai_classifier.db"

def init_database():
    """Initialize all tables for AI classifier"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Categories table (dynamic, matches AdminAICategories UI)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            priority TEXT DEFAULT 'medium',
            route TEXT DEFAULT 'Student Affairs',
            sla TEXT DEFAULT '24h',
            confidence INTEGER DEFAULT 84,
            volume INTEGER DEFAULT 0,
            keywords TEXT DEFAULT '[]',
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # AI Rules table (thresholds and toggles)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            routing_threshold INTEGER DEFAULT 80,
            uncertain_queue INTEGER DEFAULT 1,
            public_sync INTEGER DEFAULT 1,
            keyword_boost INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Low confidence review queue
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_queue (
            id TEXT PRIMARY KEY,
            suggestion_text TEXT NOT NULL,
            original_suggestion_id INTEGER,
            predicted_category TEXT NOT NULL,
            confidence REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Suggestions table (stores all submissions with AI results)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            suggestion_text TEXT NOT NULL,
            category TEXT NOT NULL,
            confidence REAL NOT NULL,
            needs_review INTEGER DEFAULT 0,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            reviewed_by_admin TEXT
        )
    ''')
    
    # Insert default categories if empty
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        default_categories = [
            ("Campus Wellness", "medium", "Student Affairs", "24h", 84, '["mental", "health", "counseling", "stress", "wellbeing"]'),
            ("Facilities", "high", "Facilities Team", "12h", 92, '["ac", "aircon", "lighting", "repair", "maintenance", "broken"]'),
            ("Academic Support", "medium", "Academic Office", "24h", 86, '["tutoring", "homework", "study", "library", "books", "professor"]'),
            ("Campus Safety", "high", "Campus Security", "12h", 94, '["security", "gate", "safety", "emergency", "guard", "crime"]'),
            ("Student Services", "low", "Student Affairs", "48h", 76, '["registration", "enrollment", "id", "card", "office", "queue"]'),
            ("Food Services", "medium", "Facilities Team", "24h", 88, '["canteen", "food", "meal", "cafeteria", "hungry", "lunch"]'),
        ]
        cursor.executemany('''
            INSERT INTO categories (name, priority, route, sla, confidence, keywords)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', default_categories)
    
    # Insert default AI rules
    cursor.execute("SELECT COUNT(*) FROM ai_rules")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO ai_rules (routing_threshold, uncertain_queue, public_sync, keyword_boost)
            VALUES (80, 1, 1, 1)
        ''')
    
    conn.commit()
    conn.close()

init_database()

# ============ PYDANTIC MODELS ============

class CategoryCreate(BaseModel):
    name: str
    priority: str = "medium"
    route: str = "Student Affairs"
    sla: str = "24h"
    confidence: int = 84
    keywords: List[str] = []

class CategoryUpdate(BaseModel):
    priority: Optional[str] = None
    route: Optional[str] = None
    sla: Optional[str] = None
    confidence: Optional[int] = None
    keywords: Optional[List[str]] = None
    is_active: Optional[int] = None

class AIRulesUpdate(BaseModel):
    routing_threshold: Optional[int] = None
    uncertain_queue: Optional[int] = None
    public_sync: Optional[int] = None
    keyword_boost: Optional[int] = None

class SuggestionClassify(BaseModel):
    text: str
    title: Optional[str] = ""

class ReviewApply(BaseModel):
    review_id: str
    new_category: str

class TestInput(BaseModel):
    text: str

class SyncCategoryItem(BaseModel):
    name: str
    priority: str
    route: str
    sla: str
    confidence: int
    keywords: List[str] = []

# ============ AI CLASSIFICATION FUNCTION ============

def call_ling_ai(prompt: str) -> str:
    """Call Ling-2.6-flash via OpenRouter"""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}]
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(OPENROUTER_URL, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]

def get_categories_from_db() -> List[Dict]:
    """Fetch all active categories from database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories WHERE is_active = 1 ORDER BY priority = 'high' DESC, confidence DESC")
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Parse JSON keywords for each category
    for cat in categories:
        cat['keywords'] = json.loads(cat['keywords']) if cat['keywords'] else []
    
    return categories

def get_ai_rules() -> Dict:
    """Get current AI rules from database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ai_rules ORDER BY id DESC LIMIT 1")
    rules = dict(cursor.fetchone())
    conn.close()
    return rules

def categorize_suggestion(text: str, categories: List[Dict], rules: Dict) -> Dict:
    """
    Classify a suggestion using AI + keyword hints from categories
    Returns: {category, confidence, needs_review}
    """
    
    # Build category list for AI prompt
    category_names = [cat['name'] for cat in categories]
    category_keywords_hints = "\n".join([
        f"- {cat['name']}: {', '.join(cat.get('keywords', [])[:5])}" 
        for cat in categories if cat.get('keywords')
    ])
    
    prompt = f"""You are a campus suggestion classifier. Analyze this student suggestion and return ONLY valid JSON.

Student Suggestion: "{text}"

Available Categories (choose exactly one):
{', '.join(category_names)}

Keyword Hints (use these as guidance, not strict rules):
{category_keywords_hints if category_keywords_hints else "No keyword hints provided"}

Return ONLY this JSON format (no other text):
{{
    "category": "exact category name from the list above",
    "confidence": 85
}}

Confidence should be 0-100. Higher means more certain.
If unsure which category fits best, confidence should be below 70."""

    try:
        response = call_ling_ai(prompt)
        
        # Clean response
        response = response.strip()
        if response.startswith('```json'):
            response = response[7:]
        if response.startswith('```'):
            response = response[3:]
        if response.endswith('```'):
            response = response[:-3]
        response = response.strip()
        
        result = json.loads(response)
        category = result.get("category", categories[0]['name'] if categories else "General")
        confidence = float(result.get("confidence", 75))
        
        # Validate category exists
        valid_categories = [c['name'] for c in categories]
        if category not in valid_categories:
            category = valid_categories[0] if valid_categories else "General"
            confidence = 65
        
    except Exception as e:
        print(f"AI Error: {e}")
        # Fallback to keyword matching
        category, confidence = fallback_classify(text, categories)
    
    # Check if needs manual review
    threshold = rules.get('routing_threshold', 80)
    needs_review = confidence < threshold
    
    return {
        "category": category,
        "confidence": confidence,
        "needs_review": needs_review
    }

def fallback_classify(text: str, categories: List[Dict]) -> tuple:
    """Keyword-matching fallback using category keywords"""
    text_lower = text.lower()
    
    if not categories:
        return "General", 50
    
    best_category = categories[0]['name']
    best_score = 0
    
    for category in categories:
        keywords = category.get('keywords', [])
        score = sum(1 for kw in keywords if kw.lower() in text_lower)
        if score > best_score:
            best_score = score
            best_category = category['name']
    
    # Calculate confidence based on match quality
    confidence = min(85, 60 + (best_score * 8))
    
    return best_category, confidence

# ============ API ENDPOINTS ============

@app.get("/")
async def root():
    return {
        "name": "Campus Voice AI - AI Classifier API",
        "version": "2.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# ============ CATEGORY MANAGEMENT ============

@app.get("/categories")
async def get_categories():
    """Get all categories (matches AdminAICategories display)"""
    categories = get_categories_from_db()
    rules = get_ai_rules()
    
    # Calculate stats for UI
    active_count = len(categories)
    avg_confidence = sum(c['confidence'] for c in categories) / active_count if active_count > 0 else 0
    routed_count = sum(1 for c in categories if c['confidence'] >= rules.get('routing_threshold', 80))
    auto_routed_rate = (routed_count / active_count * 100) if active_count > 0 else 0
    
    # Get review queue count for stats
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM review_queue WHERE status = 'pending'")
    review_count = cursor.fetchone()[0]
    conn.close()
    
    return {
        "categories": categories,
        "stats": {
            "active_count": active_count,
            "avg_confidence": round(avg_confidence, 1),
            "auto_routed_rate": round(auto_routed_rate, 1),
            "review_queue_count": review_count
        }
    }

@app.post("/categories")
async def create_category(category: CategoryCreate):
    """Add a new category (from AdminAICategories form)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO categories (name, priority, route, sla, confidence, keywords)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            category.name,
            category.priority,
            category.route,
            category.sla,
            category.confidence,
            json.dumps(category.keywords)
        ))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Category already exists")
    finally:
        conn.close()
    
    return {"success": True, "message": f"Category '{category.name}' added"}

@app.put("/categories/{name}")
async def update_category(name: str, update: CategoryUpdate):
    """Update category (priority, route, sla, confidence, keywords)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if update.priority is not None:
        updates.append("priority = ?")
        params.append(update.priority)
    if update.route is not None:
        updates.append("route = ?")
        params.append(update.route)
    if update.sla is not None:
        updates.append("sla = ?")
        params.append(update.sla)
    if update.confidence is not None:
        updates.append("confidence = ?")
        params.append(update.confidence)
    if update.keywords is not None:
        updates.append("keywords = ?")
        params.append(json.dumps(update.keywords))
    if update.is_active is not None:
        updates.append("is_active = ?")
        params.append(update.is_active)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    params.append(name)
    query = f"UPDATE categories SET {', '.join(updates)} WHERE name = ?"
    cursor.execute(query, params)
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    
    if affected == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"success": True, "message": f"Category '{name}' updated"}

@app.delete("/categories/{name}")
async def delete_category(name: str):
    """Soft delete category (deactivate)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE categories SET is_active = 0 WHERE name = ?", (name,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    
    if affected == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"success": True, "message": f"Category '{name}' deactivated"}

# ============ AI RULES MANAGEMENT ============

@app.get("/ai_rules")
async def get_rules():
    """Get current AI thresholds and toggles"""
    rules = get_ai_rules()
    return {
        "routing_threshold": rules.get('routing_threshold', 80),
        "uncertain_queue": bool(rules.get('uncertain_queue', 1)),
        "public_sync": bool(rules.get('public_sync', 1)),
        "keyword_boost": bool(rules.get('keyword_boost', 1))
    }

@app.put("/ai_rules")
async def update_rules(rules_update: AIRulesUpdate):
    """Update AI thresholds and toggles"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if rules_update.routing_threshold is not None:
        updates.append("routing_threshold = ?")
        params.append(rules_update.routing_threshold)
    if rules_update.uncertain_queue is not None:
        updates.append("uncertain_queue = ?")
        params.append(rules_update.uncertain_queue)
    if rules_update.public_sync is not None:
        updates.append("public_sync = ?")
        params.append(rules_update.public_sync)
    if rules_update.keyword_boost is not None:
        updates.append("keyword_boost = ?")
        params.append(rules_update.keyword_boost)
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    
    if not params:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    query = f"UPDATE ai_rules SET {', '.join(updates)} WHERE id = (SELECT id FROM ai_rules ORDER BY id DESC LIMIT 1)"
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "AI rules updated"}

# ============ CLASSIFICATION (MAIN AI) ============

@app.post("/classify")
async def classify_suggestion(suggestion: SuggestionClassify):
    """
    Main classification endpoint called when a student submits a suggestion.
    Returns category, confidence, and whether it needs review.
    """
    if not suggestion.text or len(suggestion.text.strip()) < 3:
        raise HTTPException(status_code=400, detail="Suggestion must be at least 3 characters")
    
    categories = get_categories_from_db()
    rules = get_ai_rules()
    
    if not categories:
        raise HTTPException(status_code=500, detail="No categories configured")
    
    # Run AI classification
    result = categorize_suggestion(suggestion.text, categories, rules)
    
    # Store in suggestions table
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO suggestions (title, suggestion_text, category, confidence, needs_review)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        suggestion.title or suggestion.text[:50],
        suggestion.text,
        result['category'],
        result['confidence'],
        1 if result['needs_review'] else 0
    ))
    suggestion_id = cursor.lastrowid
    
    # Add to review queue if low confidence
    if result['needs_review'] and rules.get('uncertain_queue', 1):
        review_id = str(uuid.uuid4())[:8]
        cursor.execute('''
            INSERT INTO review_queue (id, suggestion_text, original_suggestion_id, predicted_category, confidence)
            VALUES (?, ?, ?, ?, ?)
        ''', (review_id, suggestion.text, suggestion_id, result['category'], result['confidence']))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "suggestion_id": suggestion_id,
        "category": result['category'],
        "confidence": result['confidence'],
        "needs_review": result['needs_review'],
        "message": f"Categorized as: {result['category']} ({result['confidence']}% confidence)"
    }

@app.post("/classify_batch")
async def classify_batch(suggestions: List[SuggestionClassify]):
    """Classify multiple suggestions at once"""
    results = []
    for suggestion in suggestions:
        try:
            result = await classify_suggestion(suggestion)
            results.append(result)
        except Exception as e:
            results.append({"success": False, "error": str(e), "text": suggestion.text[:50]})
    return {"results": results}

# ============ REVIEW QUEUE ============

@app.get("/review_queue")
async def get_review_queue():
    """Get all low-confidence suggestions pending admin review"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, suggestion_text, predicted_category, confidence, created_at
        FROM review_queue
        WHERE status = 'pending'
        ORDER BY created_at DESC
    ''')
    queue = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return {
        "count": len(queue),
        "queue": queue
    }

@app.post("/review_queue/apply")
async def apply_review_correction(review: ReviewApply):
    """
    Apply admin's correction to a low-confidence suggestion.
    This removes it from the review queue.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get the review item
    cursor.execute("SELECT * FROM review_queue WHERE id = ? AND status = 'pending'", (review.review_id,))
    item = cursor.fetchone()
    
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Review item not found")
    
    # Update the original suggestion with new category
    if item[3]:  # original_suggestion_id exists (index 3)
        cursor.execute('''
            UPDATE suggestions 
            SET category = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by_admin = 'admin'
            WHERE id = ?
        ''', (review.new_category, item[3]))
    
    # Mark review as completed
    cursor.execute('''
        UPDATE review_queue 
        SET status = 'completed'
        WHERE id = ?
    ''', (review.review_id,))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": f"Suggestion recategorized to '{review.new_category}'"
    }

@app.delete("/review_queue/{review_id}")
async def dismiss_review(review_id: str):
    """Dismiss a review item without changing category"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE review_queue SET status = 'dismissed' WHERE id = ?", (review_id,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    
    if affected == 0:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {"success": True, "message": "Review item dismissed"}

# ============ TEST ENDPOINT (for Simulator Box) ============

@app.post("/test")
async def test_classification(test: TestInput):
    """
    Quick test endpoint for the simulator box in AdminAICategories.html.
    Returns category, confidence, and routing decision.
    """
    if not test.text or len(test.text.strip()) < 3:
        return {
            "category": None,
            "confidence": 0,
            "needs_review": True,
            "routing_decision": "No decision",
            "message": "Type at least 3 characters to test"
        }
    
    categories = get_categories_from_db()
    rules = get_ai_rules()
    
    if not categories:
        return {
            "category": "No categories",
            "confidence": 0,
            "needs_review": True,
            "routing_decision": "No categories configured",
            "message": "No categories configured. Add some first."
        }
    
    result = categorize_suggestion(test.text, categories, rules)
    
    routing_decision = "Manual review needed" if result['needs_review'] else f"Auto-route to {result['category']} team"
    
    return {
        "category": result['category'],
        "confidence": round(result['confidence'], 1),
        "needs_review": result['needs_review'],
        "routing_decision": routing_decision,
        "message": f"Predicted: {result['category']} ({result['confidence']}% confidence) | {routing_decision}"
    }

# ============ SYNC FROM ADMIN UI ============

@app.post("/sync_from_admin")
async def sync_categories_from_admin(categories: List[SyncCategoryItem] = Body(...)):
    """
    Sync categories when admin saves changes in AdminAICategories.html.
    This endpoint receives the full category list from the UI and updates the DB.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get existing category names
    cursor.execute("SELECT name FROM categories")
    existing_names = {row[0] for row in cursor.fetchall()}
    
    incoming_names = {cat.name for cat in categories}
    
    # Add new categories
    for cat in categories:
        if cat.name not in existing_names:
            cursor.execute('''
                INSERT INTO categories (name, priority, route, sla, confidence, keywords)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                cat.name,
                cat.priority,
                cat.route,
                cat.sla,
                cat.confidence,
                json.dumps(cat.keywords)
            ))
    
    # Deactivate categories not in incoming list
    for name in existing_names - incoming_names:
        cursor.execute("UPDATE categories SET is_active = 0 WHERE name = ?", (name,))
    
    # Update existing categories
    for cat in categories:
        if cat.name in existing_names:
            cursor.execute('''
                UPDATE categories 
                SET priority = ?, route = ?, sla = ?, confidence = ?, keywords = ?, is_active = 1
                WHERE name = ?
            ''', (
                cat.priority,
                cat.route,
                cat.sla,
                cat.confidence,
                json.dumps(cat.keywords),
                cat.name
            ))
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": f"Synced {len(categories)} categories"}

# ============ STATS (for UI cards) ============

@app.get("/stats")
async def get_classifier_stats():
    """Get stats for the AI Categories dashboard cards"""
    categories = get_categories_from_db()
    rules = get_ai_rules()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Low confidence queue count
    cursor.execute("SELECT COUNT(*) FROM review_queue WHERE status = 'pending'")
    low_confidence_count = cursor.fetchone()[0]
    
    conn.close()
    
    active_count = len(categories)
    avg_confidence = sum(c['confidence'] for c in categories) / active_count if active_count > 0 else 0
    routed_count = sum(1 for c in categories if c['confidence'] >= rules.get('routing_threshold', 80))
    auto_routed_rate = (routed_count / active_count * 100) if active_count > 0 else 0
    
    return {
        "active_categories": active_count,
        "low_confidence_queue": low_confidence_count,
        "avg_confidence": round(avg_confidence, 1),
        "auto_routed_rate": round(auto_routed_rate, 1)
    }

# ============ RUN SERVER ============
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🤖 Campus Voice AI - AI Classifier API")
    print("=" * 60)
    print(f"🧠 AI Model: {MODEL}")
    print(f"🗄️  Database: {DB_PATH}")
    print(f"🌐 Server: http://localhost:8001")
    print(f"📖 API Docs: http://localhost:8001/docs")
    print("=" * 60)
    print("✅ Endpoints for AdminAICategories.html:")
    print("   GET  /categories     - Get categories + stats")
    print("   POST /classify       - Classify new suggestion")
    print("   GET  /review_queue   - Low confidence queue")
    print("   POST /test           - Simulator box test")
    print("   PUT  /ai_rules       - Update thresholds")
    print("   POST /sync_from_admin - Batch sync categories")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001)