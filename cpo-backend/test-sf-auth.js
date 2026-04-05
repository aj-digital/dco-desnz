require('dotenv').config();
const { salesforceClient } = require('./src/services/salesforce');

async function testAuth() {
  try {
    console.log('Testing Salesforce authentication...');
    await salesforceClient.authenticate();
    console.log('✅ Authentication successful! Token configured in client.');
    console.log('Instance URL:', salesforceClient.instanceUrl);
  } catch (error) {
    console.error('❌ Authentication failed:');
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testAuth();
