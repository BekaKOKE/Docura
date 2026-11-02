import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, companies, health
from app.config import Settings, get_settings
from app.errors import install_error_handlers
from app.rate_limit import RateLimiter
from app.repositories import build_storage

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    if settings.jwt_secret_is_random:
        logger.warning(
            "JWT_SECRET is not set: using a random secret, so tokens won't survive a restart. Production must set it."
        )
    app = FastAPI(title="Docura API", version="0.1.0")
    app.state.settings = settings
    app.state.storage = build_storage(settings)
    app.state.auth_rate_limiter = RateLimiter()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(companies.router, prefix="/api")
    return app


app = create_app()
