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

export function AssetPreview({ type = 'poster', slots = {}, knobs = {}, palette, fonts, pngUrl }) {
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
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0,0,0,${overlay})`,
        }}
      />

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
          {/* Headline */}
          {slots.headline && (
            <p
              style={{
                fontFamily: headingFont,
                fontSize: 'clamp(18px, 6%, 36px)',
                lineHeight: 1.05,
                color: lightColor,
                textAlign,
                textTransform: font_style === 'display_bold' ? 'uppercase' : 'none',
                letterSpacing: font_style === 'display_bold' ? '0.02em' : '0',
                margin: 0,
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
                fontSize: 'clamp(9px, 2.8%, 14px)',
                color: lightColor,
                opacity: 0.8,
                textAlign,
                margin: 0,
              }}
            >
              {slots.subline}
            </p>
          )}

          {/* Price badge */}
          {slots.price && (
            <div
              style={{
                display: 'inline-flex',
                background: primaryColor,
                color: lightColor,
                padding: '2% 4%',
                fontFamily: headingFont,
                fontSize: 'clamp(12px, 4%, 22px)',
                letterSpacing: '0.04em',
                alignSelf: layout_variant === 'center' ? 'center' : 'flex-start',
              }}
            >
              {slots.price}
            </div>
          )}

          {/* CTA */}
          {slots.cta && (
            <p
              style={{
                fontFamily: bodyFont,
                fontSize: 'clamp(8px, 2.2%, 12px)',
                color: lightColor,
                opacity: 0.65,
                textAlign,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                margin: 0,
              }}
            >
              {slots.cta}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
