import re

# Clean text
def clean_text(text):
    text = re.sub(r'\s+', ' ', text)  # extra spaces remove
    text = re.sub(r'\n+', '\n', text)  # extra newlines remove
    return text.strip()

# Format response
def format_response(response):
    return response.strip()

from datetime import datetime

# Basic logger
def log_query(question, answer):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open("logs.txt", "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}]\nQ: {question}\nA: {answer}\n{'-'*50}\n")