import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1.auth import router as auth_router
from app.api.v1.children import router as children_router
from app.api.v1.growth import router as growth_router
from app.api.v1.feeding import router as feeding_router
from app.api.v1.sleep import router as sleep_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.ai import router as ai_router
from app.api.v1.health import router as health_router

from app.services.knowledge_service import seed_knowledge_base
from app.services.calendar_service import seed_health_rules

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Seed standard knowledge and health rules
    db = SessionLocal()
    try:
        seed_knowledge_base(db)
        seed_health_rules(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount(f"{settings.API_V1_STR}/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers under /api/babycare/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(children_router, prefix=settings.API_V1_STR)
app.include_router(growth_router, prefix=settings.API_V1_STR)
app.include_router(feeding_router, prefix=settings.API_V1_STR)
app.include_router(sleep_router, prefix=settings.API_V1_STR)
app.include_router(calendar_router, prefix=settings.API_V1_STR)
app.include_router(knowledge_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(health_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Welcome to HD²LAB BabyCare API",
        "version": "1.0.0",
        "docs": f"{settings.API_V1_STR}/docs"
    }
