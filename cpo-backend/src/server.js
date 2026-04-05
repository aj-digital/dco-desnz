const express = require('express')
const cors = require('cors')
require('dotenv').config()

const applicationsRouter = require('./routes/applications')
const documentsRouter = require('./routes/documents')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/v1/applications', applicationsRouter)
app.use('/v1/applications', documentsRouter)

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`CPO Backend API running on http://localhost:${PORT}`)
})
