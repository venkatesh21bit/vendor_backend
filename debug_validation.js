const { schemas } = require('./middleware/validation');

// Test exactly what the frontend is sending
const testData = {
  name: "Test Product",
  company: 12345,
  category: 67890,
  available_quantity: 100,
  unit: "PCS",
  total_shipped: 0,
  total_required_quantity: 100,
  price: 99.99,
  hsn_code: "1234",
  cgst_rate: 9,
  sgst_rate: 9,
  igst_rate: 0,
  cess_rate: 0,
  status: "sufficient"
};

console.log('Testing validation...');
console.log('Company value:', testData.company, 'Type:', typeof testData.company);

const { error, value } = schemas.createProduct.validate(testData, { abortEarly: false });

if (error) {
  console.log('\nValidation FAILED:');
  console.log('Error details:', error.details.map(d => ({
    field: d.path.join('.'),
    message: d.message,
    value: d.context.value,
    type: typeof d.context.value
  })));
} else {
  console.log('\nValidation PASSED!');
}

// Also test with string ObjectId
console.log('\n--- Testing with ObjectId string ---');
const testData2 = { ...testData, company: "507f1f77bcf86cd799439011" };
const result2 = schemas.createProduct.validate(testData2);
console.log('ObjectId test:', result2.error ? 'FAILED' : 'PASSED');
if (result2.error) {
  console.log('Error:', result2.error.message);
}