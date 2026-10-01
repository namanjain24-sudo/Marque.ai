// components/AssetPreview.jsx — renders an asset. A saved upload (pngUrl) is shown
// as the real image; an F5-rendered asset (slots/knobs, no image) is drawn in CSS.
// Props: type, slots, knobs, palette, fonts, pngUrl
import { useEffect } from 'react'
import { loadBrandFonts } from '../lib/fonts'

// Aspect ratios per type
const ASPECT = {
  poster: '4 / 5',
  post: '1 / 1',
  story: '9 / 16',
  whatsapp: '1 / 1',
  other: '1 / 1',
}

// CSS gradient placeholder tinted by photo_tone
const PHOTO_TONE_GRADIENT = {
  warm: 'linear-gradient(160deg, #4a2800 0%, #7c3a00 50%, #2d1400 100%)',
  neutral: 'linear-gradient(160deg, #1a1a1a 0%, #2d2d2d 50%, #111 100%)',
  cool: 'linear-gradient(160deg, #0a1628 0%, #1a2a40 50%, #0d1a2d 100%)',
  dark: 'linear-gradient(160deg, #050505 0%, #111111 50%, #000 100%)',
}

// Font family mapping
function fontFamily(style, fonts) {
  if (style === 'display_bold') return `'Bebas Neue', 'Impact', sans-serif`
  if (style === 'clean_sans') return `'Inter', 'Helvetica Neue', sans-serif`
  if (style === 'serif_elegant') return `'Playfair Display', Georgia, serif`
  if (style === 'rounded_friendly') return `'Poppins', 'Rounded Mplus 1c', sans-serif`
  return fonts?.heading ? `'${fonts.heading}', sans-serif` : `'Bebas Neue', sans-serif`
}

