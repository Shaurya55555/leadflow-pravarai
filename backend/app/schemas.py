from datetime import datetime, timezone
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)

from .models import LeadStatus


def _clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def _max_len(limit: int):
    """Length check that tolerates None (pydantic's max_length/min_length constraints do not)."""

    def check(v: str | None) -> str | None:
        if v is not None and len(v) > limit:
            raise ValueError(f"must be at most {limit} characters")
        return v

    return check


OptionalName = Annotated[str | None, BeforeValidator(_clean), AfterValidator(_max_len(120))]
OptionalPhone = Annotated[str | None, BeforeValidator(_clean), AfterValidator(_max_len(40))]


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
    company: OptionalName = None
    phone: OptionalPhone = None
    status: LeadStatus = LeadStatus.NEW


class LeadUpdate(BaseModel):
    """Partial update. Omitted fields are untouched; follow_up_at may be null to clear it.

    A blank or null name/status is rejected by the route (422), since those are required.
    """

    name: OptionalName = None
    company: OptionalName = None
    phone: OptionalPhone = None
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
