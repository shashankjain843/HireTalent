import os
import uuid
import shutil
from pathlib import Path
from typing import Optional

STORAGE_ROOT = os.getenv("STORAGE_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage")))
RESUMES_DIR = os.path.join(STORAGE_ROOT, "resumes")
ATTACHMENTS_DIR = os.path.join(STORAGE_ROOT, "attachments")

os.makedirs(RESUMES_DIR, exist_ok=True)
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

class StorageService:
    @staticmethod
    def save_resume(file_bytes: bytes, filename: str) -> str:
        """Saves a candidate resume and returns a persistent storage reference."""
        ext = os.path.splitext(filename)[1].lower() or ".pdf"
        unique_name = f"{uuid.uuid4()}{ext}"
        target_path = os.path.join(RESUMES_DIR, unique_name)
        
        with open(target_path, "wb") as f:
            f.write(file_bytes)
            
        return f"/storage/resumes/{unique_name}"

    @staticmethod
    def get_resume_path(file_ref: str) -> Optional[str]:
        """Resolves the local absolute path for a stored resume."""
        if not file_ref:
            return None
        filename = os.path.basename(file_ref)
        path = os.path.join(RESUMES_DIR, filename)
        if os.path.exists(path):
            return path
        return None

    @staticmethod
    def save_attachment(file_bytes: bytes, filename: str) -> str:
        """Saves a chat attachment and returns a persistent storage reference."""
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4()}{ext}"
        target_path = os.path.join(ATTACHMENTS_DIR, unique_name)
        
        with open(target_path, "wb") as f:
            f.write(file_bytes)
            
        return f"/storage/attachments/{unique_name}"
