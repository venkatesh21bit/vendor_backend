const mongoose = require('mongoose');
const ProductCategory = require('./models/ProductCategory');
const Company = require('./models/Company');

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vendor_backend';

async function createSampleCategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all companies
    const companies = await Company.find({});
    console.log(`Found ${companies.length} companies`);

    if (companies.length === 0) {
      console.log('No companies found. Please create a company first.');
      return;
    }

    // Sample categories
    const sampleCategories = [
      { name: 'Electronics', description: 'Electronic devices and components' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Home & Garden', description: 'Home improvement and garden supplies' },
      { name: 'Food & Beverages', description: 'Food products and drinks' },
      { name: 'Books', description: 'Books and educational materials' },
      { name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear' },
      { name: 'Health & Beauty', description: 'Health and beauty products' },
      { name: 'Automotive', description: 'Car parts and automotive supplies' },
      { name: 'Tools & Hardware', description: 'Tools and hardware supplies' },
      { name: 'Toys & Games', description: 'Toys and gaming products' }
    ];

    for (const company of companies) {
      console.log(`Creating categories for company: ${company.name}`);
      
      for (const categoryData of sampleCategories) {
        // Check if category already exists for this company
        const existingCategory = await ProductCategory.findOne({
          name: categoryData.name,
          company: company._id
        });

        if (!existingCategory) {
          const category = new ProductCategory({
            name: categoryData.name,
            description: categoryData.description,
            company: company._id,
            sort_order: sampleCategories.indexOf(categoryData)
          });

          await category.save();
          console.log(`  Created category: ${categoryData.name}`);
        } else {
          console.log(`  Category already exists: ${categoryData.name}`);
        }
      }
    }

    console.log('Sample categories created successfully!');
  } catch (error) {
    console.error('Error creating sample categories:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
createSampleCategories();