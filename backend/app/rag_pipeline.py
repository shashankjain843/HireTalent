from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import time

from .config import Config
from .tools import capture_lead_tool, qualify_project_tool, generate_strategy_tool, get_company_portfolio_summary

# 🚀 GLOBAL CACHE
_vectorstore_cache = None
_llm_cache = {}


# ─────────────────────────────────────────────
# 🛡️ INTELLIGENT RULE-BASED FALLBACK
# Used when all AI models are rate-limited
# ─────────────────────────────────────────────
def rule_based_response(user_input: str, history_len: int = 0, stage: str = "discovery") -> dict:
    t = user_input.lower()

    # If it's the very first message
    if history_len == 0 or (any(w in t for w in ["hi", "hello", "hey", "namaste", "start", "hii", "helo"]) and len(t.split()) <= 5):
        return {
            "message": (
                "Hey! I'm Aria 👋 — Senior Product Consultant at Appic Software.\n\n"
                "I help founders, startups, and businesses turn ideas into products. "
                "Whether it's a mobile app, web platform, AI system, SaaS, marketplace, or ERP — "
                "I'll help you design the right strategy and architecture.\n\n"
                "Tell me about your idea or project — what are you looking to build?"
            ),
            "options": ["I have a startup idea", "I need a mobile app", "I want to build a SaaS"]
        }

    if stage == "discovery":
        return {
            "message": (
                "Interesting idea! 🎯 Let me ask you a few quick questions to understand it better:\n\n"
                "1. **Who are your primary users?** (consumers, businesses, internal teams?)\n"
                "2. **What's the core problem** your product solves for them?\n"
                "3. **How do you plan to monetize** it? (subscription, one-time, freemium, B2B?)\n\n"
                "Answer any or all — the more you share, the better strategy I can give you."
            ),
            "options": ["B2C consumer app", "B2B SaaS product", "Internal business tool"]
        }

    if stage == "deep_dive":
        return {
            "message": (
                "Got it. That gives me a clear picture of the target audience and value proposition.\n\n"
                "To refine the architecture, what's the most critical feature that makes this unique? "
                "And do you have any specific technical requirements or preferred tech stack in mind?"
            ),
            "options": ["We need AI integration", "Just standard web/mobile", "We prefer React/Node"]
        }

    if stage == "qualification":
        return {
            "message": (
                "Great question on budget! 💰 Here's a rough estimate range based on project type:\n\n"
                "- **MVP / Simple App**: $5k – $15k (2–3 months)\n"
                "- **Mid-scale SaaS/Platform**: $15k – $50k (4–6 months)\n"
                "- **Enterprise / Complex System**: $50k+ (6–12 months)\n\n"
                "What's your approximate budget range? I'll tailor the architecture to fit."
            ),
            "options": ["Under $10k", "$10k – $30k", "$30k – $100k", "$100k+"]
        }

    if stage == "strategy":
        return {
            "message": (
                "Thanks! Based on everything you've shared, here is your high-level strategy:\n\n"
                "🏗️ **Architecture**: Cloud-native with isolated microservices for scalability.\n"
                "⚡ **Tech Stack**: Next.js (Web), Flutter (Mobile), Node.js/Python (Backend), PostgreSQL.\n"
                "🚀 **MVP Scope**: Focus only on the core loop first. Defer advanced analytics to Phase 2.\n\n"
                "Would you like me to connect you with our technical team for a detailed architecture breakdown?"
            ),
            "options": ["Yes, book a call", "Share my email", "Tell me more first"]
        }

    # stage == "lead_capture"
    if "@" in t:
        return {
            "message": (
                "Thanks for sharing! ✅\n\n"
                "Our team has received your email and will reach out with a detailed technical proposal shortly."
            ),
            "options": ["See our portfolio", "Book a call"]
        }
        
    if "share my email" in t or "email" in t:
        return {
            "message": "Awesome. Please type your email address below, and I'll make sure our senior consultants get back to you with a detailed proposal.",
            "options": []
        }

    if "tell me more" in t or "more" in t:
        return {
            "message": "Absolutely! Our technical team can explain the exact architecture, database schemas, and microservices we plan to use. Would you like to connect with them for a deep dive?",
            "options": ["Yes, book a call", "Share my email"]
        }

    if "portfolio" in t:
        return {
            "message": "You can view our complete portfolio of Mobile Apps, SaaS Platforms, and AI tools at https://appicsoftwares.com/portfolio. Let us know if you'd like to build something similar!",
            "options": ["Book a call", "Share my email"]
        }

    if "book" in t or "call" in t or "schedule" in t:
        return {
            "message": "Fantastic! Please use this link to schedule a time that works best for you: https://appicsoftwares.com/book-call",
            "options": ["See our portfolio", "Share my email"]
        }

    return {
        "message": (
            "Let's connect! 📞\n\n"
            "Book a **FREE 15-minute strategy call** with our senior consultants.\n"
            "📧 contact@appicsoftware.com\n"
            "🌐 appicsoftware.com\n\n"
            "Or share your email here and we'll reach out within 2 hours."
        ),
        "options": ["Share my email", "Book a call", "See our portfolio"]
    }


