from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api import api_router


# Initialize tables immediately on startup/import
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to initialize resources on startup."""
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FlowPilot – AI-Powered Workflow Automation Platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint to verify backend service status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
def root():
    """Root endpoint welcoming developers with links to documentation."""
    return {
        "message": "Welcome to FlowPilot API",
        "documentation": "/docs",
        "health": "/health"
    }


# Include all API routes
app.include_router(api_router, prefix=settings.API_V1_STR)
