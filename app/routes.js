//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

const BASE = '/application'

function allSectionsComplete (data) {
  return Boolean(
    data.coreDocumentsComplete &&
    data.planningEnvironmentalComplete &&
    data.noticesEvidenceComplete &&
    data.contactsAccessComplete
  )
}

function requireSetup (req, res, next) {
  if (!req.session.data.setupComplete) {
    return res.redirect(`${BASE}/setup`)
  }
  next()
}

function randomRef () {
  return 'CPO-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function consumeFlag (data, key) {
  const v = data[key]
  delete data[key]
  return Boolean(v)
}

// GOV.UK Prototype Kit adds hidden _unchecked for checkboxes; body-parser can yield ['yes', '_unchecked'].
function checkboxYes (val) {
  if (val === 'yes') return true
  if (Array.isArray(val)) {
    return val.includes('yes')
  }
  return false
}

// --- Case / dashboard entry ---
router.get('/case', (req, res) => {
  res.render('application/case-dashboard')
})

// --- Application intro ---
router.get(`${BASE}/start`, (req, res) => {
  res.render('application/start')
})

// --- Basic setup ---
router.get(`${BASE}/setup`, (req, res) => {
  const setupError = consumeFlag(req.session.data, '_setupError')
  const data = req.session.data
  const setupErrorList = []
  if (setupError) {
    if (!(data.acquiringAuthority || '').trim()) {
      setupErrorList.push({ text: 'Enter the acquiring authority', href: '#acquiringAuthority' })
    }
    if (!(data.schemeName || '').trim()) {
      setupErrorList.push({ text: 'Enter the scheme name', href: '#schemeName' })
    }
  }
  res.render('application/setup', { setupError: setupError && setupErrorList.length > 0, setupErrorList })
})

router.post(`${BASE}/setup`, (req, res) => {
  const authority = ((req.body.acquiringAuthority || '') + '').trim()
  const schemeName = ((req.body.schemeName || '') + '').trim()
  if (!authority || !schemeName) {
    req.session.data._setupError = true
    return res.redirect(`${BASE}/setup`)
  }
  req.session.data.setupComplete = true
  res.redirect(`${BASE}/task-list`)
})

// --- Task list hub ---
router.get(`${BASE}/task-list`, requireSetup, (req, res) => {
  res.render('application/task-list')
})

// --- Upload core documents ---
router.get(`${BASE}/upload-core-documents`, requireSetup, (req, res) => {
  const coreDocsError = consumeFlag(req.session.data, '_coreDocumentsError')
  const data = req.session.data
  const coreDocsErrorList = []
  if (coreDocsError) {
    if (!(data.coreOrderDocument || '').trim()) {
      coreDocsErrorList.push({ text: 'Enter a filename for the CPO document', href: '#coreOrderDocument' })
    }
    if (!(data.coreMapDocument || '').trim()) {
      coreDocsErrorList.push({ text: 'Enter a filename for the order map', href: '#coreMapDocument' })
    }
    if (!(data.coreStatementOfReasons || '').trim()) {
      coreDocsErrorList.push({ text: 'Enter a filename for the Statement of Reasons', href: '#coreStatementOfReasons' })
    }
    const conf = data.coreConfirmations
    const confArr = Array.isArray(conf) ? conf : (conf ? [conf] : [])
    if (confArr.length < 3) {
      coreDocsErrorList.push({ text: 'Confirm all three statements', href: '#coreConfirmations' })
    }
  }
  res.render('application/upload-core-documents', {
    coreDocsError: coreDocsError && coreDocsErrorList.length > 0,
    coreDocsErrorList
  })
})

router.post(`${BASE}/upload-core-documents`, requireSetup, (req, res) => {
  const order = ((req.body.coreOrderDocument || '') + '').trim()
  const map = ((req.body.coreMapDocument || '') + '').trim()
  const sor = ((req.body.coreStatementOfReasons || '') + '').trim()
  const conf = req.body.coreConfirmations
  const confArr = Array.isArray(conf) ? conf : (conf ? [conf] : [])
  const allConfirmed = confArr.includes('orderSealed') && confArr.includes('mapsAccompany') && confArr.includes('mapsForm')
  if (!order || !map || !sor || !allConfirmed) {
    req.session.data._coreDocumentsError = true
    return res.redirect(`${BASE}/upload-core-documents`)
  }
  req.session.data.coreDocumentsComplete = true
  res.redirect(`${BASE}/task-list`)
})

// --- Planning and environmental ---
router.get(`${BASE}/planning-and-environmental`, requireSetup, (req, res) => {
  const planningError = consumeFlag(req.session.data, '_planningEnvironmentalError')
  const data = req.session.data
  const planningErrorList = []
  if (planningError) {
    if (!data.planningStatus) {
      planningErrorList.push({ text: 'Select the planning permission status', href: '#planningStatus' })
    }
    if (!data.environmentalImpactRequired) {
      planningErrorList.push({ text: 'Select whether environmental impact assessment is required', href: '#environmentalImpactRequired' })
    }
    if (data.planningStatus === 'granted' && !(data.planningDecisionDocument || '').trim()) {
      planningErrorList.push({ text: 'Enter a filename for the planning decision notice', href: '#planningDecisionDocument' })
    }
  }
  res.render('application/planning-and-environmental', {
    planningError: planningError && planningErrorList.length > 0,
    planningErrorList
  })
})

