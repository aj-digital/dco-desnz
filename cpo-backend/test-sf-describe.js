require('dotenv').config();
const { salesforceClient } = require('./src/services/salesforce');

async function describeObject() {
  try {
    const describe = await salesforceClient.apiRequest('GET', '/sobjects/CPO_Application__c/describe');
    const fields = describe.fields.map(f => f.name);
    console.log(`Fields on CPO_Application__c:`);
    console.log(fields);
  } catch (err) {
    console.error(err.message);
  }
}

describeObject();
