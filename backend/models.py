import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("brand"))
    profile_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("c"))
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    objective: Mapped[str | None] = mapped_column(String, nullable=True)
    message: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("a"))
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), nullable=False)
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    layout_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    png_url: Mapped[str | None] = mapped_column(String, nullable=True)
    signal_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rules_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("p"))
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)


class Audit(Base):
    __tablename__ = "audits"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("aud"))
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), nullable=False)
    images_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    scores_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    issues_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("run"))
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), nullable=False)
    input: Mapped[str | None] = mapped_column(String, nullable=True)
    trace_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=list)
    status: Mapped[str] = mapped_column(String, default="running")
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
