//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const api = require('./services/api')

const BASE = '/application'

async function requireSetup (req, res, next) {
  const appId = req.session.data.currentApplicationId;
  if (!appId) {
    if (req.path === '/setup') return next();
    return res.redirect(`${BASE}/setup`)
  }
  const app = await api.getApplication(req, appId);
  if (!app || !app.progress || !app.progress.setupComplete) {
    if (req.path === '/setup') return next();
    return res.redirect(`${BASE}/setup`)
  }
  next()
}

function consumeFlag (data, key) {
  const v = data[key]
  delete data[key]
  return Boolean(v)
}

function checkboxYes (val) {
  if (val === 'yes') return true
  if (Array.isArray(val)) {
    return val.includes('yes')
  }
  return false
}

// Middleware to inject appState into locals for all views
router.use(`${BASE}/*`, async (req, res, next) => {
  const appId = req.session.data.currentApplicationId;
  if (appId) {
    res.locals.appState = await api.getApplication(req, appId);
  }
  next();
});


// --- Pre-application Journey ---

const PREAPP_BASE = '/pre-application'

router.get(`${PREAPP_BASE}/start`, (req, res) => {
  res.render('pre-application/start')
})

router.get(`${PREAPP_BASE}/sign-in`, (req, res) => {
  res.render('pre-application/sign-in')
})

router.post(`${PREAPP_BASE}/sign-in`, (req, res) => {
  res.redirect(`${PREAPP_BASE}/request-meeting`)
})

router.get(`${PREAPP_BASE}/request-meeting`, (req, res) => {
  res.render('pre-application/request-meeting')
})

router.post(`${PREAPP_BASE}/request-meeting`, (req, res) => {
  res.redirect(`${PREAPP_BASE}/payment`)
})

router.get(`${PREAPP_BASE}/payment`, (req, res) => {
  res.render('pre-application/payment')
})

router.post(`${PREAPP_BASE}/payment`, (req, res) => {
  res.redirect(`${PREAPP_BASE}/submitted`)
})

router.get(`${PREAPP_BASE}/submitted`, (req, res) => {
  res.render('pre-application/submitted')
})

router.get(`${PREAPP_BASE}/outcome`, (req, res) => {
  res.render('pre-application/outcome')
})


// --- Case / dashboard entry ---
router.get('/case', (req, res) => {
  res.render('application/case-dashboard')
})

// --- Application intro ---
router.get(`${BASE}/start`, (req, res) => {
  res.render('application/start')
})

router.post(`${BASE}/start`, async (req, res) => {
  await api.createApplication(req);
  res.redirect(`${BASE}/setup`)
})

// --- Basic setup ---
router.get(`${BASE}/setup`, async (req, res) => {
  const setupError = consumeFlag(req.session.data, '_setupError')
  const appState = res.locals.appState;
  const setupErrorList = []
  if (setupError) {
    if (!appState || !appState.setup || !appState.setup.acquiringAuthority) {
      setupErrorList.push({ text: 'Enter the acquiring authority', href: '#acquiringAuthority' })
    }
    if (!appState || !appState.setup || !appState.setup.schemeName) {
      setupErrorList.push({ text: 'Enter the scheme name', href: '#schemeName' })
    }
  }
  res.render('application/setup', { setupError: setupError && setupErrorList.length > 0, setupErrorList })
})

router.post(`${BASE}/setup`, async (req, res) => {
  let appId = req.session.data.currentApplicationId;
  if (!appId) {
    const app = await api.createApplication(req);
    appId = app.applicationId;
  }
  const authority = ((req.body.acquiringAuthority || '') + '').trim()
  const schemeName = ((req.body.schemeName || '') + '').trim()

  await api.saveSection(req, appId, 'setup', {
    acquiringAuthority: authority,
    schemeName: schemeName,
    yourReference: req.body.yourReference || '',
    statutoryPower: req.body.statutoryPower || '',
    schemeType: req.body.schemeType || '',
    localAuthority: req.body.localAuthority || ''
  });

  if (!authority || !schemeName) {
    req.session.data._setupError = true
    return res.redirect(`${BASE}/setup`)
  }

  await api.updateProgress(req, appId, 'setupComplete', true);
  res.redirect(`${BASE}/task-list`)
})

// --- Document Upload ---
router.get(`${BASE}/upload-document`, requireSetup, (req, res) => {
  res.render('application/upload-document', {
    sectionKey: req.query.section,
    fieldKey: req.query.field,
    returnUrl: req.query.returnUrl
  });
})

