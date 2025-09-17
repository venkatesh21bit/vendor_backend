const express = require('express');
const { CompanyInvite, RetailerRequest, CompanyRetailerConnection } = require('../models/Connection');
const Company = require('../models/Company');
const User = require('../models/User');
const RetailerProfile = require('../models/RetailerProfile');
const { authMiddleware, requireManufacturer, requireRetailer } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Helper function to check company ownership
const checkCompanyOwnership = async (companyId, userId) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  const isOwner = company.owner.toString() === userId.toString();
  const isEmployee = company.employees.includes(userId);

  if (!isOwner && !isEmployee) {
    throw new Error('Access denied. You are not associated with this company.');
  }

  return company;
};

// COMPANY INVITE ROUTES

// POST /api/company/generate-invite-code/ - Generate invite code
router.post('/company/generate-invite-code', authMiddleware, requireManufacturer, validate(schemas.generateInvite), async (req, res) => {
  try {
    const { message, expires_in_days = 7, email } = req.body;

    // Get user's company
    const company = await Company.findOne({ owner: req.userId });
    if (!company) {
      return res.status(403).json({
        error: 'You must be associated with a company to generate invite codes.'
      });
    }

    if (expires_in_days < 1 || expires_in_days > 30) {
      return res.status(400).json({
        error: 'Expiration must be between 1 and 30 days.'
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const invite = new CompanyInvite({
      company: company._id,
      invited_by: req.userId,
      email: email || '',
      message: message || 'Join our network to access our products.',
      expires_at: expiresAt
    });

    await invite.save();

    await invite.populate([
      { path: 'company', select: 'id name address' },
      { path: 'invited_by', select: 'id username email' }
    ]);

    res.status(201).json({
      message: 'Invite code generated successfully.',
      invite_code: invite.invite_code,
      expires_at: invite.expires_at,
      invite: {
        id: invite._id,
        invite_code: invite.invite_code,
        company: invite.company,
        invited_by: invite.invited_by,
        email: invite.email,
        message: invite.message,
        created_at: invite.createdAt,
        expires_at: invite.expires_at,
        is_used: invite.is_used,
        used_at: invite.used_at,
        used_by: invite.used_by
      }
    });
  } catch (error) {
    console.error('Generate invite code error:', error);
    res.status(500).json({ error: 'Server error while generating invite code' });
  }
});

// GET /api/company/invites/ - Get company invitations
router.get('/company/invites', authMiddleware, requireManufacturer, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.userId });
    if (!company) {
      return res.status(403).json({
        error: 'You must be associated with a company to view invites.'
      });
    }

    const invites = await CompanyInvite.find({ company: company._id })
      .populate('company', 'id name address')
      .populate('invited_by', 'id username email')
      .populate('used_by', 'id username email')
      .sort({ createdAt: -1 });

    res.json(invites);
  } catch (error) {
    console.error('Get company invites error:', error);
    res.status(500).json({ error: 'Server error while fetching company invites' });
  }
});

// RETAILER REQUEST ROUTES

// GET /api/company/retailer-requests/ - Get retailer requests
router.get('/company/retailer-requests', authMiddleware, requireManufacturer, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.userId });
    if (!company) {
      return res.status(403).json({
        error: 'You must be associated with a company to view requests.'
      });
    }

    const requests = await RetailerRequest.find({ company: company._id })
      .populate('retailer', 'id username email first_name last_name')
      .populate('company', 'id name address')
      .populate('reviewed_by', 'id username email')
      .sort({ requested_at: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get retailer requests error:', error);
    res.status(500).json({ error: 'Server error while fetching retailer requests' });
  }
});

