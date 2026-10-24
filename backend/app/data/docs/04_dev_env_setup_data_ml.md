# Data and ML Platform Setup

## Environment Requirements
The Data and Machine Learning pipeline utilizes:
1. Python 3.11 with Conda or Python venv
2. PyTorch 2.x with CUDA 12 support (or MPS for Apple Silicon)
3. Local ChromaDB instance for semantic search and embeddings
4. Kafka local cluster via Docker Compose

## Pipeline Configuration
Set up your ML virtual environment:
```bash
git clone https://github.com/company/ml-platform.git
cd ml-platform
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-ml.txt
```

## Running Vector Store and Hybrid Retrieval Sandbox
Initialize local ChromaDB and index seed embeddings:
```bash
python scripts/index_documents.py --persist-dir ./chroma_db
```
Verify the embedding test script passes:
```bash
python -m pytest tests/test_retrieval.py
```
This tests both dense all-MiniLM-L6-v2 vector lookups and sparse BM25 keyword matching.

## Feature Store & Data Governance
Never train models on unmasked PII. All training datasets must pull features via the feature store registry where automated hashing of personal identifiers is enforced.
