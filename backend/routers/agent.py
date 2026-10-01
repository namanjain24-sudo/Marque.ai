"""F5 (light) + agent entry point.

POST /v1/brands/{brand_id}/agent/run — the hero chat / Workspace AskBar lands
here. For now it always generates a deterministic campaign (asset_gen.py) and
persists it; a real intent-classifying orchestrator (F7) slots in behind this
same route later.

Campaigns + assets are stored in the existing (previously unused) `campaigns`
and `assets` tables. An asset's slots+knobs live in `assets.layout_json`.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from asset_gen import generate_campaign
from db import get_session
from models import Asset, Brand, Campaign, utcnow
from schemas import AgentRunIn, AssetOut, BrandProfile, CampaignOut

router = APIRouter(prefix="/v1/brands/{brand_id}", tags=["agent"])
campaigns_router = APIRouter(prefix="/v1/campaigns", tags=["campaigns"])


def _campaign_to_out(campaign: Campaign, assets: list[Asset]) -> CampaignOut:
    """Rebuild the frontend campaign contract from persisted rows. Each asset's
    slots/knobs/type/label/size and any stored signal result live in
    layout_json; the campaign's own metadata lives in dedicated columns."""
    asset_outs = []
    for a in sorted(assets, key=lambda x: x.created_at):
        layout = a.layout_json or {}
        signal = a.signal_json or {}
        asset_outs.append(
            AssetOut(
                id=a.id,
                type=a.type,
                label=layout.get("label", a.type.title()),
                size=layout.get("size", ""),
                signal_match=signal.get("match"),
                signal_verdict=signal.get("verdict"),
                slots=layout.get("slots", {}),
                knobs=layout.get("knobs", {}),
            )
        )
    return CampaignOut(
        id=campaign.id,
        name=campaign.name,
        objective=campaign.objective or "",
        core_message=campaign.message or "",
        status=campaign.status,
        date=campaign.created_at.date().isoformat(),
        assets=asset_outs,
    )


@router.post("/agent/run", response_model=CampaignOut, status_code=201)
async def agent_run(brand_id: str, payload: AgentRunIn, session: AsyncSession = Depends(get_session)):
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    profile = BrandProfile(**brand.profile_json)
    today = utcnow().date().isoformat()
    campaign_data = await generate_campaign(profile, payload.goal, today=today)

    campaign = Campaign(
        id=campaign_data["id"],
        brand_id=brand_id,
        name=campaign_data["name"],
        objective=campaign_data["objective"],
        message=campaign_data["core_message"],
        status=campaign_data["status"],
    )
    session.add(campaign)
    # Flush so the campaign row exists before its assets reference it
    # (assets.campaign_id FK) — without this asyncpg can order the asset
    # inserts first and hit a foreign-key violation.
    await session.flush()

    for asset_data in campaign_data["assets"]:
        session.add(
            Asset(
                id=asset_data["id"],
                brand_id=brand_id,
                campaign_id=campaign.id,
                type=asset_data["type"],
                # Everything the renderer needs travels together in layout_json.
                layout_json={
                    "label": asset_data["label"],
                    "size": asset_data["size"],
                    "slots": asset_data["slots"],
                    "knobs": asset_data["knobs"],
                },
            )
        )

    await session.commit()
    # Return the generated shape directly (validated) rather than re-reading —
    # it already matches CampaignOut and carries the per-format date.
    return CampaignOut(**campaign_data)


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    brand_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    result = await session.execute(
        select(Campaign)
        .where(Campaign.brand_id == brand_id)
        .order_by(Campaign.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    campaigns = result.scalars().all()

    if not campaigns:
        return []

    # Single IN query to fetch all assets for these campaigns at once — avoids
    # the N+1 loop that was querying once per campaign.
    campaign_ids = [c.id for c in campaigns]
    assets_result = await session.execute(
        select(Asset).where(Asset.campaign_id.in_(campaign_ids))
    )
    all_assets = assets_result.scalars().all()

    # Group assets by campaign_id for O(1) lookup below.
    assets_by_campaign: dict[str, list[Asset]] = {c.id: [] for c in campaigns}
    for a in all_assets:
        if a.campaign_id in assets_by_campaign:
            assets_by_campaign[a.campaign_id].append(a)

    return [_campaign_to_out(c, assets_by_campaign[c.id]) for c in campaigns]


@campaigns_router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: str, session: AsyncSession = Depends(get_session)):
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    assets = (
        await session.execute(select(Asset).where(Asset.campaign_id == campaign_id))
    ).scalars().all()
    return _campaign_to_out(campaign, list(assets))