router.post(`${BASE}/upload-document`, requireSetup, async (req, res) => {
  const appId = req.session.data.currentApplicationId;
  const filename = req.body.documentFile || 'uploaded-document.pdf';
  const sectionKey = req.body.sectionKey;
  const fieldKey = req.body.fieldKey;
  const returnUrl = req.body.returnUrl || `${BASE}/task-list`;

  if (sectionKey && fieldKey && filename.trim() !== '') {
    await api.uploadDocument(req, appId, sectionKey, fieldKey, filename);
  }
  res.redirect(returnUrl);
})

// --- Task list hub ---
router.get(`${BASE}/task-list`, requireSetup, (req, res) => {
  res.render('application/task-list')
})

// --- Upload core documents ---
router.get(`${BASE}/upload-core-documents`, requireSetup, async (req, res) => {
  const coreDocsError = consumeFlag(req.session.data, '_coreDocumentsError')
  const coreDocsErrorList = []

  const appId = req.session.data.currentApplicationId;
  const orderDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'orderDocument');
  const mapDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'mapDocument');
  const statementOfReasonsDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'statementOfReasons');
  const confirmations = (res.locals.appState && res.locals.appState.coreDocuments && res.locals.appState.coreDocuments.confirmations) || [];

  res.locals.orderDocuments = orderDocuments;
  res.locals.mapDocuments = mapDocuments;
  res.locals.statementOfReasonsDocuments = statementOfReasonsDocuments;
  res.locals.confirmations = confirmations;

  if (coreDocsError) {
    if (orderDocuments.length === 0) {
      coreDocsErrorList.push({ text: 'Upload the CPO document', href: '#coreOrderDocument' })
    }
    if (mapDocuments.length === 0) {
      coreDocsErrorList.push({ text: 'Upload the order map', href: '#coreMapDocument' })
    }
    if (statementOfReasonsDocuments.length === 0) {
      coreDocsErrorList.push({ text: 'Upload the Statement of Reasons', href: '#coreStatementOfReasons' })
    }
    if (confirmations.length < 3) {
      coreDocsErrorList.push({ text: 'Confirm all three statements', href: '#coreConfirmations' })
    }
  }

  res.render('application/upload-core-documents', {
    coreDocsError: coreDocsError && coreDocsErrorList.length > 0,
    coreDocsErrorList
  })
})

router.post(`${BASE}/upload-core-documents`, requireSetup, async (req, res) => {
  const appId = req.session.data.currentApplicationId;
  const conf = req.body.coreConfirmations
  const confArr = Array.isArray(conf) ? conf : (conf ? [conf] : [])
  const allConfirmed = confArr.includes('orderSealed') && confArr.includes('mapsAccompany') && confArr.includes('mapsForm')

  const docsOrderBefore = await api.getDocumentsForField(req, appId, 'coreDocuments', 'orderDocument');
  const docsMapBefore = await api.getDocumentsForField(req, appId, 'coreDocuments', 'mapDocument');
  const docsSorBefore = await api.getDocumentsForField(req, appId, 'coreDocuments', 'statementOfReasons');

  // Handle new inline file uploads
  if (req.body.orderDocument && req.body.orderDocument.trim() !== '') {
    await api.uploadDocument(req, appId, 'coreDocuments', 'orderDocument', req.body.orderDocument);
  }
  if (req.body.mapDocument && req.body.mapDocument.trim() !== '') {
    await api.uploadDocument(req, appId, 'coreDocuments', 'mapDocument', req.body.mapDocument);
  }
  if (req.body.statementOfReasons && req.body.statementOfReasons.trim() !== '') {
    await api.uploadDocument(req, appId, 'coreDocuments', 'statementOfReasons', req.body.statementOfReasons);
  }
  if (req.body.supportingDocuments && req.body.supportingDocuments.trim() !== '') {
    await api.uploadDocument(req, appId, 'coreDocuments', 'supportingDocuments', req.body.supportingDocuments);
  }

  // Refetch to see if we now have documents
  const docsOrder = await api.getDocumentsForField(req, appId, 'coreDocuments', 'orderDocument');
  const docsMap = await api.getDocumentsForField(req, appId, 'coreDocuments', 'mapDocument');
  const docsSor = await api.getDocumentsForField(req, appId, 'coreDocuments', 'statementOfReasons');

  await api.saveSection(req, appId, 'coreDocuments', { confirmations: confArr });

  if (docsOrder.length === 0 || docsMap.length === 0 || docsSor.length === 0 || !allConfirmed) {
    req.session.data._coreDocumentsError = true
    return res.redirect(`${BASE}/upload-core-documents`)
  }

  await api.updateProgress(req, appId, 'coreDocumentsComplete', true);
  res.redirect(`${BASE}/task-list`)
})

