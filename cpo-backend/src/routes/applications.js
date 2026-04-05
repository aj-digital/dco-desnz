const express = require('express')
const router = express.Router()
const db = require('../db')
const { v4: uuidv4 } = require('uuid')
const { submitApplication } = require('../services/submission')

// POST /v1/applications — create a new application shell
router.post('/', async (req, res) => {
  try {
    const id = 'CPO-' + uuidv4().substring(0, 8).toUpperCase()
    const initialData = {
      setup: {
        yourReference: '', acquiringAuthority: '', statutoryPower: '',
        schemeName: '', schemeType: '', localAuthority: ''
      },
      coreDocuments: { confirmations: [] },
      planningEnvironmental: {
        planningStatus: '', environmentalImpactRequired: ''
      },
      noticesEvidence: { noticesServed: '' },
      contactsAccess: {
        primaryContactName: '', primaryContactEmail: '',
        primaryContactPhone: '', authorisedToAct: false,
        contactDetailsConfirmed: false
      },
      progress: {
        setupComplete: false, coreDocumentsComplete: false,
        planningEnvironmentalComplete: false, noticesEvidenceComplete: false,
        contactsAccessComplete: false, checkAnswersComplete: false
      },
      submission: {
        declarationAgreed: false, submissionReference: ''
      }
    }

    await db.query(
      'INSERT INTO applications (id, status, data) VALUES ($1, $2, $3)',
      [id, 'DRAFT', JSON.stringify(initialData)]
    )

    res.status(201).json({ applicationId: id, status: 'DRAFT', data: initialData })
  } catch (err) {
    console.error('Create application error:', err)
    res.status(500).json({ error: 'Failed to create application' })
  }
})

// GET /v1/applications/:id — fetch full application
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, status, data, created_at, updated_at FROM applications WHERE id = $1',
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })

    const app = rows[0]
    // Attach documents
    const docs = await db.query(
      'SELECT id, section_key, field_key, filename, content_type, size_bytes, status, uploaded_at FROM documents WHERE application_id = $1 AND status != $2',
      [req.params.id, 'DELETED']
    )

    res.json({
      applicationId: app.id,
      status: app.status,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      ...app.data,
      documents: docs.rows.map(d => ({
        documentId: d.id, sectionKey: d.section_key, fieldKey: d.field_key,
        filename: d.filename, contentType: d.content_type,
        sizeBytes: d.size_bytes, status: d.status, uploadedAt: d.uploaded_at
      }))
    })
  } catch (err) {
    console.error('Get application error:', err)
    res.status(500).json({ error: 'Failed to fetch application' })
  }
})

// PUT /v1/applications/:id/sections/:sectionKey — idempotent section save
router.put('/:id/sections/:sectionKey', async (req, res) => {
  try {
    const { id, sectionKey } = req.params
    const payload = req.body

    // Merge into the JSONB data column at the section key
    const result = await db.query(
      `UPDATE applications
       SET data = jsonb_set(data, $1, (COALESCE(data->$2, '{}'::jsonb) || $3::jsonb), true),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, status, data`,
      ['{' + sectionKey + '}', sectionKey, JSON.stringify(payload), id]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })

    res.json({ applicationId: id, section: sectionKey, data: result.rows[0].data[sectionKey] })
  } catch (err) {
    console.error('Save section error:', err)
    res.status(500).json({ error: 'Failed to save section' })
  }
})

// POST /v1/applications/:id/submit — workflow transition
router.post('/:id/submit', async (req, res) => {
  try {
    const result = await submitApplication(req.params.id)
    res.json(result)
  } catch (err) {
    console.error('Submit error:', err)
    const status = err.message === 'Not found' ? 404 : 500
    res.status(status).json({ error: err.message || 'Failed to submit' })
  }
})

// GET /v1/applications/:id/status — check status + downstream sync
router.get('/:id/status', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, status, data FROM applications WHERE id = $1',
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })

    const outbox = await db.query(
      'SELECT event_type, sync_status, created_at FROM outbox_events WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    )

    res.json({
      applicationId: rows[0].id,
      status: rows[0].status,
      downstreamSync: outbox.rows.length ? outbox.rows[0] : null
    })
  } catch (err) {
    console.error('Status error:', err)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

module.exports = router
