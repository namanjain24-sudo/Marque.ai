const BASE = "/api/v1"

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

// FastAPI/Pydantic send either a plain string detail ("Brand not found") or,
// on 422, a list of {loc, msg, type} per invalid field. Neither is something
// to show a small-business owner as-is, so this turns both into one sentence.
function readableDetail(detail, fallback) {
  if (!detail) return fallback
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (!first) return fallback
    const field = Array.isArray(first.loc) ? first.loc.at(-1) : null
    return field ? `${field}: ${first.msg}` : first.msg || fallback
  }
  return fallback
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  })

  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch {
      // non-JSON error body (e.g. a proxy/504) — fall through with body=null
    }
    const message = readableDetail(
      body?.detail,
      res.status === 404 ? "Not found." : "Something went wrong. Please try again.",
    )
    throw new ApiError(message, res.status, body?.detail)
  }

  if (res.status === 204) return null
  return res.json()
}

// Separate from request(): a multipart body must NOT get a manual
// Content-Type, or fetch can't attach its own boundary.
async function requestForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData })

  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch {
      // non-JSON error body
    }
    const message = readableDetail(
      body?.detail,
      res.status === 404 ? "Not found." : "Something went wrong. Please try again.",
    )
    throw new ApiError(message, res.status, body?.detail)
  }

  return res.json()
}

export const api = {
  createBrand: (payload) => request("/brands", { method: "POST", body: JSON.stringify(payload) }),
  listBrands: ({ limit = 100, offset = 0 } = {}) =>
    request(`/brands?limit=${limit}&offset=${offset}`),
  getBrand: (id) => request(`/brands/${id}`),
  patchMemory: (id, payload) =>
    request(`/brands/${id}/memory`, { method: "PATCH", body: JSON.stringify(payload) }),
  appendRule: (id, field, value) =>
    request(`/brands/${id}/memory/rules`, {
      method: "POST",
      body: JSON.stringify({ field, value }),
    }),
  getIdentityDirections: (id) => request(`/brands/${id}/identity`),
  applyIdentity: (id, key, fields) =>
    request(`/brands/${id}/identity/apply`, {
      method: "POST",
      body: JSON.stringify({ key, ...(fields ? { fields } : {}) }),
    }),
  checkSignal: (id, file, round = 1) => {
    const form = new FormData()
    form.append("image", file)
    form.append("round", String(round))
    return requestForm(`/brands/${id}/signal-check`, form)
  },
}
