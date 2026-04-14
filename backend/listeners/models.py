"""Pydantic models for the SMM Listener subsystem.

Mirrors the schema in docs/facebook-listener-spec.md §L1/L2. Models live here
instead of in server.py to keep the monolith lean.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuietHours(BaseModel):
    start: str = "22:00"  # HH:MM
    end: str = "07:00"
    tz: str = "Europe/Berlin"


class ListenerConfig(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    negative_keywords: list[str] = Field(default_factory=list)
    personas: str = ""
    languages: list[str] = Field(default_factory=lambda: ["en"])
    group_allowlist: list[str] = Field(default_factory=list)
    group_blocklist: list[str] = Field(default_factory=list)
    cadence: Literal["15min", "hourly", "daily"] = "hourly"
    digest_cadence: Literal["daily", "weekly"] = "weekly"
    quiet_hours: Optional[QuietHours] = None
    min_confidence: float = 0.7
    # Per-listener toggle: auto-create a Lead when a high-confidence buying_signal
    # has no matching existing lead (spec §7 Q3). Default off — admins opt in.
    auto_create_lead_on_buying_signal: bool = False
    # Default assignee for tasks auto-created by this listener. Falls back to
    # listener.created_by if unset (spec §7 Q4).
    default_assignee_id: Optional[str] = None


class Listener(BaseModel):
    model_config = ConfigDict(extra="ignore")
    listener_id: str
    organization_id: str
    campaign_id: str
    channel: Literal["facebook"] = "facebook"
    status: Literal["active", "paused", "archived"] = "active"
    config: ListenerConfig
    stats: dict = Field(default_factory=dict)
    created_by: str
    created_at: datetime
    updated_at: datetime


class ListenerCreate(BaseModel):
    campaign_id: str
    channel: Literal["facebook"] = "facebook"
    config: ListenerConfig


class ListenerUpdate(BaseModel):
    status: Optional[Literal["active", "paused", "archived"]] = None
    config: Optional[ListenerConfig] = None


class ListenerSource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    source_id: str
    listener_id: str
    type: Literal["fb_page", "fb_group"]
    external_id: str
    url: str
    name: str
    status: Literal["pending_review", "active", "rejected"] = "pending_review"
    discovered_by: Literal["manual", "discover_agent"] = "manual"
    joined_at: Optional[datetime] = None
    last_scanned_at: Optional[datetime] = None
    created_at: datetime


class SourceCreate(BaseModel):
    type: Literal["fb_page", "fb_group"]
    url: str
    name: Optional[str] = None
    external_id: Optional[str] = None


class SourcePatch(BaseModel):
    status: Optional[Literal["pending_review", "active", "rejected"]] = None
    joined: Optional[bool] = None  # sugar: sets joined_at=now when true


class Author(BaseModel):
    name: str = ""
    profile_url: str = ""


class ListenerHit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hit_id: str
    listener_id: str
    source_id: str
    external_post_id: str
    url: str
    author: Author
    text: str
    matched_keywords: list[str] = Field(default_factory=list)
    classification: str = "noise"
    confidence: float = 0.0
    sentiment: Optional[str] = None
    suggested_reply: Optional[str] = None
    acted_on: bool = False
    related_task_id: Optional[str] = None
    seen_at: datetime
    classified_at: Optional[datetime] = None


class HitPatch(BaseModel):
    acted_on: Optional[bool] = None
    related_task_id: Optional[str] = None


class ListenerReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    report_id: str
    listener_id: str
    period_start: datetime
    period_end: datetime
    summary: dict = Field(default_factory=dict)
    body_markdown: str = ""
    delivered_at: Optional[datetime] = None
