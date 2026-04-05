/**
 * Salesforce REST API client
 * Uses OAuth2 Client Credentials flow for server-to-server authentication
 */
require('dotenv').config()

class SalesforceClient {
  constructor() {
    this.loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
    this.clientId = process.env.SF_CLIENT_ID
    this.clientSecret = process.env.SF_CLIENT_SECRET
    this.accessToken = null
    this.instanceUrl = null
    this.tokenExpiry = null
  }

  /**
   * Authenticate using OAuth2 Client Credentials flow
   */
  async authenticate() {
    // Reuse token if still valid (with 5-min buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
      return
    }

    console.log('[SF] Authenticating with Client Credentials flow...')

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    })

    const res = await fetch(`${this.loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`[SF] Auth failed (${res.status}): ${errorBody}`)
    }

    const data = await res.json()
    this.accessToken = data.access_token
    this.instanceUrl = data.instance_url
    // Tokens typically last 2 hours; set expiry at 1.5 hours
    this.tokenExpiry = Date.now() + 5400000

    console.log(`[SF] Authenticated. Instance: ${this.instanceUrl}`)
  }

  /**
   * Make an authenticated REST API call to Salesforce
   */
  async apiRequest(method, path, body = null) {
    await this.authenticate()

    const url = `${this.instanceUrl}/services/data/v62.0${path}`
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)

    // Handle 204 No Content (successful PATCH/upsert with no body)
    if (res.status === 204) {
      return { success: true, status: 204 }
    }

    const responseBody = await res.text()
    let parsed
    try {
      parsed = JSON.parse(responseBody)
    } catch {
      parsed = responseBody
    }

    if (!res.ok) {
      const err = new Error(`[SF] API error (${res.status}): ${JSON.stringify(parsed)}`)
      err.status = res.status
      err.body = parsed
      throw err
    }

    return parsed
  }

  /**
   * Upsert a CPO Application record using the External ID (AWS_Application_Id__c)
   */
  async upsertApplication(applicationId, data) {
    const appData = data.applicationData || {};
    const setup = appData.setup || {};
    const contacts = appData.contactsAccess || {};
    const planning = appData.planningEnvironmental || {};
    
    // Helper to extract a list of filenames from the document arrays
    const getFilenames = (docArray) => {
      if (!Array.isArray(docArray)) return '';
      return docArray.map(d => d.filename).join(', ');
    };
    
    const coreDocs = appData.coreDocuments || {};
    const planDocs = appData.planningEnvironmental || {};

    const sfRecord = {
      // Standard & System fields
      Name: data.submissionReference || `CPO-${applicationId.substring(0, 8)}`,
      Submission_Reference__c: data.submissionReference || '',
      Application_Status__c: 'Submitted',
      Submitted_At__c: data.submittedAt || new Date().toISOString(),
      
      // Application Details Section
      Applicant__c: setup.acquiringAuthority || '',
      Local_Authority__c: setup.localAuthority || '',
      Scheme_Name__c: setup.schemeName || '',
      CPO_Order_Type__c: setup.schemeType || '',
      
      // Contacts and Access Section
      Contact_Name__c: contacts.primaryContactName || '',
      Contact_Email__c: contacts.primaryContactEmail || '',
      Contact_Phone__c: contacts.primaryContactPhone || '',
      
      // Planning and Environmental Section
      Planning_Permission_Status__c: planning.planningStatus || '',
      Environmental_Assessment_Required__c: planning.environmentalImpactRequired || '',
      
      // Core Documents (Store filenames, URLs, or statuses)
      CPO_Order__c: getFilenames(appData.documents?.orderDocument),
      Order_Map__c: getFilenames(appData.documents?.mapDocument),
      Statement_of_Reasons__c: getFilenames(appData.documents?.statementOfReasons),
      
      // We still store the raw JSON in a backup field just in case
      Application_Data__c: JSON.stringify(appData)
    }

    // Clean up empty fields so we don't send nulls for things not yet created
    Object.keys(sfRecord).forEach(key => {
      if (sfRecord[key] === null || sfRecord[key] === undefined) {
        delete sfRecord[key];
      }
    });

    console.log(`[SF] Upserting CPO_Application__c with AWS_Application_Id__c = ${applicationId}`)

    const result = await this.apiRequest(
      'PATCH',
      `/sobjects/CPO_Application__c/AWS_Application_Id__c/${applicationId}`,
      sfRecord
    )

    console.log(`[SF] Upsert result:`, result)
    return result
  }
}

// Singleton instance
const salesforceClient = new SalesforceClient()

module.exports = { salesforceClient, SalesforceClient }