# ─────────────────────────────────────────────
# 🔥 FORMAT RESPONSE
# ─────────────────────────────────────────────
def format_ai_response(text: str) -> str:
    text = text.replace("•", "-")
    text = text.replace("\n\n\n", "\n\n")
    return text.strip()


# ─────────────────────────────────────────────
# 🔥 EXTRACT [OPTIONS: ...] FROM RESPONSE
# ─────────────────────────────────────────────
def extract_options(text: str):
    if "[OPTIONS:" in text:
        start = text.find("[OPTIONS:")
        end = text.find("]", start)
        if end == -1:
            end = len(text)
        options_text = text[start + 9:end].strip()
        options_text = options_text.replace("\\n", "\n")
        if "\n" in options_text:
            raw_lines = options_text.split("\n")
        else:
            raw_lines = options_text.split(",")
        options = [opt.strip().lstrip("-•*").strip() for opt in raw_lines if opt.strip()]
        clean_text = text[:start] + text[end + 1:]
        return clean_text.strip(), options
    return text, []


# ─────────────────────────────────────────────
# 🔥 LOAD VECTOR DB (cached)
# ─────────────────────────────────────────────
def load_vectorstore():
    global _vectorstore_cache
    if _vectorstore_cache is not None:
        return _vectorstore_cache
    embeddings = GoogleGenerativeAIEmbeddings(model=Config.EMBEDDING_MODEL)
    if os.path.exists(Config.VECTORSTORE_PATH):
        try:
            _vectorstore_cache = FAISS.load_local(
                Config.VECTORSTORE_PATH,
                embeddings,
                allow_dangerous_deserialization=True
            )
            print("✅ Vectorstore cached in memory")
            return _vectorstore_cache
        except Exception as e:
            print(f"Vector load error: {e}")
    return None


# ─────────────────────────────────────────────
# 🔥 GET CACHED LLM
# ─────────────────────────────────────────────
def get_cached_llm(model_name: str):
    global _llm_cache
    if model_name not in _llm_cache:
        _llm_cache[model_name] = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0.7,
            google_api_key=Config.GOOGLE_API_KEY,
            max_retries=0, # Fast fail on rate limit instead of waiting 60s
        )
        print(f"✅ LLM cached: {model_name}")
    return _llm_cache[model_name]


