from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database import connect_db, disconnect_db
from src.routers import ai, analytics, institutes, ocr, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(
    title="AIOS Data Engine & API",
    description="Python FastAPI backend powering the AIOS academic platform.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(ai.router)
app.include_router(institutes.router)
app.include_router(users.router)
app.include_router(analytics.router)
app.include_router(ocr.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the AIOS Python Engine", "status": "online"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
