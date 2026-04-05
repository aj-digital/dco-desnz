const API_BASE = 'http://localhost:4000/v1'

const api = {
  /**
   * POST /v1/applications — create a new application shell
   */
  createApplication: async (req) => {
    const response = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const app = await response.json()
    req.session.data.currentApplicationId = app.applicationId
    return app
  },

  /**
   * GET /v1/applications/:id — fetch full application state
   */
  getApplication: async (req, id) => {
    try {
      const response = await fetch(`${API_BASE}/applications/${id}`)
      if (!response.ok) return null
      return await response.json()
    } catch (err) {
      console.error('getApplication error:', err.message)
      return null
    }
  },

  /**
   * PUT /v1/applications/:id/sections/:sectionKey — idempotent section save
   */
  saveSection: async (req, id, sectionKey, payload) => {
    const response = await fetch(`${API_BASE}/applications/${id}/sections/${sectionKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return await response.json()
  },

  /**
   * PUT progress flag via the progress section
   */
  updateProgress: async (req, id, progressKey, isComplete) => {
    return api.saveSection(req, id, 'progress', { [progressKey]: isComplete })
  },

  /**
   * Two-step document upload:
   * 1. POST /v1/applications/:id/documents/upload-requests
   * 2. POST /v1/applications/:id/documents/:docId/complete
   */
  uploadDocument: async (req, id, sectionKey, fieldKey, filename) => {
    // Step 1: Request upload
    const reqRes = await fetch(`${API_BASE}/applications/${id}/documents/upload-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionKey, fieldKey, filename, contentType: 'application/pdf' })
    })
    const uploadReq = await reqRes.json()

    // Step 2: Complete upload (mock — in production, the client would upload to S3 first)
    const completeRes = await fetch(
      `${API_BASE}/applications/${id}/documents/${uploadReq.documentId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizeBytes: 204800 })
      }
    )
    return await completeRes.json()
  },

  /**
   * GET documents for a given section/field
   */
  getDocumentsForField: async (req, id, sectionKey, fieldKey) => {
    try {
      const response = await fetch(`${API_BASE}/applications/${id}/documents`)
      if (!response.ok) return []
      const data = await response.json()
      return (data.documents || []).filter(
        d => d.sectionKey === sectionKey && d.fieldKey === fieldKey && d.status !== 'DELETED'
      )
    } catch (err) {
      console.error('getDocumentsForField error:', err.message)
      return []
    }
  },

  /**
   * POST /v1/applications/:id/submit — workflow transition
   */
  submitApplication: async (req, id) => {
    const response = await fetch(`${API_BASE}/applications/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    return await response.json()
  }
}

module.exports = api
