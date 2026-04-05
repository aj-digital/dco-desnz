/**
 * Outbox Sync Worker
 * Polls the outbox_events table for PENDING events and syncs them to Salesforce
 *
 * Usage:
 *   node src/services/sync-worker.js           # Run once then exit
 *   node src/services/sync-worker.js --poll     # Run continuously (every 10s)
 */
require('dotenv').config()

const db = require('../db')
const { salesforceClient } = require('./salesforce')

const POLL_INTERVAL = parseInt(process.env.SYNC_POLL_INTERVAL || '10000', 10)

/**
 * Process a single outbox event
 */
async function processEvent(event) {
  const { id, application_id, event_type, payload } = event
  console.log(`[Sync] Processing event #${id} (${event_type}) for application ${application_id}`)

  try {
    // Fetch the full application data
    const { rows } = await db.query(
      'SELECT id, data, status FROM applications WHERE id = $1',
      [application_id]
    )

    if (rows.length === 0) {
      throw new Error(`Application ${application_id} not found`)
    }

    const app = rows[0]
    const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload

    // Upsert to Salesforce
    await salesforceClient.upsertApplication(application_id, {
      submissionReference: parsedPayload.submissionReference,
      submittedAt: parsedPayload.submittedAt,
      applicationData: app.data
    })

    // Mark as SYNCED
    await db.query(
      `UPDATE outbox_events
       SET sync_status = 'SYNCED', processed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    )

    console.log(`[Sync] ✅ Event #${id} synced successfully`)
    return true
  } catch (err) {
    console.error(`[Sync] ❌ Event #${id} failed:`, err.message)

    // Mark as FAILED with error details
    await db.query(
      `UPDATE outbox_events
       SET sync_status = 'FAILED',
           processed_at = CURRENT_TIMESTAMP,
           payload = jsonb_set(
             COALESCE(payload, '{}'::jsonb),
             '{_syncError}',
             $1::jsonb
           )
       WHERE id = $2`,
      [JSON.stringify(err.message), id]
    )

    return false
  }
}

/**
 * Process all pending outbox events
 */
async function processPendingEvents() {
  const { rows: events } = await db.query(
    `SELECT id, application_id, event_type, payload
     FROM outbox_events
     WHERE sync_status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT 10`
  )

  if (events.length === 0) {
    console.log('[Sync] No pending events')
    return 0
  }

  console.log(`[Sync] Found ${events.length} pending event(s)`)
  let synced = 0

  for (const event of events) {
    const ok = await processEvent(event)
    if (ok) synced++
  }

  console.log(`[Sync] Processed ${synced}/${events.length} events`)
  return synced
}

/**
 * Main entry point
 */
async function main() {
  const isPoll = process.argv.includes('--poll')

  console.log('[Sync] Outbox sync worker starting...')
  console.log(`[Sync] Mode: ${isPoll ? 'polling' : 'single-run'}`)
  console.log(`[Sync] SF Login URL: ${process.env.SF_LOGIN_URL || 'https://login.salesforce.com'}`)
  console.log(`[Sync] SF Client ID: ${process.env.SF_CLIENT_ID ? '***configured***' : '⚠️  NOT SET'}`)

  if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
    console.error('[Sync] ⚠️  SF_CLIENT_ID and SF_CLIENT_SECRET must be set in .env')
    process.exit(1)
  }

  if (isPoll) {
    // Continuous polling mode
    console.log(`[Sync] Polling every ${POLL_INTERVAL / 1000}s. Press Ctrl+C to stop.`)
    const tick = async () => {
      try {
        await processPendingEvents()
      } catch (err) {
        console.error('[Sync] Poll error:', err.message)
      }
    }
    await tick()
    setInterval(tick, POLL_INTERVAL)
  } else {
    // Single run
    try {
      const count = await processPendingEvents()
      console.log(`[Sync] Done. ${count} event(s) synced.`)
      process.exit(0)
    } catch (err) {
      console.error('[Sync] Fatal error:', err)
      process.exit(1)
    }
  }
}

main()
