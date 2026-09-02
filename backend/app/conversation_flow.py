"""
ConversationManager — The Main Brain of Appic AI Consultant
============================================================
Handles:
- User memory (name, email, service, budget, language style, project details)
- Language detection (Hindi / Hinglish / English)
- Intent classification (greeting, service_inquiry, lead_info, follow_up, general)
- State machine (GREETING → EXPLORING → QUALIFYING → STRATEGY → CLOSING)
- Dynamic follow-up question generation per service type
- Never repeats questions
"""

from dataclasses import dataclass, field
from typing import Optional, List, Set
import re


# ─────────────────────────────────────────────
# 📦 USER MEMORY — stores everything we know
# ─────────────────────────────────────────────
@dataclass
class UserMemory:
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    service_type: Optional[str] = None       # mobile / web / ai / ecommerce
    project_description: Optional[str] = None
    budget: Optional[str] = None
    timeline_urgency: Optional[str] = None
    dev_level: Optional[str] = None          # junior / mid / senior
    tech_preference: Optional[str] = None
    has_design: Optional[bool] = None
    needs_login: Optional[bool] = None
    needs_payment: Optional[bool] = None
    platforms: Optional[str] = None         # android / ios / both / web
    language_style: str = "english"         # english / hinglish / hindi
    call_requested: bool = False
    questions_asked: Set[str] = field(default_factory=set)
    conversation_state: str = "GREETING"
    message_count: int = 0

    def to_context_string(self) -> str:
        """Returns a compact memory summary for the LLM prompt."""
        parts = []
        if self.name:
            parts.append(f"User's name: {self.name}")
        if self.email:
            parts.append(f"Email: {self.email}")
        if self.service_type:
            parts.append(f"Interested in: {self.service_type}")
        if self.project_description:
            parts.append(f"Project: {self.project_description}")
        if self.budget:
            parts.append(f"Budget: {self.budget}")
        if self.dev_level:
            parts.append(f"Developer level needed: {self.dev_level}")
        if self.platforms:
            parts.append(f"Platforms: {self.platforms}")
        if self.has_design is not None:
            parts.append(f"Has UI designs: {'yes' if self.has_design else 'no'}")
        if self.needs_login is not None:
            parts.append(f"Needs login/auth: {'yes' if self.needs_login else 'no'}")
        if self.needs_payment is not None:
            parts.append(f"Needs payment integration: {'yes' if self.needs_payment else 'no'}")
        if self.language_style != "english":
            parts.append(f"User speaks in: {self.language_style}")
        if self.conversation_state:
            parts.append(f"Conversation stage: {self.conversation_state}")
        return "\n".join(parts) if parts else "New user — no info collected yet."

    def is_lead_complete(self) -> bool:
        return bool(self.name and self.email)

    def is_project_qualified(self) -> bool:
        return bool(self.service_type and self.budget)


# ─────────────────────────────────────────────
# 🌍 LANGUAGE DETECTOR
# ─────────────────────────────────────────────
HINDI_KEYWORDS = [
    "mujhe", "mera", "meri", "chahiye", "banwana", "banwani", "karna", "karo",
    "hai", "hain", "nahi", "kya", "aur", "ya", "lekin", "kyun", "kaise",
    "kitna", "kitni", "theek", "accha", "haan", "nahi", "bilkul", "zaroor",
    "app", "website", "software", "project", "budget", "bata", "samajh",
    "help", "chahta", "chahti", "banana", "develop", "banao", "kab", "kitne",
    "paisa", "rupees", "rs", "lakh", "crore", "kuch", "sab", "sirf", "bas"
]

def detect_language(text: str) -> str:
    """Detect if user is speaking Hindi, Hinglish, or English."""
    text_lower = text.lower()
    hindi_count = sum(1 for kw in HINDI_KEYWORDS if kw in text_lower.split())
    # Also check for Devanagari script
    has_devanagari = bool(re.search(r'[\u0900-\u097F]', text))

    if has_devanagari:
        return "hindi"
    elif hindi_count >= 2:
        return "hinglish"
    elif hindi_count == 1:
        return "hinglish"
    return "english"