// --- Planning and environmental ---
router.get(`${BASE}/planning-and-environmental`, requireSetup, async (req, res) => {
  const planningError = consumeFlag(req.session.data, '_planningEnvironmentalError')
  const planningErrorList = []

  const appId = req.session.data.currentApplicationId;
  const planningDecisionDocuments = await api.getDocumentsForField(req, appId, 'planningEnvironmental', 'planningDecisionDocument');
  res.locals.planningDecisionDocuments = planningDecisionDocuments;

  if (planningError) {
    const status = res.locals.appState && res.locals.appState.planningEnvironmental && res.locals.appState.planningEnvironmental.planningStatus;
    const env = res.locals.appState && res.locals.appState.planningEnvironmental && res.locals.appState.planningEnvironmental.environmentalImpactRequired;
    if (!status) {
      planningErrorList.push({ text: 'Select the planning permission status', href: '#planningStatus' })
    }
    if (!env) {
      planningErrorList.push({ text: 'Select whether environmental impact assessment is required', href: '#environmentalImpactRequired' })
    }
    if (status === 'granted' && planningDecisionDocuments.length === 0) {
      planningErrorList.push({ text: 'Upload the planning decision notice', href: '#planningDecisionDocument' })
    }
  }

  res.render('application/planning-and-environmental', {
    planningError: planningError && planningErrorList.length > 0,
    planningErrorList
  })
})

router.post(`${BASE}/planning-and-environmental`, requireSetup, async (req, res) => {
  const appId = req.session.data.currentApplicationId;
  const status = req.body.planningStatus
  const env = req.body.environmentalImpactRequired

  const docsDecision = await api.getDocumentsForField(req, appId, 'planningEnvironmental', 'planningDecisionDocument');

  await api.saveSection(req, appId, 'planningEnvironmental', {
    planningStatus: status || '',
    environmentalImpactRequired: env || ''
  });

  if (!status || !env) {
    req.session.data._planningEnvironmentalError = true
    return res.redirect(`${BASE}/planning-and-environmental`)
  }
  if (status === 'granted' && docsDecision.length === 0) {
    req.session.data._planningEnvironmentalError = true
    return res.redirect(`${BASE}/planning-and-environmental`)
  }

  await api.updateProgress(req, appId, 'planningEnvironmentalComplete', true);
  res.redirect(`${BASE}/task-list`)
})

// --- Notices and service evidence ---
router.get(`${BASE}/notices-and-service-evidence`, requireSetup, (req, res) => {
  const noticesError = consumeFlag(req.session.data, '_noticesEvidenceError')
  const noticesErrorList = []
  if (noticesError && res.locals.appState && !res.locals.appState.noticesEvidence.noticesServed) {
    noticesErrorList.push({ text: 'Confirm whether required notices have been served', href: '#noticesServed' })
  }
  res.render('application/notices-and-service-evidence', {
    noticesError: noticesError && noticesErrorList.length > 0,
    noticesErrorList
  })
})

router.post(`${BASE}/notices-and-service-evidence`, requireSetup, async (req, res) => {
  const appId = req.session.data.currentApplicationId;
  const served = req.body.noticesServed
  await api.saveSection(req, appId, 'noticesEvidence', { noticesServed: served || '' });

  if (!served || (served !== 'yes' && served !== 'no')) {
    req.session.data._noticesEvidenceError = true
    return res.redirect(`${BASE}/notices-and-service-evidence`)
  }

  await api.updateProgress(req, appId, 'noticesEvidenceComplete', true);
  res.redirect(`${BASE}/task-list`)
})

