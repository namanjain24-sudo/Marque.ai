"""F4 style knobs (PRD Section 9.3 / Table 14) — the only things the fix loop
is allowed to change. Deliberately a small closed set rather than free-form
LLM edits, for the same reliability reason F5's renderer uses slot templates
instead of free coordinates: closed vocabularies are predictable, free-form
ones aren't.

Ground truth for these values is the frontend renderer
(`frontend/src/components/AssetPreview.jsx`): the browser IS the renderer in
this app (it rasterizes the rendered asset to PNG for the Signal Check), so a
critic's suggested knob only means something if it maps to a real visual
change AssetPreview actually makes. The vocabulary below therefore matches
what that component reads, not the PRD's original illustrative list.

`density` and `accent_usage` differ from the PRD's example wording on purpose:
AssetPreview renders `density` as open/balanced vertical padding and
`accent_usage` as a continuous 0-1 opacity/height, so those are what the
critic is allowed to suggest.
"""

KNOB_VALUES = {
    "density": ["open", "balanced"],
    "font_style": ["display_bold", "serif_elegant", "rounded_friendly", "clean_sans"],
    "photo_tone": ["warm", "neutral", "cool", "dark"],
    "layout_variant": ["left", "center", "split"],
}

# Continuous knobs (not enums) — validated by range, matching AssetPreview:
#   accent_usage -> accent bar opacity + height (0 = none, 1 = full)
#   overlay      -> dark scrim opacity over the photo gradient
ACCENT_RANGE = (0.0, 1.0)
OVERLAY_RANGE = (0.0, 0.8)