# ─────────────────────────────────────────────
# 🎯 INTENT DETECTOR
# ─────────────────────────────────────────────
def detect_intent(text: str) -> str:
    """Classify what the user wants in this message."""
    t = text.lower()

    # Greeting patterns
    greeting_patterns = ["hi", "hello", "hey", "hii", "namaste", "namaskar", "salam", "good morning", "good evening"]
    if any(t.strip().startswith(p) for p in greeting_patterns) and len(t.split()) <= 4:
        return "greeting"

    # Email pattern
    if re.search(r'[\w\.-]+@[\w\.-]+\.\w+', t):
        return "lead_email"

    # Phone pattern
    if re.search(r'(\+?\d[\d\s\-]{8,14}\d)', t):
        return "lead_phone"

    # Budget signals
    budget_signals = ["budget", "cost", "price", "kitna", "paisa", "rs", "usd", "dollar", "rupee", "lakh", "k ", "$", "5k", "10k", "50k"]
    if any(b in t for b in budget_signals):
        return "budget_info"

    # Service inquiry — mobile
    mobile_signals = ["mobile", "app ", "android", "ios", "flutter", "react native", "phone app", "app banwani", "app chahiye", "app banana"]
    if any(s in t for s in mobile_signals):
        return "service_mobile"

    # Service inquiry — web
    web_signals = ["website", "web app", "web development", "portal", "dashboard", "ecommerce", "store", "shop", "site", "website chahiye", "website banana"]
    if any(s in t for s in web_signals):
        return "service_web"

    # Service inquiry — AI/ML
    ai_signals = ["ai", "machine learning", "ml", "chatbot", "automation", "prediction", "data", "nlp", "computer vision", "ai banana", "ai chahiye"]
    if any(s in t for s in ai_signals):
        return "service_ai"

    # Strategy/recommendation request
    strategy_signals = ["strategy", "recommend", "suggest", "plan", "roadmap", "batao", "kya lagega", "timeline", "kab tak", "how long", "tech stack"]
    if any(s in t for s in strategy_signals):
        return "strategy_request"

    # Call/consultation request
    call_signals = ["call", "meeting", "consult", "talk", "discuss", "milna", "baat", "schedule"]
    if any(s in t for s in call_signals):
        return "call_request"

    # Name detection (simple heuristic — short response after asking name)
    return "general"


# ─────────────────────────────────────────────
# 💬 FOLLOW-UP QUESTION GENERATOR
# ─────────────────────────────────────────────
FOLLOWUP_QUESTIONS = {
    "mobile": [
        ("platforms", "Android aur iOS dono chahiye, ya sirf ek? 📱"),
        ("needs_login", "Kya users ko login/signup karna hoga app mein?"),
        ("has_design", "Kya aapke paas already UI designs hain, ya hume design bhi karna hai?"),
        ("needs_payment", "Payment integration chahiye (like in-app purchases)?"),
        ("project_description", "App ka main feature kya hoga? Briefly batao 🎯"),
    ],
    "web": [
        ("needs_login", "Kya user login/signup system chahiye?"),
        ("needs_payment", "E-commerce ya payment gateway integrate karna hai?"),
        ("has_design", "Kya aapke paas designs ready hain?"),
        ("platforms", "Admin dashboard bhi chahiye, ya sirf user-facing website?"),
        ("project_description", "Website ka primary purpose kya hai? (portfolio, SaaS, marketplace etc.)"),
    ],
    "ai": [
        ("project_description", "Kya solve karna chahte ho AI se? (automation, prediction, chatbot, etc.)"),
        ("has_design", "Kya aapke paas training data already hai?"),
        ("platforms", "Cloud pe deploy karna hai, ya on-premise chahiye?"),
        ("needs_payment", "Kya yeh ek client-facing product hoga, ya internal tool?"),
        ("dev_level", "Integration chahiye existing system mein, ya fresh build?"),
    ],
    "ecommerce": [
        ("platforms", "Kya mobile app bhi chahiye saath mein?"),
        ("needs_payment", "Multiple payment gateways chahiye? (Stripe, Razorpay etc.)"),
        ("has_design", "Kya branding/designs already hain?"),
        ("project_description", "Kitne products expected hain? Small store ya large catalog?"),
        ("dev_level", "Inventory management bhi integrate karna hai?"),
    ]
}

def get_next_followup(memory: UserMemory) -> Optional[str]:
    """Returns the next unanswered follow-up question for the detected service."""
    service = memory.service_type or "mobile"
    questions = FOLLOWUP_QUESTIONS.get(service, FOLLOWUP_QUESTIONS["mobile"])

    for field_name, question in questions:
        if field_name not in memory.questions_asked:
            # Check if we already have this info
            val = getattr(memory, field_name, None)
            if val is None:
                memory.questions_asked.add(field_name)
                return question
    return None


