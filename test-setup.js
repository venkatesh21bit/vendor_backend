const mongoose = require('mongoose');
require('dotenv').config();

// Import models to test
const User = require('./models/User');
const Company = require('./models/Company');
const Product = require('./models/Product');
const ProductCategory = require('./models/ProductCategory');
const Order = require('./models/Order');
const Invoice = require('./models/Invoice');
const RetailerProfile = require('./models/RetailerProfile');
const { CompanyRetailerConnection, RetailerRequest, CompanyInvite } = require('./models/Connection');

async function testConnection() {
  try {
    console.log('🔌 Testing MongoDB connection...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB successfully');

    // Test model initialization
    console.log('\n📋 Testing models...');
    
    const models = [
      { name: 'User', model: User },
      { name: 'Company', model: Company },
      { name: 'Product', model: Product },
      { name: 'ProductCategory', model: ProductCategory },
      { name: 'Order', model: Order },
      { name: 'Invoice', model: Invoice },
      { name: 'RetailerProfile', model: RetailerProfile },
      { name: 'CompanyRetailerConnection', model: CompanyRetailerConnection },
      { name: 'RetailerRequest', model: RetailerRequest },
      { name: 'CompanyInvite', model: CompanyInvite }
    ];

    for (const { name, model } of models) {
      try {
        await model.findOne().limit(1);
        console.log(`✅ ${name} model working`);
      } catch (error) {
        console.log(`❌ ${name} model error:`, error.message);
      }
    }

    // Test collections exist or can be created
    console.log('\n📊 Database collections status:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const expectedCollections = [
      'users', 'companies', 'products', 'productcategories', 
      'orders', 'invoices', 'retailerprofiles', 'companyretailerconnections',
      'retailerrequests', 'companyinvites'
    ];

    expectedCollections.forEach(collectionName => {
      if (collectionNames.includes(collectionName)) {
        console.log(`✅ Collection '${collectionName}' exists`);
      } else {
        console.log(`ℹ️  Collection '${collectionName}' will be created on first insert`);
      }
    });

    console.log('\n🎉 Backend setup test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm start (to start the server)');
    console.log('2. Test API endpoints using Postman or curl');
    console.log('3. Create your first user via POST /api/register');
    console.log('4. Login and get JWT token via POST /api/login');
    console.log('5. Use the token to access protected endpoints');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.name === 'MongoServerError') {
      console.error('💡 Check your MongoDB connection string and network access');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the test
testConnection();