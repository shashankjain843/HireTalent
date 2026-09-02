from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader, Docx2txtLoader
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os


# 🔥 CLEAN HTML CONTENT
def clean_html(html):
    soup = BeautifulSoup(html, "html.parser")

    # Remove scripts & styles
    for tag in soup(["script", "style"]):
        tag.decompose()

    text = soup.get_text(separator="\n")

    # Clean empty lines
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    return "\n".join(lines)


# 🔥 AUTO WEBSITE CRAWLER (IMPROVED)
def auto_crawl(base_url, max_pages=20):
    try:
        visited = set()
        to_visit = [base_url]
        domain = urlparse(base_url).netloc

        while to_visit and len(visited) < max_pages:
            current = to_visit.pop(0)

            if current in visited:
                continue

            visited.add(current)

            try:
                response = requests.get(current, timeout=8)
                soup = BeautifulSoup(response.text, "html.parser")

                for a in soup.find_all("a", href=True):
                    link = urljoin(base_url, a["href"])

                    if urlparse(link).netloc == domain and link not in visited:
                        to_visit.append(link)

            except:
                continue

        return list(visited)

    except Exception as e:
        print(f"Crawl error: {e}")
        return [base_url]


from langchain_core.documents import Document

# 🔥 LOAD WEBSITE CONTENT
def load_website(url=None, max_pages=20):
    target_url = url if url else "https://appicsoftwares.com"

    print(f"Crawling {target_url}...")

    urls = auto_crawl(target_url, max_pages=max_pages)

    docs = []

    for u in urls:
        try:
            res = requests.get(u, timeout=8)
            cleaned = clean_html(res.text)

            docs.append(Document(
                page_content=cleaned,
                metadata={"source": u}
            ))

        except Exception as e:
            print(f"Error loading {u}: {e}")

    return docs


# 🔥 FILE LOADER (UNCHANGED BUT CLEAN)
def load_uploaded_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        loader = PyPDFLoader(file_path)

    elif ext == ".docx":
        loader = Docx2txtLoader(file_path)

    else:
        raise ValueError("Unsupported file format. Use PDF or DOCX.")

    return loader.load()