# ─────────────────────────────────────────────
# 🧠 MAIN CONVERSATION MANAGER
# ─────────────────────────────────────────────
class ConversationManager:
    def __init__(self):
        self.memory = UserMemory()

    def update_memory_from_message(self, text: str, intent: str):
        """Extract and store any info found in the user message."""
        t = text.lower()

        # Language detection
        lang = detect_language(text)
        if lang != "english":
            self.memory.language_style = lang

        # Extract email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        if email_match and not self.memory.email:
            self.memory.email = email_match.group()

        # Extract phone
        phone_match = re.search(r'(\+?\d[\d\s\-]{8,14}\d)', text)
        if phone_match and not self.memory.phone:
            self.memory.phone = phone_match.group().strip()

        # Extract service type
        if intent == "service_mobile" and not self.memory.service_type:
            self.memory.service_type = "mobile"
            self.memory.conversation_state = "EXPLORING"
        elif intent == "service_web" and not self.memory.service_type:
            self.memory.service_type = "web"
            self.memory.conversation_state = "EXPLORING"
        elif intent == "service_ai" and not self.memory.service_type:
            self.memory.service_type = "ai"
            self.memory.conversation_state = "EXPLORING"

        # Extract budget signals
        if intent == "budget_info" and not self.memory.budget:
            # Try to extract budget range from text
            budget_patterns = [
                r'\$[\d,]+k?', r'[\d,]+\s*(?:usd|dollar|rs|rupee|lakh|k)',
                r'(?:under|below|around|approx)\s*[\$₹]?\s*[\d,]+'
            ]
            for pattern in budget_patterns:
                match = re.search(pattern, t)
                if match:
                    self.memory.budget = match.group().strip()
                    break
            if not self.memory.budget:
                # Store the whole sentence as budget context
                self.memory.budget = text[:80]
            self.memory.conversation_state = "QUALIFYING"

        # Platform detection
        if "android" in t and "ios" in t and not self.memory.platforms:
            self.memory.platforms = "Android + iOS"
        elif "android" in t and not self.memory.platforms:
            self.memory.platforms = "Android"
        elif "ios" in t and not self.memory.platforms:
            self.memory.platforms = "iOS"

        # Yes/No for common follow-ups
        yes_words = ["yes", "haan", "ha", "hah", "yep", "sure", "bilkul", "zaroor", "yeah"]
        no_words = ["no", "nahi", "nope", "na", "not", "nope"]
        is_yes = any(w in t.split() for w in yes_words)
        is_no = any(w in t.split() for w in no_words)

        # Strategy/closing state
        if intent == "strategy_request":
            self.memory.conversation_state = "STRATEGY"
        elif intent == "call_request":
            self.memory.call_requested = True
            self.memory.conversation_state = "CLOSING"

        self.memory.message_count += 1

        # Auto-advance state
        if self.memory.is_lead_complete() and self.memory.is_project_qualified():
            self.memory.conversation_state = "STRATEGY"

    def get_memory_context(self) -> str:
        """Returns formatted memory for injection into LLM prompt."""
        return self.memory.to_context_string()

    def get_language_instruction(self) -> str:
        """Returns language instruction for the system prompt."""
        if self.memory.language_style == "hinglish":
            return "IMPORTANT: User is speaking in Hinglish (Hindi + English mix). Respond in a warm Hinglish style — mix Hindi and English naturally. Example: 'Great idea! Aapka project bahut accha lagta hai 🚀'"
        elif self.memory.language_style == "hindi":
            return "IMPORTANT: User is speaking in Hindi. Respond in simple, warm Hindi mixed with some English technical terms. Be natural, not formal."
        return "Respond in clean, conversational English."

    def get_state_instruction(self) -> str:
        """Returns what the AI should focus on based on current state."""
        state = self.memory.conversation_state

        if state == "GREETING":
            return "This is a new conversation. Greet warmly, introduce yourself as Aria from Appic Software, and ask what they want to build. Offer 3 service options."
        elif state == "EXPLORING":
            next_q = get_next_followup(self.memory)
            if next_q:
                return f"You know the user is interested in {self.memory.service_type} development. Ask this follow-up question naturally (not robotically): '{next_q}'"
            return f"You have good info about their {self.memory.service_type} project. Now naturally ask for their name and where to send the project plan."
        elif state == "QUALIFYING":
            if not self.memory.is_lead_complete():
                return "You know the project details. Naturally ask for their name and email to send them a project plan."
            return "Lead is captured. Now build toward giving a strategy/roadmap recommendation."
        elif state == "STRATEGY":
            return "Time to give a proper strategy recommendation! Use generate_strategy_tool. Be specific, confident, and consultative."
        elif state == "CLOSING":
            return "Offer a free 15-minute consultation call. Make it easy and inviting."
        return "Continue the conversation naturally."