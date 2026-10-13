from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Discussion, Lead, LeadStatus
from ..schemas import (
    DiscussionAdded,
    DiscussionCreate,
    DiscussionOut,
    LeadCreate,
    LeadOut,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["leads"])


def _latest_discussion(db: Session, lead_id: int) -> Discussion | None:
    return db.scalars(
        select(Discussion)
        .where(Discussion.lead_id == lead_id)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
        .limit(1)
    ).first()


def _lead_out(lead: Lead, last: Discussion | None) -> LeadOut:
    out = LeadOut.model_validate(lead)
    out.last_note = last.note if last else None
    out.last_discussion_at = last.created_at if last else None
    return out


def _get_lead_or_404(db: Session, lead_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Lead {lead_id} not found")
    return lead


@router.get("", response_model=list[LeadOut])
def list_leads(
    status_: LeadStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, description="Case-insensitive name search"),
    db: Session = Depends(get_db),
):
    stmt = select(Lead)
    if status_:
        stmt = stmt.where(Lead.status == status_)
    if q and q.strip():
        stmt = stmt.where(func.lower(Lead.name).contains(q.strip().lower(), autoescape=True))
    leads = db.scalars(stmt).all()
    if not leads:
        return []

    # Latest discussion per lead in one query (avoids N+1).
    newest = (
        select(Discussion.lead_id, func.max(Discussion.id).label("max_id"))
        .where(Discussion.lead_id.in_([lead.id for lead in leads]))
        .group_by(Discussion.lead_id)
        .subquery()
    )
    last_by_lead = {
        d.lead_id: d
        for d in db.scalars(select(Discussion).join(newest, Discussion.id == newest.c.max_id))
    }
    out = [_lead_out(lead, last_by_lead.get(lead.id)) for lead in leads]
    # Most recently touched first; leads with no discussion fall back to creation time.
    out.sort(key=lambda lead: lead.last_discussion_at or lead.created_at, reverse=True)
    return out


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, None)


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = _get_lead_or_404(db, lead_id)
    return _lead_out(lead, _latest_discussion(db, lead_id))


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)):
    lead = _get_lead_or_404(db, lead_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "name cannot be empty")
    if "status" in changes and changes["status"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "status cannot be null")
    for key, value in changes.items():
        setattr(lead, key, value)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, _latest_discussion(db, lead_id))


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = _get_lead_or_404(db, lead_id)
    db.delete(lead)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{lead_id}/discussions", response_model=list[DiscussionOut])
def list_discussions(lead_id: int, db: Session = Depends(get_db)):
    _get_lead_or_404(db, lead_id)
    return db.scalars(
        select(Discussion)
        .where(Discussion.lead_id == lead_id)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
    ).all()


@router.post(
    "/{lead_id}/discussions", response_model=DiscussionAdded, status_code=status.HTTP_201_CREATED
)
def add_discussion(lead_id: int, payload: DiscussionCreate, db: Session = Depends(get_db)):
    lead = _get_lead_or_404(db, lead_id)
    discussion = Discussion(lead_id=lead_id, note=payload.note, follow_up_at=payload.follow_up_at)
    db.add(discussion)
    if payload.follow_up_at is not None:
        lead.follow_up_at = payload.follow_up_at
    db.commit()
    db.refresh(discussion)
    db.refresh(lead)
    return DiscussionAdded(
        discussion=DiscussionOut.model_validate(discussion), lead=_lead_out(lead, discussion)
    )
