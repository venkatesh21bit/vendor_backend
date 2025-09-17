const express = require('express');
const router = express.Router();

// Default groups/roles in the system
const DEFAULT_GROUPS = [
  {
    id: 1,
    name: 'manufacturers',
    display_name: 'Manufacturers',
    description: 'Companies that manufacture products',
    permissions: ['create_products', 'manage_inventory', 'view_orders', 'manage_company']
  },
  {
    id: 2,
    name: 'retailers',
    display_name: 'Retailers',
    description: 'Companies that sell products to end customers',
    permissions: ['place_orders', 'view_products', 'manage_profile']
  },
  {
    id: 3,
    name: 'suppliers',
    display_name: 'Suppliers',
    description: 'Companies that supply raw materials or components',
    permissions: ['supply_materials', 'manage_inventory', 'view_orders']
  },
  {
    id: 4,
    name: 'delivery-agents',
    display_name: 'Delivery Agents',
    description: 'Agents responsible for product delivery',
    permissions: ['manage_deliveries', 'update_delivery_status', 'view_orders']
  },
  {
    id: 5,
    name: 'distributors',
    display_name: 'Distributors',
    description: 'Companies that distribute products to retailers',
    permissions: ['manage_distribution', 'view_inventory', 'place_orders', 'view_retailers']
  }
];

// GET /api/groups - Get all available groups/roles
router.get('/groups', (req, res) => {
  try {
    // Return just the group names as expected by frontend
    const groupNames = DEFAULT_GROUPS.map(group => group.display_name);
    
    console.log('Groups requested, returning:', groupNames); // Debug log
    
    res.json({
      groups: groupNames
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      error: 'Internal server error while fetching groups'
    });
  }
});

// GET /api/groups/detailed - Get all groups with detailed information
router.get('/groups/detailed', (req, res) => {
  try {
    res.json({
      success: true,
      data: DEFAULT_GROUPS,
      message: 'Detailed groups retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching detailed groups:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching detailed groups'
    });
  }
});

// GET /api/groups/:id - Get specific group by ID
router.get('/groups/:id', (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const group = DEFAULT_GROUPS.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    res.json({
      success: true,
      data: group,
      message: 'Group retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching group'
    });
  }
});

// GET /api/groups/name/:name - Get specific group by name
router.get('/groups/name/:name', (req, res) => {
  try {
    const groupName = req.params.name.toLowerCase();
    const group = DEFAULT_GROUPS.find(g => g.name.toLowerCase() === groupName);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    res.json({
      success: true,
      data: group,
      message: 'Group retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching group by name:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching group'
    });
  }
});

module.exports = router;