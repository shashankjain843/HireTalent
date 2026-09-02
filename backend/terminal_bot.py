import requests
import json
import os
import textwrap
from dotenv import load_dotenv

load_dotenv()

def print_wrapped(text, prefix="Bot: "):
    wrapper = textwrap.TextWrapper(width=80, initial_indent=prefix, subsequent_indent=" " * len(prefix))
    print("\n" + wrapper.fill(text))

def chat_loop():
    print("\n" + "="*60)
    print("      APPIC SOFTWARE - AI STRATEGIC ADVISOR")
    print("="*60)
    print("Type 'exit' or 'quit' to stop.\n")

    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() in ['exit', 'quit']:
                break

            print("\n(Thinking...)", end="", flush=True)
            
            response = requests.post(
                "http://127.0.0.1:8001/chat",
                json={"question": user_input, "session_id": "terminal_test"},
                timeout=60
            )
            
            if response.status_code == 200:
                answer = response.json().get("message", "No response")
                print_wrapped(answer)
            else:
                print(f"\nError: {response.status_code} - {response.text}")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\nError: {str(e)}")

if __name__ == "__main__":
    chat_loop()
