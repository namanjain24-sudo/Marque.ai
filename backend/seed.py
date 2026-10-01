"""Demo brand so the app is never empty on first run. See PRD Section 9.1 / Section 11."""

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
