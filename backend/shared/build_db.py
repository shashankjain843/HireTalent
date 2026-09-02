from shared.data_loader import load_website
from .rag_pipeline import split_docs, add_to_vectorstore

docs = load_website()
chunks = split_docs(docs)
add_to_vectorstore(chunks)

print("Vector DB ready and synchronized with RAG pipeline!")