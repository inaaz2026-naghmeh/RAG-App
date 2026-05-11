import os
import shutil
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store vector store and LLM
vector_store = None
llm = None

# Initialize embeddings (local)
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

class QueryRequest(BaseModel):
    question: str

@app.get("/")
async def root():
    return {"message": "Excel RAG API is running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global vector_store, llm
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported.")

    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        df = pd.read_excel(temp_path)
        text_content = df.to_string(index=False)
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_text(text_content)

        vector_store = FAISS.from_texts(chunks, embeddings)
        
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
            
        llm = ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.3-70b-versatile",
            temperature=0.1
        )

        os.remove(temp_path)
        return {"message": "File processed and index created successfully"}
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query_rag(request: QueryRequest):
    global vector_store, llm
    
    if vector_store is None or llm is None:
        raise HTTPException(status_code=400, detail="Please upload an Excel file first.")
    
    try:
        # Manual Retrieval
        docs = vector_store.similarity_search(request.question, k=4)
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Manual Prompt Construction
        prompt = f"""
        You are an assistant for question-answering tasks based on an Excel file.
        Use the following pieces of retrieved context to answer the question.
        If you don't know the answer, just say that you don't know, don't try to make up an answer.
        
        Context: {context}
        
        Question: {request.question}
        
        Answer:
        """
        
        response = llm.invoke(prompt)
        return {"answer": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
