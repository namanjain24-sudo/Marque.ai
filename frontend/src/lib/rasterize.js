// lib/rasterize.js — turn a rendered DOM node (an AssetPreview) into a PNG File.
// The browser IS the renderer in this app: the F4 auto-fix loop rasterizes the
// live preview and uploads it to the real /signal-check endpoint, so no
// server-side headless browser is needed.
import { toBlob } from 'html-to-image'

/**
 * rasterize(node, { name }) -> Promise<File>
 * Renders `node` to a PNG blob and wraps it in a File (so it can go straight
 * into a multipart upload via api.checkSignal). Uses a 2x pixel ratio so the
 * critic sees crisp type, and a solid background so transparent areas don't
 * confuse the vision model.
 */
export async function rasterize(node, { name = 'asset.png' } = {}) {
  if (!node) throw new Error('rasterize: no node to capture')
  const blob = await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#000000',
  })
  if (!blob) throw new Error('rasterize: failed to produce an image')
  return new File([blob], name, { type: 'image/png' })
}