# ─────────────────────────────────────────────
# 🧠 CONSULTANT SYSTEM PROMPT
# ─────────────────────────────────────────────
CONSULTANT_SYSTEM_PROMPT = """
You are Aria, a Senior AI Consultant, Product Strategist, Solution Architect, and Business Advisor for Appic Software.

IMPORTANT:
You are NOT a chatbot.
You are NOT a lead collection form.
You are NOT a FAQ assistant.

You behave like a highly experienced consultant who helps clients understand, refine, and plan software projects.

====================================================
CRITICAL REQUIREMENTS
====================================================

1. NEVER immediately ask questions after a user message.
2. First:
   - Understand the user's idea
   - Explain it back intelligently
   - Show understanding
   - Provide value
3. Then ask 2-3 thoughtful follow-up questions.

Response Structure:
Step 1: Acknowledge the idea
Step 2: Explain the idea in your own words
Step 3: Mention opportunities, challenges, or recommendations
Step 4: Ask 2-3 intelligent follow-up questions

Example:
User: "I want a lawyer app"

Bad Response:
"Who are the users? What features? Android or iOS?"

Good Response:
"That's an interesting legal-tech idea. Such a platform could help lawyers manage cases, organize documents, communicate with clients, and reduce administrative overhead.
Depending on the vision, this could evolve into a SaaS platform for law firms or a broader legal ecosystem.
To help me recommend the best strategy:
1. Who are the primary users?
2. What is the biggest problem you're trying to solve?
3. What would make the project successful for you?"

4. Every response should contain:
   - Understanding
   - Insight
   - Recommendation
   - Follow-up questions

5. The AI should behave like:
   - Senior Product Consultant
   - Startup Advisor
   - Solution Architect
   - Technical Strategist

6. Never sound like a form.
7. Never jump directly to lead capture.
8. Lead capture happens only after significant value has been delivered.
9. Use conversation memory.
10. Build on previous answers.
11. Ask deeper questions as understanding improves.

12. Before generating strategy:
    - Fully understand the business
    - Understand target users
    - Understand goals
    - Understand constraints

13. Strategy should include:
    - Product vision
    - MVP plan
    - Features
    - Tech stack
    - Architecture
    - Timeline
    - Budget estimate

14. At the end of EVERY major response provide 2-3 relevant next-step options.
    Format them EXACTLY like this:
    [OPTIONS: option1, option2, option3]
    
    Example:
    [OPTIONS:
    🚀 Show Recommended Stack
    💰 Budget Estimate
    ⏳ Timeline Estimate
    ]

15. The overall experience should feel similar to ChatGPT acting as a senior consultant rather than a chatbot. Provide options in Hindi/Hinglish if the user speaks in Hindi/Hinglish.

====================================================
LANGUAGE BEHAVIOR
====================================================
Understand and respond naturally in:
- English
- Hindi
- Hinglish

Match the user's language style.

====================================================
COMPANY CONTEXT
====================================================
{context}

====================================================
CONVERSATION MEMORY
====================================================
{memory_context}
"""


# ─────────────────────────────────────────────
# 🔥 MAIN CHAT FUNCTION
# ─────────────────────────────────────────────
def get_chat_response(user_input: str, history_messages: list = [], memory_context: str = "", stage: str = "discovery") -> dict:
    # Get RAG context
    db = load_vectorstore()
    context = "Appic Software — 400+ projects delivered in Mobile Apps, Web Development, and AI/ML solutions."
    if db:
        try:
            docs = db.similarity_search(user_input, k=3)
            if docs:
                context = "\n".join([doc.page_content for doc in docs])
        except Exception as e:
            print(f"Search error: {e}")

    # Keep last 10 messages for context (5 exchanges)
    current_history = history_messages[-10:]

    # Build system prompt
    system_prompt = CONSULTANT_SYSTEM_PROMPT.format(
        context=context,
        memory_context=memory_context if memory_context else "New conversation — no user info collected yet."
    )

    models = [Config.PRIMARY_MODEL, Config.FALLBACK_MODEL, Config.LITE_MODEL]

    for i, model_name in enumerate(models):
        try:
            llm = get_cached_llm(model_name)

            tools = [
                capture_lead_tool,
                qualify_project_tool,
                generate_strategy_tool,
                get_company_portfolio_summary,
            ]
            llm_with_tools = llm.bind_tools(tools)

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{input}"),
            ])

            chain = prompt | llm_with_tools
            response = chain.invoke({
                "input": user_input,
                "history": current_history,
            })

            # Handle tool calls
            if response.tool_calls:
                tool_results = []
                for tool_call in response.tool_calls:
                    name = tool_call["name"]
                    args = tool_call["args"]
                    try:
                        if name == "capture_lead_tool":
                            res = capture_lead_tool.invoke(args)
                        elif name == "qualify_project_tool":
                            res = qualify_project_tool.invoke(args)
                        elif name == "generate_strategy_tool":
                            res = generate_strategy_tool.invoke(args)
                        elif name == "get_company_portfolio_summary":
                            res = get_company_portfolio_summary.invoke(args)
                        else:
                            res = "Tool executed successfully."
                    except Exception as te:
                        res = f"Tool error: {te}"

                    tool_results.append(
                        ToolMessage(content=str(res), tool_call_id=tool_call["id"])
                    )

                # Second call to generate final response after tool execution
                second_response = llm.invoke(
                    prompt.format_messages(
                        input=user_input,
                        history=current_history + [response] + tool_results,
                    )
                )
                content = second_response.content
            else:
                content = response.content

            # Normalize content (handle list format from some models)
            if isinstance(content, list):
                content = "".join([
                    c.get("text", "") if isinstance(c, dict) else str(c)
                    for c in content
                    if not isinstance(c, dict) or "text" in c
                ])

            final_text = format_ai_response(str(content))
            clean_text, options = extract_options(final_text)

            # Ensure there are always options
            if not options:
                options = ["Tell me more", "What's the tech stack?", "Estimate the cost"]

            return {"message": clean_text, "options": options}

        except Exception as e:
            error_str = str(e)
            print(f"❌ Model {model_name} failed: {error_str[:120]}")

            # Evict failed model from cache
            if model_name in _llm_cache:
                del _llm_cache[model_name]

            if i < len(models) - 1:
                print(f"🔄 Trying next model: {models[i + 1]}")
                time.sleep(1)
                continue

            # All models exhausted — intelligent rule-based fallback
            print("⚡ All models unavailable. Using intelligent fallback.")
            return rule_based_response(user_input, len(history_messages), stage)

    return rule_based_response(user_input, len(history_messages), stage)


