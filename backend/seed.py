"""Demo seed so the app is never empty on first run (local or prod).

Historically this file only held the demo *brand* and `main.py` inserted it on
startup. That left every other table empty — Campaigns, Library and Audit pages
came up bare on a fresh prod DB, which is a weak first impression for a demo.

`seed_all(session)` now fills the whole picture for the demo brand, idempotently:

    brands    — Burger Lab (the demo brand)
    products  — its menu rows (also embedded in the profile, but the table was unused)
    campaigns — 3 realistic campaigns, generated through the SAME engine
                (`asset_gen.generate_campaign`) the live /agent/run route uses,
                so seeded campaigns are byte-for-byte what a user would get
    assets    — the 4 assets per campaign that the engine emits (poster/post/
                story/whatsapp), stored exactly as the agent route stores them
    audits    — one sample audit record so the Audit history page has content
    runs      — one agent-run trace per campaign so the trace history is non-empty

Every step is guarded (`session.get(...)` / count check) so calling `seed_all`
on every boot is safe and cheap — it only writes what's missing. See PRD
Section 9.1 / Section 11.

Prod: `main.py`'s lifespan calls `seed_all` on startup, so a deploy seeds itself
with no manual step; re-running is a no-op once the rows exist.
"""

from sqlalchemy import func, select

from asset_gen import generate_campaign
from models import Asset, Audit, Brand, Campaign, Product, Run, utcnow
from schemas import BrandProfile

DEMO_BRAND_ID = "brand_burgerlab"

DEMO_BRAND_PROFILE = {
    "id": DEMO_BRAND_ID,
    "name": "Burger Lab",
    "category": "Restaurant - Burgers",
    "city": "Delhi",
    "audience": "18-30, urban, food-conscious",
    "price_level": 2,
    "products": [{"name": "Truffle Burger", "price": 399, "photo": "/u/truffle.jpg"}],
    "positioning": {"premium": 70, "modern": 80, "playful": 75, "niche": 55},
    "personality": ["bold", "playful", "experimental"],
    "palette": {
        "primary": "#E63946",
        "secondary": "#111111",
        "accent": "#F1FAEE",
        "light": "#FFFFFF",
        "dark": "#0B0B0B",
    },
    "fonts": {"heading": "Bebas Neue", "body": "Inter"},
    "logo": {"type": "wordmark", "url": None},
    "photo_style": "dark moody, close-up, high contrast",
    "voice": {"language": "Hinglish", "tone": "short, cheeky, no corporate words"},
    "meaning": {"black": "confidence", "red": "energy", "tight type": "modern"},
    "do": ["product close-ups", "high contrast", "price in a badge"],
    "dont": ["stock photos", "neon gradients", "corporate tone", "the word delicious"],
    "preferences": [],
    "version": 1,
}

# The full menu (the brand profile only carries the hero product). These land in
# the `products` table so the demo brand reads as a real business, not a stub.
DEMO_PRODUCTS = [
    {"name": "Truffle Burger", "price": 399.0, "photo_url": "/u/truffle.jpg"},
    {"name": "Classic Smash", "price": 249.0, "photo_url": "/u/smash.jpg"},
    {"name": "Paneer Makhani Burger", "price": 279.0, "photo_url": "/u/paneer.jpg"},
    {"name": "Loaded Fries", "price": 149.0, "photo_url": "/u/fries.jpg"},
]

# Campaign goals, phrased the way an owner would type them into the hero chat —
# the *subject* of the ad, not an instruction ("Truffle burger launch", not
# "Create a poster for..."), so the generated headline reads like real ad copy.
# generate_campaign turns each into a 4-asset campaign; realistic, on-brand,
# and consistent with what the live /agent/run route produces.
DEMO_CAMPAIGN_GOALS = [
    "Truffle burger launch at ₹399",
    "Weekend combo: Classic Smash + Loaded Fries at ₹349 this week only",
    "New Paneer Makhani Burger for the veg crowd",
]

# A pre-canned audit record so the Audit history page isn't empty. Shaped exactly
# like what routers/audit.py persists after a real run (scores_json / issues_json).
DEMO_AUDIT = {
    "images_json": {"count": 3},
    "scores_json": {
        "consistency_score": 72,
        "counts": {"font_styles": 2, "colour_treatments": 4, "photo_styles": 2},
    },
    "issues_json": {
        "issues": [
            {
                "text": "Inconsistent headline font — 2 different styles across 3 images.",
                "suggested_fix": "Standardise on one font style (most common here: display_bold).",
            },
            {
                "text": "Colour palette varies: 4 distinct treatments across 3 images.",
                "suggested_fix": "Pull every image back to the brand palette (primary + accent only).",
            },
        ],
        "alerts": ["Image 2 reads off-brand on 'premium' (gap -34)."],
    },
}


