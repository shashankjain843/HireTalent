import os
import sys
import subprocess

# Ensure running inside venv if available
venv_python = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "python.exe")
if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
    subprocess.run([venv_python] + sys.argv)
    sys.exit(0)

import uvicorn

if __name__ == "__main__":
    print(">> Starting HireTalentIQ Backend on http://127.0.0.1:8001 ...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)