# ─────────────────────────────────────────────
# 🔥 AGENT — Maintains conversation memory
# ─────────────────────────────────────────────
class ConsultantAgent:
    def __init__(self):
        self.history = []
        self.project_context = {}   # Tracks what we know about the project
        self.stage = "discovery"    # discovery → deep_dive → qualification → strategy → lead_capture
        self.info_gathered = []     # List of topics already discussed

    def _build_memory_context(self) -> str:
        """Build a compact summary of what we know so far."""
        if not self.project_context:
            return "New conversation — no project info collected yet."
        lines = []
        for key, value in self.project_context.items():
            lines.append(f"- {key}: {value}")
        lines.append(f"- Conversation stage: {self.stage}")
        lines.append(f"- Topics already discussed: {', '.join(self.info_gathered) if self.info_gathered else 'None yet'}")
        return "\n".join(lines)

    def _update_context(self, user_input: str, bot_response: str):
        """Lightweight context tracking from conversation."""
        t = user_input.lower()

        # Detect stage progression based on conversation length
        exchange_count = len(self.history) // 2
        if exchange_count >= 5 and self.stage == "strategy":
            self.stage = "lead_capture"
        elif exchange_count >= 4 and self.stage == "qualification":
            self.stage = "strategy"
        elif exchange_count >= 3 and self.stage == "deep_dive":
            self.stage = "qualification"
        elif exchange_count >= 2 and self.stage == "discovery":
            self.stage = "deep_dive"

        # Track discussed topics
        topic_signals = {
            "target_users": ["users", "customers", "audience", "who", "consumer", "business"],
            "monetization": ["revenue", "money", "subscription", "pricing", "charge", "monetize", "paid"],
            "tech_stack": ["tech", "technology", "stack", "framework", "language", "react", "flutter", "python"],
            "budget": ["budget", "cost", "price", "rs", "usd", "lakh", "$", "invest"],
            "timeline": ["timeline", "deadline", "launch", "months", "weeks", "when"],
            "competitors": ["competitor", "like uber", "like airbnb", "similar to", "existing"],
            "features": ["feature", "functionality", "module", "can", "should", "allow"],
        }
        for topic, signals in topic_signals.items():
            if any(s in t for s in signals) and topic not in self.info_gathered:
                self.info_gathered.append(topic)

    def invoke(self, data: dict) -> dict:
        user_input = data["input"]
        memory_context = self._build_memory_context()

        result = get_chat_response(user_input, self.history, memory_context, self.stage)

        # Update history
        self.history.append(HumanMessage(content=user_input))
        self.history.append(AIMessage(content=result["message"]))

        # Update project context tracker
        self._update_context(user_input, result["message"])

        return result


def get_agent_executor(session_id="default"):
    return ConsultantAgent()


# ─────────────────────────────────────────────
# 🔥 RAG UTILITIES
# ─────────────────────────────────────────────
def split_docs(documents):
    return RecursiveCharacterTextSplitter(
        chunk_size=Config.CHUNK_SIZE,
        chunk_overlap=Config.CHUNK_OVERLAP,
    ).split_documents(documents)


def add_to_vectorstore(docs):
    global _vectorstore_cache
    embeddings = GoogleGenerativeAIEmbeddings(model=Config.EMBEDDING_MODEL)
    if os.path.exists(Config.VECTORSTORE_PATH):
        db = FAISS.load_local(
            Config.VECTORSTORE_PATH,
            embeddings,
            allow_dangerous_deserialization=True,
        )
        db.add_documents(docs)
    else:
        db = FAISS.from_documents(docs, embeddings)
    db.save_local(Config.VECTORSTORE_PATH)
    # Invalidate cache so new docs are picked up
    _vectorstore_cache = None
    return True