def _trace_for(goal: str, campaign_name: str) -> list[dict]:
    """A plausible agent trace for a seeded run, matching the step shape the
    Workspace trace panel renders (label + status + optional detail)."""
    return [
        {"step": "understand_goal", "status": "done", "detail": goal},
        {"step": "load_brand_memory", "status": "done", "detail": "Burger Lab — 4 Do / 4 Don't rules applied"},
        {"step": "generate_campaign", "status": "done", "detail": f"4 assets for '{campaign_name}'"},
        {"step": "await_signal_check", "status": "pending", "detail": "Run Signal Check per asset to score"},
    ]


async def _seed_brand(session) -> Brand:
    """Insert (and return) the demo brand, validating through BrandProfile so a
    malformed seed is a loud startup failure, not a lazy 500 later."""
    brand = await session.get(Brand, DEMO_BRAND_ID)
    if brand is None:
        profile = BrandProfile(**DEMO_BRAND_PROFILE)
        brand = Brand(id=DEMO_BRAND_ID, profile_json=profile.model_dump(mode="json"))
        session.add(brand)
        await session.flush()
    return brand


async def _seed_products(session) -> None:
    existing = await session.scalar(
        select(func.count()).select_from(Product).where(Product.brand_id == DEMO_BRAND_ID)
    )
    if existing:
        return
    for p in DEMO_PRODUCTS:
        session.add(
            Product(brand_id=DEMO_BRAND_ID, name=p["name"], price=p["price"], photo_url=p["photo_url"])
        )


async def _seed_campaigns(session, profile: BrandProfile) -> None:
    """Generate each demo campaign through the real engine and persist campaign +
    assets exactly as routers/agent.py does. Assets are tagged source='rendered'
    so the Library page labels them honestly (vs uploaded images)."""
    existing = await session.scalar(
        select(func.count()).select_from(Campaign).where(Campaign.brand_id == DEMO_BRAND_ID)
    )
    if existing:
        return

    today = utcnow().date().isoformat()
    for goal in DEMO_CAMPAIGN_GOALS:
        data = generate_campaign(profile, goal, today=today)
        campaign = Campaign(
            id=data["id"],
            brand_id=DEMO_BRAND_ID,
            name=data["name"],
            objective=data["objective"],
            message=data["core_message"],
            status=data["status"],
        )
        session.add(campaign)
        # Flush so the campaign row exists before its assets reference it (FK).
        await session.flush()

        for asset_data in data["assets"]:
            session.add(
                Asset(
                    id=asset_data["id"],
                    brand_id=DEMO_BRAND_ID,
                    campaign_id=campaign.id,
                    type=asset_data["type"],
                    layout_json={
                        "source": "rendered",
                        "label": asset_data["label"],
                        "size": asset_data["size"],
                        "slots": asset_data["slots"],
                        "knobs": asset_data["knobs"],
                    },
                )
            )

        # One run-trace per campaign so the trace history isn't empty.
        session.add(
            Run(
                brand_id=DEMO_BRAND_ID,
                input=goal,
                trace_json=_trace_for(goal, data["name"]),
                status="done",
                cost=0.0,
            )
        )


async def _seed_audit(session) -> None:
    existing = await session.scalar(
        select(func.count()).select_from(Audit).where(Audit.brand_id == DEMO_BRAND_ID)
    )
    if existing:
        return
    session.add(
        Audit(
            brand_id=DEMO_BRAND_ID,
            images_json=DEMO_AUDIT["images_json"],
            scores_json=DEMO_AUDIT["scores_json"],
            issues_json=DEMO_AUDIT["issues_json"],
        )
    )


async def seed_all(session) -> None:
    """Idempotently seed the full demo picture for Burger Lab. Safe to call on
    every startup: each step only writes when its table is empty for this brand.
    One commit at the end so the whole seed lands atomically."""
    brand = await _seed_brand(session)
    profile = BrandProfile(**brand.profile_json)

    await _seed_products(session)
    await _seed_campaigns(session, profile)
    await _seed_audit(session)

    await session.commit()
