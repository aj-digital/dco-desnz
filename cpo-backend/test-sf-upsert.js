require('dotenv').config();
const { salesforceClient } = require('./src/services/salesforce');

async function testUpsert() {
  try {
    console.log('Testing Salesforce record upsert...');
    // Mock application ID (UUID)
    const appId = '123e4567-e89b-12d3-a456-426614174000';
    
    // Mock data based on what our backend will send
    const mockData = {
      submissionReference: 'T-CPO-' + Math.floor(Math.random() * 1000000),
      submittedAt: new Date().toISOString(),
      applicationData: {
        applicantDetails: {
          orgName: 'Test Organization Ltd'
        }
      }
    };
    
    const result = await salesforceClient.upsertApplication(appId, mockData);
    console.log('✅ Upsert successful! Result:', result);
  } catch (error) {
    console.error('❌ Upsert failed:');
    if (error.status) {
       console.error(`Status: ${error.status}`);
       console.error(`Body:`, error.body);
    } else {
       console.error(error.message);
    }
  }
}

testUpsert();
