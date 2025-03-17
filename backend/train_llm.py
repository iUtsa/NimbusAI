import torch
import json
import os
from transformers import Trainer, TrainingArguments, AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling
from datasets import Dataset

# ✅ Load training data
TRAINING_DATA_FILE = "backend/training_data.jsonl"

def load_training_data(file_path):
    """Loads training data from a JSONL file."""
    conversations = []
    with open(file_path, "r", encoding="utf-8") as file:
        for line in file:
            try:
                data = json.loads(line)
                messages = [msg["content"] for msg in data["messages"]]
                conversations.append("\n".join(messages))  # Join user and AI responses
            except json.JSONDecodeError:
                print(f"⚠️ Skipping invalid JSON line: {line}")
    return conversations

# ✅ Convert training data to Hugging Face dataset format
train_texts = load_training_data(TRAINING_DATA_FILE)
dataset = Dataset.from_dict({"text": train_texts})

# ✅ Choose a model
MODEL_NAME = "gpt2"  # Upgradeable to a better model like EleutherAI/pythia-1b or mistralai/Mistral-7B

# ✅ Load tokenizer and model
print(f"🔄 Loading model `{MODEL_NAME}`...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
    print("✅ Model and tokenizer loaded successfully!")
except Exception as e:
    print(f"❌ ERROR: Model loading failed - {e}")
    exit(1)

# ✅ Tokenize data
def tokenize_function(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=512)

tokenized_datasets = dataset.map(tokenize_function, batched=True)

# ✅ Set up Training configuration
training_args = TrainingArguments(
    output_dir="backend/fine_tuned_model",
    evaluation_strategy="no",  # No evaluation set unless needed
    save_strategy="epoch",
    learning_rate=5e-5,
    per_device_train_batch_size=2,
    num_train_epochs=3,
    weight_decay=0.01,
    push_to_hub=False
)

# ✅ Data collator
data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False
)

# ✅ Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_datasets,
    tokenizer=tokenizer,
    data_collator=data_collator
)

# ✅ Train model
print("🚀 Starting fine-tuning...")
trainer.train()

# ✅ Save model properly
save_path = "backend/fine_tuned_model"
os.makedirs(save_path, exist_ok=True)
model.save_pretrained(save_path)
tokenizer.save_pretrained(save_path)

# ✅ Ensure `config.json` is properly saved
config_path = os.path.join(save_path, "config.json")
if not os.path.exists(config_path):
    model.config.to_json_file(config_path)

print(f"✅ Model training complete! Your fine-tuned model is saved in `{save_path}/`")