// POST /api/company/accept-request/ - Accept/reject retailer request
router.post('/company/accept-request', authMiddleware, requireManufacturer, validate(schemas.handleRequest), async (req, res) => {
  try {
    const { request_id, action, credit_limit, payment_terms } = req.body;

    const request = await RetailerRequest.findOne({
      _id: request_id,
      status: 'pending'
    }).populate('company').populate('retailer');

    if (!request) {
      return res.status(404).json({
        error: 'Request not found or already processed.'
      });
    }

    // Check if user owns the company
    if (request.company.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied. You can only manage requests for your company.'
      });
    }

    if (action === 'approve') {
      // Check if connection already exists
      const existingConnection = await CompanyRetailerConnection.findOne({
        company: request.company._id,
        retailer: request.retailer._id
      });

      if (existingConnection) {
        return res.status(400).json({
          error: 'Connection already exists with this retailer.'
        });
      }

      // Create connection
      const connection = new CompanyRetailerConnection({
        company: request.company._id,
        retailer: request.retailer._id,
        approved_by: req.userId,
        credit_limit: credit_limit || 0,
        payment_terms: payment_terms || 'Net 30 days'
      });

      await connection.save();

      // Update request
      request.status = 'approved';
      request.reviewed_by = req.userId;
      request.reviewed_at = new Date();
      await request.save();

      // TODO: Send email notification to retailer
      console.log(`Retailer request approved for ${request.retailer.email}`);

      res.json({
        message: 'Retailer request approved successfully.',
        connection_id: connection._id
      });
    } else if (action === 'reject') {
      request.status = 'rejected';
      request.reviewed_by = req.userId;
      request.reviewed_at = new Date();
      await request.save();

      // TODO: Send email notification to retailer
      console.log(`Retailer request rejected for ${request.retailer.email}`);

      res.json({
        message: 'Retailer request rejected.'
      });
    } else {
      return res.status(400).json({
        error: 'action must be either "approve" or "reject".'
      });
    }
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Server error while processing request' });
  }
});

// CONNECTION ROUTES

// GET /api/company/connections/ - Get company connections
router.get('/company/connections', authMiddleware, requireManufacturer, async (req, res) => {
  try {
    const { status = 'approved' } = req.query;

    const company = await Company.findOne({ owner: req.userId });
    if (!company) {
      return res.status(403).json({
        error: 'You must be associated with a company to view connections.'
      });
    }

    const query = { company: company._id };
    if (status) {
      query.status = status;
    }

    const connections = await CompanyRetailerConnection.find(query)
      .populate('company', 'id name address')
      .populate('retailer', 'id username email first_name last_name')
      .populate('approved_by', 'id username email')
      .sort({ connected_at: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get company connections error:', error);
    res.status(500).json({ error: 'Server error while fetching company connections' });
  }
});

// POST /api/company/update-connection/ - Update connection status
router.post('/company/update-connection', authMiddleware, requireManufacturer, validate(schemas.updateConnection), async (req, res) => {
  try {
    const { connection_id, status } = req.body;

    const connection = await CompanyRetailerConnection.findById(connection_id)
      .populate('company');

    if (!connection) {
      return res.status(404).json({
        error: 'Connection not found.'
      });
    }

    // Check if user owns the company
    if (connection.company.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied. You can only manage connections for your company.'
      });
    }

    const oldStatus = connection.status;
    connection.status = status;

    if (status === 'suspended') {
      connection.suspended_at = new Date();
      connection.suspended_by = req.userId;
    }

    await connection.save();

    const message = status === 'suspended' 
      ? 'Connection suspended successfully.'
      : 'Connection reactivated successfully.';

    // TODO: Send email notification to retailer
    console.log(`Connection ${status} for retailer ${connection.retailer}`);

    res.json({ message });
  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({ error: 'Server error while updating connection' });
  }
});

// RETAILER ROUTES

