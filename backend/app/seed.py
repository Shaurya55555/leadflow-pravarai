"""Seed demo data: python -m app.seed [--reset]"""
import sys
from datetime import timedelta

from .database import Base, SessionLocal, engine
from .security import ensure_demo_user
from .models import Discussion, Lead, LeadStatus, utcnow

# (name, company, phone, status, follow-up offset from now, [(days_ago, note), ...])
SEED = [
    ("Aarav Mehta", "Zenith Capital", "+91 98200 11122", LeadStatus.QUALIFIED, timedelta(hours=2),
     [(9, "Intro call. Runs a 40-person advisory firm, unhappy with spreadsheets."),
      (4, "Demo done. Wants portfolio rebalancing alerts."),
      (0.2, "Sent pricing sheet; will confirm budget with partners.")]),
    ("Priya Nair", "Bluepine Wealth", "+91 98450 33210", LeadStatus.PROPOSAL_SENT, timedelta(hours=-26),
     [(14, "Referred by Rohan. Interested in client onboarding flows."),
      (6, "Walked through proposal. Asked for SOC2 details."),
      (2, "Shared SOC2 summary, waiting on legal.")]),
    ("Kabir Singh", "Northstar Advisors", None, LeadStatus.NEW, None, []),
    ("Ananya Rao", "Orchid Financial", "+91 99001 44556", LeadStatus.CONTACTED, timedelta(days=2),
     [(3, "Left voicemail and sent intro email."),
      (1, "Replied on email, open to a call next week.")]),
    ("Vikram Joshi", "Joshi & Sons", "+91 97110 88990", LeadStatus.WON, None,
     [(30, "Initial call went well."),
      (18, "Contract redlines received."),
      (7, "Signed. Kickoff scheduled for next month.")]),
    ("Meera Iyer", "Harbor Partners", "+91 98860 77001", LeadStatus.LOST, None,
     [(21, "Evaluating two other vendors."),
      (8, "Chose a competitor on price. Revisit in Q2.")]),
    ("Rahul Verma", None, "+91 90000 12345", LeadStatus.CONTACTED, timedelta(minutes=-45),
     [(5, "Cold outreach, asked to call back after the quarter close."),
      (1, "Quick check-in, still busy; follow up this week.")]),
]


def run(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    ensure_demo_user()
    now = utcnow()
    with SessionLocal() as db:
        if db.query(Lead).count():
            print("Database already has leads; use --reset to reseed.")
            return
        for name, company, phone, status, follow_offset, notes in SEED:
            lead = Lead(
                name=name, company=company, phone=phone, status=status,
                follow_up_at=(now + follow_offset) if follow_offset is not None else None,
                created_at=now - timedelta(days=(notes[0][0] if notes else 1) + 1),
            )
            db.add(lead)
            db.flush()
            for days_ago, note in notes:
                db.add(Discussion(lead_id=lead.id, note=note, created_at=now - timedelta(days=days_ago)))
        db.commit()
    print(f"Seeded {len(SEED)} leads.")


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
