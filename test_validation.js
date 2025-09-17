const { schemas } = require('./middleware/validation');

// Test data that matches what frontend sends
const testData = {
  name: "Test Product",
  company: 12345, // Number from frontend
  category: 67890, // Number from frontend
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

console.log('Testing validation with frontend data:');
console.log(JSON.stringify(testData, null, 2));

const { error, value } = schemas.createProduct.validate(testData);

if (error) {
  console.log('\nValidation FAILED:');
  console.log('Error:', error.message);
  console.log('Details:', error.details.map(d => d.message));
} else {
  console.log('\nValidation PASSED!');
  console.log('Validated data:', JSON.stringify(value, null, 2));
}