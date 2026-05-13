from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.evolution import router as evolution_router

app = FastAPI(title="EvoMorph Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evolution_router, prefix="/api")


@app.get("/")
def health_check():
    return {"status": "EvoMorph Engine Online"}