export function AssetPreview({ type = 'poster', slots, knobs, palette, fonts, pngUrl }) {
  // Default-arg only kicks in for `undefined`; callers (and the backend) can send
  // explicit `null` for slots/knobs (e.g. an uploaded asset with no CSS layout),
  // so coerce here to avoid destructuring null below.
  slots = slots ?? {}
  knobs = knobs ?? {}
  useEffect(() => {
    loadBrandFonts(fonts)
  }, [fonts])

  // Saved upload: show the real stored image instead of the CSS mockup.
  if (pngUrl) {
    return (
      <img
        src={pngUrl}
        alt={slots.headline || 'Saved asset'}
        style={{
          aspectRatio: ASPECT[type] ?? '1 / 1',
          objectFit: 'cover',
          width: '100%',
          margin: '0 auto',
          display: 'block',
        }}
      />
    )
  }

  const {
    density = 'balanced',
    font_style = 'display_bold',
    photo_tone = 'warm',
    accent_usage = 0.6,
    overlay = 0.4,
    layout_variant = 'left',
  } = knobs

  const primaryColor = palette?.primary ?? '#E63946'
  const lightColor = palette?.light ?? '#FFFFFF'
  const bgGradient = PHOTO_TONE_GRADIENT[photo_tone] ?? PHOTO_TONE_GRADIENT.warm
  // A generated hero background (slots.hero_image) sits UNDER the overlay + text
  // layers. The gradient stays as the base so it shows through while the image
  // loads or if it 404s — text legibility never depends on the image arriving.
  const heroImage = slots.hero_image || null
  const headingFont = fontFamily(font_style, fonts)
  const bodyFont = fonts?.body ? `'${fonts.body}', sans-serif` : `'Inter', sans-serif`

  // Story has safe zones: 12% padding top and bottom
  const isStory = type === 'story'
  const verticalPadding = isStory ? '12%' : density === 'open' ? '8%' : '6%'
  const horizontalPad = '8%'

  // Layout variant
  const textAlign = layout_variant === 'center' ? 'center' : 'left'
  const alignItems = layout_variant === 'center' ? 'center' : 'flex-start'
  const isSplit = layout_variant === 'split'

  // Accent layer opacity from accent_usage
  const accentBarHeight = `${Math.round(accent_usage * 6)}px`

  return (
    <div
      style={{
        aspectRatio: ASPECT[type] ?? '1 / 1',
        background: bgGradient,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Hero background image (generated) — sits under everything else. */}
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Scrim — a bottom-weighted gradient (not a flat wash) so the image reads
          clearly up top while the headline sits on solid contrast below. Over a
          photo it's stronger; over the plain gradient it's lighter. This is the
          single biggest "looks designed, not a box" change. */}
      {(() => {
        const base = heroImage ? Math.min(0.9, overlay + 0.3) : overlay
        const mid = Math.max(0, base - 0.35)
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, rgba(0,0,0,${base}) 0%, rgba(0,0,0,${mid}) 45%, rgba(0,0,0,${Math.max(0, mid - 0.15)}) 100%)`,
            }}
          />
        )
      })()}

      {/* Accent bar at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: accentBarHeight,
          background: primaryColor,
          opacity: accent_usage,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: isSplit ? 'row' : 'column',
          justifyContent: isSplit ? 'space-between' : 'flex-end',
          alignItems: isSplit ? 'flex-end' : alignItems,
          padding: `${verticalPadding} ${horizontalPad}`,
          gap: '4%',
        }}
      >
        {/* Logo */}
        <div
          style={{
            position: 'absolute',
            top: verticalPadding,
            left: horizontalPad,
            fontFamily: headingFont,
            fontSize: 'clamp(10px, 2.5%, 14px)',
            letterSpacing: '0.08em',
            color: lightColor,
            opacity: 0.85,
            textTransform: 'uppercase',
          }}
        >
          {slots.logo ?? 'Brand'}
        </div>

        {/* Main text block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems,
            gap: '4%',
            width: isSplit ? '55%' : '100%',
          }}
        >
          {/* Headline — larger, tighter, with a subtle shadow so it stays legible
              on any background (photo or gradient). */}
          {slots.headline && (
            <p
              style={{
                fontFamily: headingFont,
                fontSize: 'clamp(20px, 7.5%, 44px)',
                lineHeight: font_style === 'display_bold' ? 0.98 : 1.05,
                color: lightColor,
                textAlign,
                textTransform: font_style === 'display_bold' ? 'uppercase' : 'none',
                letterSpacing: font_style === 'display_bold' ? '0.01em' : '-0.01em',
                textShadow: heroImage ? '0 2px 12px rgba(0,0,0,0.55)' : '0 1px 6px rgba(0,0,0,0.3)',
                margin: 0,
                maxWidth: '18ch',
              }}
            >
              {slots.headline}
            </p>
          )}

          {/* Subline */}
          {slots.subline && (
            <p
              style={{
                fontFamily: bodyFont,
                fontSize: 'clamp(9px, 2.9%, 15px)',
                lineHeight: 1.3,
                color: lightColor,
                opacity: 0.88,
                textAlign,
                textShadow: heroImage ? '0 1px 6px rgba(0,0,0,0.5)' : 'none',
                margin: 0,
                maxWidth: '32ch',
              }}
            >
              {slots.subline}
            </p>
          )}

          {/* Price badge — a solid chip with a soft drop shadow so it pops off
              the background like a real sticker. */}
          {slots.price && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: primaryColor,
                color: lightColor,
                padding: '2.5% 4.5%',
                fontFamily: headingFont,
                fontSize: 'clamp(13px, 4.5%, 24px)',
                fontWeight: 700,
                letterSpacing: '0.03em',
                borderRadius: '2px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                alignSelf: layout_variant === 'center' ? 'center' : 'flex-start',
              }}
            >
              {slots.price}
            </div>
          )}

          {/* CTA — an outlined pill with a trailing arrow, reads as a button. */}
          {slots.cta && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5em',
                fontFamily: bodyFont,
                fontSize: 'clamp(8px, 2.3%, 13px)',
                color: lightColor,
                opacity: 0.92,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '1.6% 3.5%',
                border: `1px solid rgba(255,255,255,0.4)`,
                borderRadius: '999px',
                alignSelf: layout_variant === 'center' ? 'center' : 'flex-start',
              }}
            >
              {slots.cta}
              <span aria-hidden="true" style={{ fontSize: '1.1em', lineHeight: 1 }}>→</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
