from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
import os
from dotenv import load_dotenv

load_dotenv()

from .config import Config

# Embedding model
def get_embeddings():
    return GoogleGenerativeAIEmbeddings(model=Config.EMBEDDING_MODEL)

# Create vector store
def create_vectorstore(docs):
    embeddings = get_embeddings()
    db = FAISS.from_documents(docs, embeddings)
    db.save_local("vectorstore/")
    return db

# Load vector store
def load_vectorstore():
    embeddings = get_embeddings()
    # Allow dangerous deserialization for local FAISS
    db = FAISS.load_local("vectorstore/", embeddings, allow_dangerous_deserialization=True)
    return db