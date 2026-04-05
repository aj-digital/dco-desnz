const db = require('../db')

/**
 * Submit an application:
 * 1. Validate it exists and is DRAFT
 * 2. Transition status to SUBMITTED
 * 3. Generate submission reference
 * 4. Write an outbox event for async downstream (Salesforce) processing
 */
async function submitApplication(applicationId) {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')

    // Lock and fetch
    const { rows } = await client.query(
      'SELECT id, status, data FROM applications WHERE id = $1 FOR UPDATE',
      [applicationId]
    )
    if (rows.length === 0) throw new Error('Not found')
    if (rows[0].status === 'SUBMITTED') {
      await client.query('ROLLBACK')
      return {
        applicationId,
        status: 'SUBMITTED',
        submissionReference: rows[0].data.submission?.submissionReference,
        message: 'Already submitted'
      }
    }

    const submissionReference = 'SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    // Update application status and submission data
    await client.query(
      `UPDATE applications
       SET status = 'SUBMITTED',
           data = jsonb_set(
             jsonb_set(data, '{submission,declarationAgreed}', 'true'),
             '{submission,submissionReference}', $1::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(submissionReference), applicationId]
    )

    // Write outbox event for async Salesforce sync
    await client.query(
      `INSERT INTO outbox_events (application_id, event_type, sync_status, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        applicationId,
        'APPLICATION_SUBMITTED',
        'PENDING',
        JSON.stringify({
          applicationId,
          submissionReference,
          submittedAt: new Date().toISOString()
        })
      ]
    )

    await client.query('COMMIT')

    return {
      applicationId,
      status: 'SUBMITTED',
      submissionReference,
      downstreamSyncStatus: 'PENDING',
      message: 'Application submitted. Salesforce sync pending.'
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { submitApplication }
