from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_serializer, field_validator

from .models import LeadStatus


def _clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


OptionalText = Annotated[str | None, BeforeValidator(_clean)]


def _to_naive_utc(v: datetime | None) -> datetime | None:
    if v is None:
        return None
    if v.tzinfo is None:  # treat naive input as UTC
        return v
    return v.astimezone(timezone.utc).replace(tzinfo=None)


def _iso_utc(v: datetime | None) -> str | None:
    return None if v is None else v.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


class LeadCreate(BaseModel):
    name: Annotated[str, BeforeValidator(_clean), Field(min_length=1, max_length=120)]
    company: OptionalText = Field(default=None, max_length=120)
    phone: OptionalText = Field(default=None, max_length=40)
    status: LeadStatus = LeadStatus.NEW


class LeadUpdate(BaseModel):
    """Partial update. Omitted fields are untouched; follow_up_at may be null to clear it."""

    name: Annotated[str | None, BeforeValidator(_clean), Field(min_length=1, max_length=120)] = None
    company: OptionalText = Field(default=None, max_length=120)
    phone: OptionalText = Field(default=None, max_length=40)
    status: LeadStatus | None = None
    follow_up_at: datetime | None = None

    @field_validator("follow_up_at")
    @classmethod
    def _utc(cls, v):
        return _to_naive_utc(v)


class DiscussionCreate(BaseModel):
    note: Annotated[str, BeforeValidator(_clean), Field(min_length=1, max_length=5000)]
    follow_up_at: datetime | None = None

    @field_validator("follow_up_at")
    @classmethod
    def _utc(cls, v):
        return _to_naive_utc(v)


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    note: str
    follow_up_at: datetime | None
    created_at: datetime

    @field_serializer("follow_up_at", "created_at")
    def _ser(self, v: datetime | None):
        return _iso_utc(v)


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    company: str | None
    phone: str | None
    status: LeadStatus
    follow_up_at: datetime | None
    created_at: datetime
    last_note: str | None = None
    last_discussion_at: datetime | None = None

    @field_serializer("follow_up_at", "created_at", "last_discussion_at")
    def _ser(self, v: datetime | None):
        return _iso_utc(v)


class DiscussionAdded(BaseModel):
    discussion: DiscussionOut
    lead: LeadOut
