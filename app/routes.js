//
// DCO MVP — Routes
// Journey: start → sign in → dashboard → case status → optional payment
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Helper: find a case by ID from session data
function findCase (data, id) {
  return (data.dcoCases || []).find(c => c.id === id)
}

// ─── Start page ───
router.get('/start', (req, res) => {
  res.render('start')
})

// ─── Sign in ───
router.get('/sign-in', (req, res) => {
  res.render('sign-in')
})

router.post('/sign-in', (req, res) => {
  req.session.data.signedIn = true
  res.redirect('/dashboard')
})

// ─── Create account ───
router.get('/create-account', (req, res) => {
  res.render('create-account')
})

router.post('/create-account', (req, res) => {
  req.session.data.signedIn = true
  res.redirect('/dashboard')
})

// ─── Dashboard (list of cases) ───
router.get('/dashboard', (req, res) => {
  if (!req.session.data.signedIn) {
    return res.redirect('/sign-in')
  }
  res.render('dashboard')
})

// ─── DCO case status (individual case) ───
router.get('/dco-status/:id', (req, res) => {
  if (!req.session.data.signedIn) {
    return res.redirect('/sign-in')
  }
  const dcoCase = findCase(req.session.data, req.params.id)
  if (!dcoCase) {
    return res.redirect('/dashboard')
  }
  res.render('dco/status', { dcoCase })
})

// ─── Payment ───
router.get('/payment/:id', (req, res) => {
  if (!req.session.data.signedIn) {
    return res.redirect('/sign-in')
  }
  const dcoCase = findCase(req.session.data, req.params.id)
  if (!dcoCase) {
    return res.redirect('/dashboard')
  }
  res.render('dco/payment', { dcoCase })
})

router.post('/payment/:id', (req, res) => {
  const dcoCase = findCase(req.session.data, req.params.id)
  if (dcoCase) {
    dcoCase.paymentStatus = 'Payment received'
  }
  res.redirect('/payment-confirmation/' + req.params.id)
})

// ─── Payment confirmation ───
router.get('/payment-confirmation/:id', (req, res) => {
  if (!req.session.data.signedIn) {
    return res.redirect('/sign-in')
  }
  const dcoCase = findCase(req.session.data, req.params.id)
  if (!dcoCase) {
    return res.redirect('/dashboard')
  }
  res.render('dco/payment-confirmation', { dcoCase })
})

// ─── Sign out ───
router.get('/sign-out', (req, res) => {
  req.session.data.signedIn = false
  res.redirect('/start')
})

module.exports = router
