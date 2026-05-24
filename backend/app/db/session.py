from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

# Engine SQLAlchemy synchrone. Simple et stable pour démarrer.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI qui ouvre puis ferme une session DB."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
