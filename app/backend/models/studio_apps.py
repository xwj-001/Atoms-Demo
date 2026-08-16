from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Studio_apps(Base):
    __tablename__ = "studio_apps"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    local_id = Column(Integer, index=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    style = Column(String, nullable=False)
    versions_json = Column(String, nullable=False)
    current_version_index = Column(Integer, nullable=False)
    version_count = Column(Integer, nullable=True)
    tags = Column(String, nullable=True)
    is_public = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)