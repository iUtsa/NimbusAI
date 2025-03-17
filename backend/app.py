from flask import Flask, request, jsonify, render_template
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import re
import sympy
import json
import requests

# Set the correct model path
MODEL_PATH = "backend/fine_tuned_model"

print(f"🔄 Loading tokenizer and model from `{MODEL_PATH}`...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, trust_remote_code=True)
    model.eval()  # Set to evaluation mode
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"❌ ERROR: Failed to load model: {e}")
    exit(1)

app = Flask(__name__, 
            static_folder='../frontend/static',
            template_folder='../frontend/templates')

# Store conversation history in memory (consider a DB in production)
conversations = {}

# ✅ Load the fact database (General Knowledge + Space)
FACT_DATABASE = "backend/fact_data.json"
try:
    with open(FACT_DATABASE, "r", encoding="utf-8") as f:
        fact_data = json.load(f)
        print("✅ Fact database loaded!")
except FileNotFoundError:
    print("⚠️ Warning: No fact database found. AI will rely on model generation.")
    fact_data = {}

# ✅ NASA API Key
NASA_API_KEY = "fY0Mbt0VptZNXsRXA6LQ3QeG1oGQqJtf7l6o3L6O"

def truncate_response(response):
    """Extracts the first sentence as the main answer and the rest as explanation."""
    sentences = response.split(". ")  
    main_answer = sentences[0] + "."  
    explanation = ". ".join(sentences[1:])  
    return main_answer, explanation

def extract_math_expression(text):
    """Extracts a math expression from a natural language sentence."""
    math_pattern = r"([-+]?\d+(\.\d+)?\s*[\+\-\*/\^]\s*[-+]?\d+(\.\d+)?(?:\s*[\+\-\*/\^]\s*\d+(\.\d+)?)*)(?![\w])"
    match = re.search(math_pattern, text)
    return match.group(0) if match else None

def solve_math(problem):
    """Evaluates mathematical expressions using SymPy."""
    try:
        expression = sympy.sympify(problem)
        return str(expression.evalf())  
    except Exception:
        return None  

FACT_DATABASE = "backend/fact_data.json"

def save_fact_to_database(query, answer):
    """Saves newly fetched Wikipedia facts into fact_data.json."""
    try:
        with open(FACT_DATABASE, "r+", encoding="utf-8") as f:
            data = json.load(f)
            data[query.lower()] = answer  # Store fact
            f.seek(0)
            json.dump(data, f, indent=4)  # Save updated file
        print(f"✅ New fact saved: {query} → {answer}")
    except Exception as e:
        print(f"⚠️ Failed to save fact: {e}")

def search_fact_database(prompt):
    """Search the fact database for the best match."""
    lower_prompt = prompt.lower().strip()

    # ✅ Direct match first
    if lower_prompt in fact_data:
        return fact_data[lower_prompt]

    # ✅ Fuzzy search for close matches
    for key in fact_data.keys():
        if lower_prompt in key:  # ✅ If question contains known fact
            return fact_data[key]

    return None  # ❌ No match found


def fetch_wikipedia_fact(query):
    """Fetches a short summary from Wikipedia API with better accuracy."""
    try:
        # ✅ First, try direct lookup
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{query.replace(' ', '_')}"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if "title" in data and "extract" in data:
                return data["extract"]

        # ❌ If direct lookup fails, try Wikipedia search API
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json"
        search_response = requests.get(search_url, timeout=3)
        if search_response.status_code == 200:
            search_data = search_response.json()
            if "query" in search_data and "search" in search_data["query"] and len(search_data["query"]["search"]) > 0:
                best_match = search_data["query"]["search"][0]["title"]
                return fetch_wikipedia_fact(best_match)  # Recursively fetch the best match

    except Exception as e:
        print(f"⚠️ Wikipedia API Error: {e}")

    return None  # ❌ If Wikipedia fails, return None


def fetch_nasa_fact():
    """Fetches NASA Astronomy Picture of the Day (APOD)."""
    try:
        url = f"https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            return data.get("explanation", "No space data available.")
    except Exception:
        pass  
    return None

def generate_response(prompt):
    """Generates a response using fact checking, Wikipedia, NASA API, or the AI model."""

    # ✅ Step 1: Check the local fact database first
    fact_result = search_fact_database(prompt)
    if fact_result:
        return fact_result, "This information is sourced from the local fact database."

    # ✅ Step 2: Try Wikipedia API if fact is not found
    # ✅ Step 3: Try Wikipedia API if fact is not found
    wiki_fact = fetch_wikipedia_fact(prompt)
    if wiki_fact:
        save_fact_to_database(prompt, wiki_fact)  # ✅ Step 4: Save Wikipedia facts for future use
        return wiki_fact, "This information is retrieved from Wikipedia."


    # ✅ Step 3: Check for math expressions
    math_expression = extract_math_expression(prompt)
    if math_expression and any(char.isdigit() for char in math_expression):
        math_answer = solve_math(math_expression)
        if math_answer:
            return math_answer, "This is the result of the mathematical calculation."

    # ✅ Step 4: Use AI generation as a last resort
    inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)

    with torch.no_grad():
        output = model.generate(
            **inputs, 
            max_new_tokens=100,  
            do_sample=False,  # ❌ No randomness
            top_p=0.8,  # ✅ Less creative, more accurate
            temperature=0.1,  # 🔥 Lower randomness for factual accuracy
            repetition_penalty=1.4,  # 🚫 Prevents repeating phrases
            num_return_sequences=1  
        )

    response = tokenizer.decode(output[0], skip_special_tokens=True)

    # ✅ Prevents repeating the prompt in the response
    if response.lower().startswith(prompt.lower()):
        response = response[len(prompt):].strip()

    # ✅ Extract first sentence as main answer, rest as explanation
    main_answer, explanation = truncate_response(response)

    return main_answer, explanation

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handles user chat messages and returns AI responses."""
    data = request.json
    user_message = data.get('message', '').strip()
    conversation_id = data.get('conversation_id', 'default')

    if not user_message:
        return jsonify({"status": "error", "message": "Empty message"}), 400

    if conversation_id not in conversations:
        conversations[conversation_id] = []

    conversations[conversation_id].append({"role": "user", "content": user_message})

    try:
        main_answer, explanation = generate_response(user_message)

        conversations[conversation_id].append({"role": "assistant", "content": main_answer + " " + explanation})

        return jsonify({
            "status": "success",
            "response": main_answer,  
            "explanation": explanation,  
            "conversation_id": conversation_id
        })

    except Exception as e:
        print(f"Error generating response: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to generate response",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
