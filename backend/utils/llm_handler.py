import openai
import json
import os
from config import API_KEY, MODEL_NAME, MAX_TOKENS, TEMPERATURE

# Load training data if available
TRAINING_DATA_FILE = os.path.join(os.path.dirname(__file__), "training_data.jsonl")
knowledge_base = {}

if os.path.exists(TRAINING_DATA_FILE):
    with open(TRAINING_DATA_FILE, "r", encoding="utf-8") as file:
        for line in file:
            try:
                data = json.loads(line)
                if "messages" in data:
                    user_input = data["messages"][1]["content"].strip().lower()
                    response = data["messages"][2]["content"]
                    knowledge_base[user_input] = response
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON line: {line}")

def generate_response(api_key, model_name, messages, system_prompt):
    """
    Generate a response using OpenAI API or fallback to the knowledge base.

    Args:
        api_key (str): API key for authentication.
        model_name (str): Fine-tuned model name.
        messages (list): List of message dictionaries with role and content.
        system_prompt (str): System prompt to guide the model's behavior.

    Returns:
        str: AI-generated response.
    """
    openai.api_key = api_key
    user_input = messages[-1]["content"].strip().lower()

    # First, check if the input exists in the knowledge base
    if user_input in knowledge_base:
        return knowledge_base[user_input]

    try:
        response = openai.ChatCompletion.create(
            model=model_name,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE
        )
        return response["choices"][0]["message"]["content"]

    except openai.error.OpenAIError as e:
        print(f"OpenAI API Error: {e}")
        return "Sorry, there was an error processing your request."

    except Exception as e:
        print(f"Unexpected Error: {e}")
        return "Sorry, an unexpected error occurred."