// POST /api/retailer/join-by-code/ - Join company by invite code
router.post('/retailer/join-by-code', authMiddleware, requireRetailer, validate(schemas.joinByCode), async (req, res) => {
  try {
    const { invite_code } = req.body;

    const invite = await CompanyInvite.findOne({
      invite_code: invite_code.toUpperCase(),
      expires_at: { $gt: new Date() },
      is_used: false
    }).populate('company', 'name address');

    if (!invite) {
      return res.status(400).json({
        error: 'Invalid or expired invite code.'
      });
    }

    // Check if connection already exists
    const existingConnection = await CompanyRetailerConnection.findOne({
      company: invite.company._id,
      retailer: req.userId
    });

    if (existingConnection) {
      return res.status(400).json({
        error: 'You are already connected to this company.'
      });
    }

    // Create connection
    const connection = new CompanyRetailerConnection({
      company: invite.company._id,
      retailer: req.userId,
      approved_by: invite.invited_by,
      credit_limit: invite.company.settings?.default_credit_limit || 0,
      payment_terms: invite.company.settings?.default_payment_terms || 'Net 30 days'
    });

    await connection.save();

    // Mark invite as used
    invite.is_used = true;
    invite.used_at = new Date();
    invite.used_by = req.userId;
    invite.current_uses += 1;
    await invite.save();

    await connection.populate('company', 'id name');

    res.json({
      message: 'Successfully joined company.',
      connection: {
        id: connection._id,
        company: connection.company._id,
        company_name: connection.company.name,
        status: connection.status
      }
    });
  } catch (error) {
    console.error('Join by code error:', error);
    res.status(500).json({ error: 'Server error while joining company' });
  }
});

// POST /api/retailer/request-approval/ - Request company approval
router.post('/retailer/request-approval', authMiddleware, requireRetailer, validate(schemas.requestApproval), async (req, res) => {
  try {
    const { company_id, message } = req.body;

    const company = await Company.findById(company_id);
    if (!company) {
      return res.status(404).json({
        error: 'Company not found.'
      });
    }

    if (!company.is_public) {
      return res.status(400).json({
        error: 'This company is not accepting public requests.'
      });
    }

    // Check if connection already exists
    const existingConnection = await CompanyRetailerConnection.findOne({
      company: company_id,
      retailer: req.userId
    });

    if (existingConnection) {
      return res.status(400).json({
        error: 'You are already connected to this company.'
      });
    }

    // Check if request already exists
    const existingRequest = await RetailerRequest.findOne({
      company: company_id,
      retailer: req.userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        error: 'You already have a pending request to this company.'
      });
    }

    const request = new RetailerRequest({
      retailer: req.userId,
      company: company_id,
      message
    });

    await request.save();

    await request.populate('company', 'id name');

    // TODO: Send email notification to company owner
    console.log(`New retailer request from ${req.user.email} to ${company.name}`);

    res.json({
      message: 'Request sent successfully.',
      request: {
        id: request._id,
        company: request.company._id,
        company_name: request.company.name,
        status: request.status,
        requested_at: request.requested_at
      }
    });
  } catch (error) {
    console.error('Request approval error:', error);
    res.status(500).json({ error: 'Server error while sending request' });
  }
});

// GET /api/retailer/companies/ - Get retailer's connected companies
router.get('/retailer/companies', authMiddleware, requireRetailer, async (req, res) => {
  try {
    const connections = await CompanyRetailerConnection.find({
      retailer: req.userId,
      status: { $in: ['approved', 'suspended'] }
    })
      .populate('company', 'id name description city state')
      .sort({ connected_at: -1 });

    const formattedConnections = connections.map(conn => ({
      id: conn._id,
      company: conn.company._id,
      company_name: conn.company.name,
      retailer: conn.retailer,
      retailer_name: req.user.username, // Add retailer name from current user
      status: conn.status,
      connected_at: conn.connected_at,
      credit_limit: conn.credit_limit.toString() // Convert to string to match frontend expectation
    }));

    res.json(formattedConnections);
  } catch (error) {
    console.error('Get retailer companies error:', error);
    res.status(500).json({ error: 'Server error while fetching connected companies' });
  }
});

// GET /api/retailer/companies/count/ - Get count of connected companies
router.get('/retailer/companies/count', authMiddleware, requireRetailer, async (req, res) => {
  try {
    const count = await CompanyRetailerConnection.countDocuments({
      retailer: req.userId,
      status: 'approved'
    });

    res.json({ count });
  } catch (error) {
    console.error('Get retailer companies count error:', error);
    res.status(500).json({ error: 'Server error while fetching companies count' });
  }
});

module.exports = router;