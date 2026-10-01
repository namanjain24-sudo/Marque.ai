"""P4 — the thin orchestrator: intent classification + brand-question + trace.

Zero-credit: heuristic path needs no key; LLM-path tests mock OpenRouter.
"""

import json

from orchestrator import _heuristic_intent, classify_intent


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


# --- Heuristic classifier (no key) ---

def test_heuristic_generation_is_create_campaign():
    assert _heuristic_intent("Launch our truffle burger ₹399").intent == "create_campaign"
    assert _heuristic_intent("Diwali combo offer").intent == "create_campaign"
    # A bare statement with no verb defaults to create_campaign (today's behaviour).
    assert _heuristic_intent("new Saket outlet").intent == "create_campaign"


def test_heuristic_question_is_brand_question():
    assert _heuristic_intent("what is our tone?").intent == "brand_question"
    assert _heuristic_intent("which colours do we use").intent == "brand_question"


def test_heuristic_rule_is_update_memory():
    i = _heuristic_intent("never use neon colours")
    assert i.intent == "update_memory"
    assert i.memory_field == "dont"
    assert "neon" in i.memory_value.lower()


def test_heuristic_generation_wins_over_question_words():
    # "make a poster asking ..." is still a generation, not a question.
    assert _heuristic_intent("make a poster for the weekend sale").intent == "create_campaign"


async def test_classify_intent_no_key_is_heuristic(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    intent, source = await classify_intent("what's our palette?")
    assert source == "heuristic"
    assert intent.intent == "brand_question"


# --- LLM classifier (mocked) ---

async def test_classify_intent_llm_path(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(
            json.dumps({"intent": "update_memory", "memory_field": "dont", "memory_value": "no neon"})
        ),
    )
    intent, source = await classify_intent("please never use neon")
    assert source == "llm"
    assert intent.intent == "update_memory"
    assert intent.memory_value == "no neon"


async def test_classify_intent_llm_bad_json_falls_back_to_heuristic(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response("not json"),
    )
    intent, source = await classify_intent("Launch our burger ₹99")
    # Classifier failed -> heuristic, which reads this as a generation goal.
    assert source == "heuristic"
    assert intent.intent == "create_campaign"
