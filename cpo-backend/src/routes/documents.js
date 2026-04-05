const express = require('express')
const router = express.Router()
const db = require('../db')
const { v4: uuidv4 } = require('uuid')

// POST /v1/applications/:id/documents/upload-requests — mock presigned URL step 1
router.post('/:id/documents/upload-requests', async (req, res) => {
  try {
    const { id } = req.params
    const { sectionKey, fieldKey, filename, contentType } = req.body

    // Verify application exists
    const appCheck = await db.query('SELECT id FROM applications WHERE id = $1', [id])
    if (appCheck.rows.length === 0) return res.status(404).json({ error: 'Application not found' })

    const docId = 'DOC-' + uuidv4().substring(0, 8).toUpperCase()
    const s3KeyMock = `uploads/${id}/${docId}/${filename}`

    // Insert document record with PENDING_UPLOAD status
    await db.query(
      `INSERT INTO documents (id, application_id, section_key, field_key, filename, content_type, s3_key_mock, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [docId, id, sectionKey, fieldKey, filename, contentType || 'application/pdf', s3KeyMock, 'PENDING_UPLOAD']
    )

    res.status(201).json({
      documentId: docId,
      uploadUrl: `http://localhost:3000/mock-s3/${s3KeyMock}`,
      s3Key: s3KeyMock,
      status: 'PENDING_UPLOAD'
    })
  } catch (err) {
    console.error('Upload request error:', err)
    res.status(500).json({ error: 'Failed to create upload request' })
  }
})

// POST /v1/applications/:id/documents/:docId/complete — mock upload step 2
router.post('/:id/documents/:docId/complete', async (req, res) => {
  try {
    const { id, docId } = req.params
    const sizeBytes = req.body.sizeBytes || 0

    const result = await db.query(
      `UPDATE documents SET status = 'AVAILABLE', size_bytes = $1
       WHERE id = $2 AND application_id = $3
       RETURNING id, filename, status, size_bytes`,
      [sizeBytes, docId, id]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' })

    res.json({
      documentId: result.rows[0].id,
      filename: result.rows[0].filename,
      status: result.rows[0].status,
      sizeBytes: result.rows[0].size_bytes
    })
  } catch (err) {
    console.error('Upload complete error:', err)
    res.status(500).json({ error: 'Failed to complete upload' })
  }
})

// GET /v1/applications/:id/documents — list all docs for an application
router.get('/:id/documents', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, section_key, field_key, filename, content_type, size_bytes, status, uploaded_at
       FROM documents WHERE application_id = $1 AND status != 'DELETED'
       ORDER BY uploaded_at`,
      [req.params.id]
    )

    res.json({
      documents: rows.map(d => ({
        documentId: d.id, sectionKey: d.section_key, fieldKey: d.field_key,
        filename: d.filename, contentType: d.content_type,
        sizeBytes: d.size_bytes, status: d.status, uploadedAt: d.uploaded_at
      }))
    })
  } catch (err) {
    console.error('List documents error:', err)
    res.status(500).json({ error: 'Failed to list documents' })
  }
})

module.exports = router
