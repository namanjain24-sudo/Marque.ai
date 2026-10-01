"""F4 style knobs (PRD Section 9.3 / Table 14) — the only things the fix loop
is allowed to change. Deliberately a small closed set rather than free-form
LLM edits, for the same reliability reason F5's renderer uses slot templates
instead of free coordinates: closed vocabularies are predictable, free-form
ones aren't.

There is no renderer yet (F5), so nothing currently *applies* these knobs to
an asset — check_signals proposes them, same as the PRD's check_signals tool
contract (PNG, targets, profile -> Signal Result JSON) describes. Wiring a
real apply-and-re-render loop is F5's job.
"""

KNOB_VALUES = {
    "density": ["low", "medium", "high"],
    "font_style": ["display_bold", "serif_elegant", "rounded_friendly", "clean_sans"],
    "photo_tone": ["warm", "neutral", "cool", "dark"],
    "accent_usage": ["low", "medium", "high"],
    "layout_variant": ["left", "center", "split"],
}

# overlay is continuous (0.0-0.6), not an enum — validated separately.
OVERLAY_RANGE = (0.0, 0.6)
