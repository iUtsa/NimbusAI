# API configuration
import os

API_KEY = "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"
MODEL_NAME = "openai/gpt-4o"


# Default system prompt for the LLM
DEFAULT_SYSTEM_PROMPT = """
You are a helpful AI assistant. Your responses should be informative, engaging, and helpful.
Focus on providing accurate and relevant information to the user's queries.
"""

# Maximum number of tokens to generate
MAX_TOKENS = 1000

# Temperature for response generation (0.0 - 1.0)
# Lower values make responses more deterministic
TEMPERATURE = 0.7
