// lib/mockApi.js — all mock data responses, no real network calls.
// Each function is marked with the real endpoint it will replace.
import brandData from '../mock/brand.json'
import campaignData from '../mock/campaign.json'
import signalData from '../mock/signal.json'
import auditData from '../mock/audit.json'

function delay(ms = 400) {
  return new Promise((res) => setTimeout(res, ms))
}

export const mockApi = {
  // TODO: replace with real endpoint POST /v1/brands
  createBrand: async (payload) => {
    await delay(800)
    return { ...brandData, ...payload, id: `brand_${Date.now()}` }
  },

  // TODO: replace with real endpoint GET /v1/brands
  listBrands: async () => {
    await delay(300)
    return [brandData]
  },

  // TODO: replace with real endpoint GET /v1/brands/{id}
  getBrand: async (_id) => {
    await delay(200)
    return { ...brandData }
  },

  // TODO: replace with real endpoint PATCH /v1/brands/{id}/memory
  patchMemory: async (_id, payload) => {
    await delay(300)
    return { ...brandData, ...payload }
  },

  // TODO: replace with real endpoint POST /v1/brands/{id}/memory/rules
  appendRule: async (_id, field, value) => {
    await delay(300)
    const current = brandData[field] ?? []
    return { ...brandData, [field]: [...current, value] }
  },

  // TODO: replace with real endpoint GET /v1/brands/{id}/identity
  getIdentityDirections: async (_id) => {
    await delay(300)
    return [
      {
        key: 'bold_premium',
        palette: { primary: '#E63946', secondary: '#111111', accent: '#F1FAEE', light: '#FFFFFF', dark: '#0B0B0B' },
        fonts: { heading: 'Bebas Neue', body: 'Inter' },
        meaning: {
          'red primary': 'energy and appetite',
          'near-black background': 'premium, confident',
          'condensed display headline': 'bold, modern',
        },
      },
      {
        key: 'modern_minimal',
        palette: { primary: '#2B2D42', secondary: '#8D99AE', accent: '#EF233C', light: '#EDF2F4', dark: '#121212' },
        fonts: { heading: 'Space Grotesk', body: 'Inter' },
        meaning: {
          'muted blue-grey': 'modern, minimal',
          'geometric headline': 'clean, confident',
          'red accent': 'sharp focus',
        },
      },
    ]
  },

  // TODO: replace with real endpoint POST /v1/brands/{id}/identity/apply
  applyIdentity: async (_id, key) => {
    await delay(400)
    const dirs = await mockApi.getIdentityDirections(_id)
    const dir = dirs.find((d) => d.key === key) ?? dirs[0]
    return { ...brandData, ...dir }
  },

  // TODO: replace with real endpoint POST /v1/agent/run
  agentRun: async (_message) => {
    await delay(600)
    return campaignData.campaigns[0]
  },

  // TODO: replace with real endpoint GET /v1/runs/{id}/events
  getRunEvents: async (_runId) => {
    await delay(200)
    return []
  },

  // TODO: replace with real endpoint POST /v1/assets/{id}/check
  checkSignal: async (_brandId, _file) => {
    await delay(1500)
    return {
      match: signalData.round1.match,
      verdict: signalData.round1.verdict,
      target: signalData.round1.target,
      detected: signalData.round1.detected,
      gaps: signalData.round1.gaps,
      issue: signalData.round1.issue,
      evidence: signalData.round1.evidence,
      fix: signalData.round1.fix,
    }
  },

  // TODO: replace with real endpoint POST /v1/audit
  runAudit: async (_images) => {
    await delay(2000)
    return { ...auditData }
  },

  getCampaigns: async () => {
    await delay(300)
    return campaignData.campaigns
  },

  getCampaign: async (id) => {
    await delay(200)
    return campaignData.campaigns.find((c) => c.id === id) ?? campaignData.campaigns[0]
  },

  getAllAssets: async () => {
    await delay(300)
    return campaignData.campaigns.flatMap((c) => c.assets.map((a) => ({ ...a, campaign: c.name })))
  },
}
