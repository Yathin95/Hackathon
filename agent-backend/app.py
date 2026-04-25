from flask import Flask, request, jsonify
import requests
import json
import os
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
# =========================
# 🔑 GROQ CONFIG
# =========================
GROQ_API_KEY = "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"

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
}

MODEL = "llama-3.1-8b-instant"

# =========================
# 🧠 SAFE MEMORY (NO ERRORS)
# =========================
memory = {
    "history": [],
    "weak_topics": []
}

# =========================
# 🤖 SAFE AI CALL
# =========================
def call_llm(prompt):
    try:
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "You are an AI tutor that outputs ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }

        response = requests.post(GROQ_URL, headers=HEADERS, json=payload, timeout=30)

        data = response.json()

        if "choices" not in data:
            return {"error": "Invalid Groq response", "raw": data}

        return data["choices"][0]["message"]["content"]

    except Exception as e:
        return {"error": str(e)}

# =========================
# 📚 GENERATE QUESTIONS (10 MCQs)
# =========================
@app.route("/generate", methods=["GET"])
def generate():
    topic = request.args.get("topic", "DBMS")

    prompt = f"""
Generate 10 MCQ questions on {topic}.
Return ONLY JSON:
{{
  "topic": "{topic}",
  "questions": [
    {{
      "question": "",
      "options": ["A","B","C","D"],
      "answer": "A",
      "topic": "{topic}"
    }}
  ]
}}
"""

    result = call_llm(prompt)

    if isinstance(result, dict) and "error" in result:
        return jsonify(result)

    try:
        cleaned = result[result.find("{"): result.rfind("}") + 1]
        return jsonify(json.loads(cleaned))
    except:
        return jsonify({
            "error": "Failed to parse AI response",
            "raw": result
        })

# =========================
# 🧠 EVALUATE + MEMORY UPDATE
# =========================
@app.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.json

    questions = data.get("questions", [])
    answers = data.get("answers", [])
    topic = data.get("topic", "unknown")

    score = 0
    weak = []

    for i in range(len(questions)):
        try:
            if answers[i] == questions[i]["answer"]:
                score += 1
            else:
                weak.append(questions[i]["topic"])
        except:
            continue

    # Update memory safely
    memory.setdefault("history", []).append({
        "topic": topic,
        "score": score,
        "total": len(questions)
    })

    memory.setdefault("weak_topics", []).extend(weak)

    return jsonify({
        "score": score,
        "total": len(questions),
        "weak_topics": list(set(memory["weak_topics"]))
    })

# =========================
# 📊 DASHBOARD (NO ERRORS EVER)
# =========================
@app.route("/dashboard")
def dashboard():

    history = memory.get("history", [])
    weak = memory.get("weak_topics", [])

    total_tests = len(history)
    avg = 0

    if total_tests > 0:
        avg = sum([h["score"] for h in history]) / total_tests

    return jsonify({
        "average_score": avg,
        "history": history,
        "total_tests": total_tests,
        "weak_topics": list(set(weak))
    })

# =========================
# 📚 AI STUDY PLAN (SAFE)
# =========================
@app.route("/study-plan")
def study_plan():

    weak = list(set(memory.get("weak_topics", [])))

    prompt = f"""
Create a 5-day study plan for weak topics:
{weak}

Return JSON:
{{
  "Day 1": "...",
  "Day 2": "...",
  "Day 3": "...",
  "Day 4": "...",
  "Day 5": "..."
}}
"""

    result = call_llm(prompt)

    if isinstance(result, dict) and "error" in result:
        return jsonify(result)

    try:
        cleaned = result[result.find("{"): result.rfind("}") + 1]
        return jsonify(json.loads(cleaned))
    except:
        return jsonify({
            "error": "Study plan parsing failed",
            "raw": result
        })

# =========================
# 🚀 HOME
# =========================
@app.route("/")
def home():
    return "🔥 Agentic AI Tutor Running Safely"

# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    print("🔥 Agentic AI Tutor Running on http://127.0.0.1:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)