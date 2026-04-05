require('dotenv').config();
const { salesforceClient } = require('./src/services/salesforce');

async function checkRecords() {
  try {
    console.log('Querying Salesforce for CPO Applications...');
    // We can use the apiRequest method to run a SOQL query
    const result = await salesforceClient.apiRequest('GET', '/query?q=SELECT+Id,Name,AWS_Application_Id__c,Submission_Reference__c,Application_Status__c+FROM+CPO_Application__c');
    console.log(`✅ Found ${result.totalSize} records in Salesforce:`);
    console.log(result.records);
  } catch (error) {
    console.error('❌ Query failed:');
    if (error.status) {
       console.error(`Status: ${error.status}`);
       console.error(`Body:`, error.body);
    } else {
       console.error(error);
    }
  }
}

checkRecords();
