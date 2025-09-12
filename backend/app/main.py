from fastapi import FastAPI, Depends

from .core.config import settings
from .core.context_manager import lifespan
from fastapi.middleware.cors import CORSMiddleware
from .core.dependencies import require_active_user

# Import routers
from .api.v1.auth.router import router as auth_router
from .api.v1.notes.router import router as notes_router
from .api.v1.health.router import router as health_router
from .api.v1.orders.router import router as orders_router
from .api.v1.reports.router import router as reports_router
from .api.v1.products.router import router as products_router
from .api.v1.expenses.router import router as expenses_router
from .api.v1.customers.router import router as customers_router

# Create FastAPI app with lifespan
app = FastAPI(
    title = "Orders tracker Backend",
    root_path = "/api",
    lifespan = lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins = settings.cors_origins,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"]
)

# Include routers
app.include_router(auth_router)
app.include_router(health_router)
app.include_router(customers_router, dependencies=[Depends(require_active_user)])
app.include_router(products_router, dependencies=[Depends(require_active_user)])
app.include_router(orders_router, dependencies=[Depends(require_active_user)])
app.include_router(expenses_router, dependencies=[Depends(require_active_user)])
app.include_router(notes_router, dependencies=[Depends(require_active_user)])
app.include_router(reports_router, dependencies=[Depends(require_active_user)])