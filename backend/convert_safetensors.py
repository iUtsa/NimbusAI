import os
import torch
from transformers import AutoModelForCausalLM
from safetensors.torch import load_file

# Define paths
MODEL_PATH = "backend/fine_tuned_model"
SAFE_FILE = os.path.join(MODEL_PATH, "model.safetensors")
BIN_FILE = os.path.join(MODEL_PATH, "pytorch_model.bin")

# Check if safetensors file exists
if not os.path.exists(SAFE_FILE):
    raise FileNotFoundError(f"❌ ERROR: {SAFE_FILE} not found. Ensure model training completed successfully.")

# 🔄 Step 1: Load pre-trained GPT-2 model
print("🔄 Initializing GPT-2 model...")
model = AutoModelForCausalLM.from_pretrained("gpt2")  # Ensure architecture is correct

# 🔄 Step 2: Load safetensors
print(f"🔄 Loading weights from `{SAFE_FILE}`...")
state_dict = load_file(SAFE_FILE)

# 🔄 Step 3: Apply weights to the model
missing_keys, unexpected_keys = model.load_state_dict(state_dict, strict=False)

# 🚨 Check if keys are missing
if missing_keys:
    print(f"⚠️ Warning: Missing keys {missing_keys}. Model might not work correctly!")
if unexpected_keys:
    print(f"⚠️ Warning: Unexpected keys {unexpected_keys} found in state_dict!")

# 🔄 Step 4: Save as PyTorch `.bin`
print("💾 Converting to `pytorch_model.bin`...")
torch.save(model.state_dict(), BIN_FILE)

print(f"✅ Conversion complete! Model saved at `{BIN_FILE}`")
