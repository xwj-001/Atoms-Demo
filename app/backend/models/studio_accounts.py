from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Studio_accounts(Base):
    __tablename__ = "studio_accounts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    password_salt = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=True)
    last_login_at = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)