// --- Contacts and access ---
router.get(`${BASE}/contacts-and-access`, requireSetup, (req, res) => {
  const contactsError = consumeFlag(req.session.data, '_contactsAccessError')
  const contactsErrorList = []
  const appState = res.locals.appState;

  if (contactsError && appState) {
    if (!(appState.contactsAccess.primaryContactName || '').trim()) {
      contactsErrorList.push({ text: 'Enter the primary contact name', href: '#primaryContactName' })
    }
    if (!(appState.contactsAccess.primaryContactEmail || '').trim()) {
      contactsErrorList.push({ text: 'Enter the primary contact email', href: '#primaryContactEmail' })
    }
    if (!appState.contactsAccess.contactDetailsConfirmed) {
      contactsErrorList.push({ text: 'Confirm the contact details are correct', href: '#contactDetailsConfirmed' })
    }
  }

  res.render('application/contacts-and-access', {
    contactsError,
    contactsErrorList,
    contactDetailsYes: appState && appState.contactsAccess.contactDetailsConfirmed,
    authorisedYes: appState && appState.contactsAccess.authorisedToAct
  })
})

router.post(`${BASE}/contacts-and-access`, requireSetup, async (req, res) => {
  const appId = req.session.data.currentApplicationId;
  const name = ((req.body.primaryContactName || '') + '').trim()
  const email = ((req.body.primaryContactEmail || '') + '').trim()
  const confirmed = checkboxYes(req.body.contactDetailsConfirmed)

  await api.saveSection(req, appId, 'contactsAccess', {
    primaryContactName: name,
    primaryContactEmail: email,
    primaryContactPhone: req.body.primaryContactPhone || '',
    contactDetailsConfirmed: confirmed,
    authorisedToAct: checkboxYes(req.body.authorisedToAct)
  });

  if (!name || !email || !confirmed) {
    req.session.data._contactsAccessError = true
    return res.redirect(`${BASE}/contacts-and-access`)
  }

  await api.updateProgress(req, appId, 'contactsAccessComplete', true);
  res.redirect(`${BASE}/task-list`)
})

// --- Check answers (only after all 4 sections) ---
router.get(`${BASE}/check-answers`, requireSetup, async (req, res) => {
  const appState = res.locals.appState;
  const p = appState && appState.progress;
  if (!p || !(p.coreDocumentsComplete && p.planningEnvironmentalComplete && p.noticesEvidenceComplete && p.contactsAccessComplete)) {
    return res.redirect(`${BASE}/task-list`)
  }
  const appId = req.session.data.currentApplicationId;
  res.locals.orderDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'orderDocument');
  res.locals.mapDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'mapDocument');
  res.locals.statementOfReasonsDocuments = await api.getDocumentsForField(req, appId, 'coreDocuments', 'statementOfReasons');
  res.locals.planningDecisionDocuments = await api.getDocumentsForField(req, appId, 'planningEnvironmental', 'planningDecisionDocument');

  res.render('application/check-answers')
})

router.post(`${BASE}/check-answers`, requireSetup, async (req, res) => {
  const appState = res.locals.appState;
  const p = appState && appState.progress;
  if (!p || !(p.coreDocumentsComplete && p.planningEnvironmentalComplete && p.noticesEvidenceComplete && p.contactsAccessComplete)) {
    return res.redirect(`${BASE}/task-list`)
  }
  await api.updateProgress(req, req.session.data.currentApplicationId, 'checkAnswersComplete', true);
  res.redirect(`${BASE}/declaration`)
})

// --- Declaration (only after check answers) ---
router.get(`${BASE}/declaration`, requireSetup, (req, res) => {
  if (!res.locals.appState || !res.locals.appState.progress.checkAnswersComplete) {
    return res.redirect(`${BASE}/task-list`)
  }
  res.render('application/declaration', {
    declarationError: consumeFlag(req.session.data, '_declarationError')
  })
})

router.post(`${BASE}/submit`, requireSetup, async (req, res) => {
  const appState = res.locals.appState;
  const appId = req.session.data.currentApplicationId;
  if (appState && appState.status === 'SUBMITTED') {
    return res.redirect(`${BASE}/submitted`)
  }
  if (!appState || !appState.progress.checkAnswersComplete) {
    return res.redirect(`${BASE}/task-list`)
  }
  const agreed = req.body.declarationAgreed
  const agreedYes = agreed === 'yes' || (Array.isArray(agreed) && agreed.includes('yes'))
  if (!agreedYes) {
    req.session.data._declarationError = true
    return res.redirect(`${BASE}/declaration`)
  }

  await api.submitApplication(req, appId);
  res.redirect(`${BASE}/submitted`)
})

// --- Submitted ---
router.get(`${BASE}/submitted`, requireSetup, (req, res) => {
  if (!res.locals.appState || res.locals.appState.status !== 'SUBMITTED') {
    return res.redirect(`${BASE}/task-list`)
  }
  res.render('application/submitted')
})

module.exports = router
