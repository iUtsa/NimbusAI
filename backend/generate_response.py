import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_PATH = "./fine_tuned_model"

# Load fine-tuned model
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH)

def generate_response(prompt):
    inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
    output = model.generate(**inputs, max_length=200, do_sample=True, top_p=0.9, temperature=0.7)
    return tokenizer.decode(output[0], skip_special_tokens=True)

# Test response
user_input = "What is the capital of USA?"
print("AI:", generate_response(user_input))
