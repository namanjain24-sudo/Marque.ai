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

import time

from asset_gen import generate_campaign
from db import get_session
from models import Asset, Brand, Campaign, utcnow
from orchestrator import answer_brand_question, classify_intent
from schemas import AgentRunIn, AgentRunOut, AssetOut, BrandProfile, CampaignOut, MAX_LIST_ITEMS

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


async def _persist_campaign(session: AsyncSession, brand_id: str, campaign_data: dict) -> None:
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


@router.post("/agent/run", response_model=AgentRunOut, status_code=201)
async def agent_run(brand_id: str, payload: AgentRunIn, session: AsyncSession = Depends(get_session)):
    """P4 — the thin orchestrator. Classify the message, do the matching thing,
    and return a REAL trace of what ran (not a canned list). Backward compatible:
    a generation message still produces + persists a campaign, now nested under
    `campaign` with `intent="create_campaign"`."""
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    profile = BrandProfile(**brand.profile_json)

    trace: list[dict] = []

    def step(label: str, fn_ms: int) -> None:
        trace.append({"label": label, "ms": max(0, int(fn_ms))})

    # 1. Load brand memory (already done above) — record it as a real step.
    t0 = time.monotonic()
    step("Loaded brand memory", round((time.monotonic() - t0) * 1000))

    # 2. Classify intent (LLM when keyed, else heuristic).
    t0 = time.monotonic()
    intent, source = await classify_intent(payload.goal)
    step(f"Classified intent: {intent.intent} ({source})", round((time.monotonic() - t0) * 1000))

    # 3a. update_memory — append the extracted rule.
    if intent.intent == "update_memory":
        field = intent.memory_field or "dont"
        value = (intent.memory_value or payload.goal).strip()[:200]
        locked = await session.get(Brand, brand_id, with_for_update=True)
        current = BrandProfile(**locked.profile_json)
        current_list = getattr(current, field)
        t0 = time.monotonic()
        if value not in current_list and len(current_list) < (
            MAX_LIST_ITEMS * 2 if field == "preferences" else MAX_LIST_ITEMS
        ):
            merged = current.model_copy(
                update={field: [*current_list, value], "version": current.version + 1}
            )
            locked.profile_json = merged.model_dump(mode="json")
            await session.commit()
        step(f"Added a {field} rule to brand memory", round((time.monotonic() - t0) * 1000))
        return AgentRunOut(
            intent="update_memory",
            source=source,
            trace=trace,
            reply=f'Got it — added "{value}" to your {field} rules.',
            memory_field=field,
            memory_value=value,
        )

    # 3b. brand_question — answer from memory.
    if intent.intent == "brand_question":
        t0 = time.monotonic()
        answer = await answer_brand_question(profile, payload.goal)
        step("Answered from brand memory", round((time.monotonic() - t0) * 1000))
        return AgentRunOut(intent="brand_question", source=source, trace=trace, reply=answer)

    # 3c. create_campaign (default) — write copy, generate + persist assets.
    t0 = time.monotonic()
    today = utcnow().date().isoformat()
    campaign_data = await generate_campaign(profile, payload.goal, today=today)
    step("Wrote creative core + planned 4 assets", round((time.monotonic() - t0) * 1000))

    t0 = time.monotonic()
    await _persist_campaign(session, brand_id, campaign_data)
    step("Rendered 4 assets and saved the campaign", round((time.monotonic() - t0) * 1000))

    return AgentRunOut(
        intent="create_campaign",
        source=source,
        trace=trace,
        reply=f'Generated "{campaign_data["name"]}" — {len(campaign_data["assets"])} assets.',
        campaign=CampaignOut(**campaign_data),
    )


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
