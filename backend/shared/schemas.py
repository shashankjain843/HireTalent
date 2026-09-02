from pydantic import BaseModel
from typing import Optional, List

# 🔹 User input
class ChatQuery(BaseModel):
    question: str
    session_id: Optional[str] = "default"


# 🔥 UPDATED RESPONSE (MOST IMPORTANT)
class ChatResponse(BaseModel):
    message: str
    options: List[str] = []


# 🔹 Lead capture (future use)
class LeadRequest(BaseModel):
    name: str
    email: str
    query: str


# 🔹 Website crawling
class CrawlRequest(BaseModel):
    url: str
    max_pages: Optional[int] = 20