router.post(`${BASE}/planning-and-environmental`, requireSetup, (req, res) => {
  const status = req.body.planningStatus
  const env = req.body.environmentalImpactRequired
  const decisionDoc = (req.body.planningDecisionDocument || '').trim()
  if (!status || !env) {
    req.session.data._planningEnvironmentalError = true
    return res.redirect(`${BASE}/planning-and-environmental`)
  }
  if (status === 'granted' && !decisionDoc) {
    req.session.data._planningEnvironmentalError = true
    return res.redirect(`${BASE}/planning-and-environmental`)
  }
  req.session.data.planningEnvironmentalComplete = true
  res.redirect(`${BASE}/task-list`)
})

// --- Notices and service evidence ---
router.get(`${BASE}/notices-and-service-evidence`, requireSetup, (req, res) => {
  const noticesError = consumeFlag(req.session.data, '_noticesEvidenceError')
  const data = req.session.data
  const noticesErrorList = []
  if (noticesError && !data.noticesServed) {
    noticesErrorList.push({ text: 'Confirm whether required notices have been served', href: '#noticesServed' })
  }
  res.render('application/notices-and-service-evidence', {
    noticesError: noticesError && noticesErrorList.length > 0,
    noticesErrorList
  })
})

router.post(`${BASE}/notices-and-service-evidence`, requireSetup, (req, res) => {
  const served = req.body.noticesServed
  if (!served || (served !== 'yes' && served !== 'no')) {
    req.session.data._noticesEvidenceError = true
    return res.redirect(`${BASE}/notices-and-service-evidence`)
  }
  req.session.data.noticesEvidenceComplete = true
  res.redirect(`${BASE}/task-list`)
})

// --- Contacts and access ---
router.get(`${BASE}/contacts-and-access`, requireSetup, (req, res) => {
  const contactsError = consumeFlag(req.session.data, '_contactsAccessError')
  const data = req.session.data
  const contactsErrorList = []
  if (contactsError) {
    if (!(data.primaryContactName || '').trim()) {
      contactsErrorList.push({ text: 'Enter the primary contact name', href: '#primaryContactName' })
    }
    if (!(data.primaryContactEmail || '').trim()) {
      contactsErrorList.push({ text: 'Enter the primary contact email', href: '#primaryContactEmail' })
    }
    if (!checkboxYes(data.contactDetailsConfirmed)) {
      contactsErrorList.push({ text: 'Confirm the contact details are correct', href: '#contactDetailsConfirmed' })
    }
  }
  res.render('application/contacts-and-access', {
    contactsError,
    contactsErrorList,
    contactDetailsYes: checkboxYes(data.contactDetailsConfirmed),
    authorisedYes: checkboxYes(data.authorisedToAct)
  })
})

router.post(`${BASE}/contacts-and-access`, requireSetup, (req, res) => {
  const name = ((req.body.primaryContactName || '') + '').trim()
  const email = ((req.body.primaryContactEmail || '') + '').trim()
  const confirmed = checkboxYes(req.body.contactDetailsConfirmed)
  if (!name || !email || !confirmed) {
    req.session.data._contactsAccessError = true
    return res.redirect(`${BASE}/contacts-and-access`)
  }
  req.session.data.contactDetailsConfirmed = 'yes'
  if (checkboxYes(req.body.authorisedToAct)) {
    req.session.data.authorisedToAct = 'yes'
  } else {
    delete req.session.data.authorisedToAct
  }
  req.session.data.contactsAccessComplete = true
  res.redirect(`${BASE}/task-list`)
})

// --- Check answers (only after all 4 sections) ---
router.get(`${BASE}/check-answers`, requireSetup, (req, res) => {
  if (!allSectionsComplete(req.session.data)) {
    return res.redirect(`${BASE}/task-list`)
  }
  res.render('application/check-answers')
})

router.post(`${BASE}/check-answers`, requireSetup, (req, res) => {
  if (!allSectionsComplete(req.session.data)) {
    return res.redirect(`${BASE}/task-list`)
  }
  req.session.data.checkAnswersComplete = true
  res.redirect(`${BASE}/declaration`)
})

// --- Declaration (only after check answers) ---
router.get(`${BASE}/declaration`, requireSetup, (req, res) => {
  if (!req.session.data.checkAnswersComplete) {
    return res.redirect(`${BASE}/task-list`)
  }
  res.render('application/declaration', {
    declarationError: consumeFlag(req.session.data, '_declarationError')
  })
})

router.post(`${BASE}/submit`, requireSetup, (req, res) => {
  if (req.session.data.applicationSubmitted) {
    return res.redirect(`${BASE}/submitted`)
  }
  if (!req.session.data.checkAnswersComplete) {
    return res.redirect(`${BASE}/task-list`)
  }
  const agreed = req.body.declarationAgreed
  const agreedYes = agreed === 'yes' || (Array.isArray(agreed) && agreed.includes('yes'))
  if (!agreedYes) {
    delete req.session.data.declarationAgreed
    req.session.data._declarationError = true
    return res.redirect(`${BASE}/declaration`)
  }
  req.session.data.declarationAgreed = 'yes'
  req.session.data.applicationSubmitted = true
  req.session.data.submissionReference = req.session.data.submissionReference || randomRef()
  res.redirect(`${BASE}/submitted`)
})

// --- Submitted ---
router.get(`${BASE}/submitted`, requireSetup, (req, res) => {
  if (!req.session.data.applicationSubmitted) {
    return res.redirect(`${BASE}/task-list`)
  }
  res.render('application/submitted')
})
