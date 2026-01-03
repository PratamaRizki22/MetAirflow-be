const express = require('express');
const router = express.Router();
const refundService = require('../services/refund.service');
const { auth } = require('../middleware/auth');

// Create refund request (tenant)
router.post('/request', auth, async (req, res) => {
  try {
    const { leaseId, reason } = req.body;

    if (!leaseId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Lease ID and reason are required',
      });
    }

    const refundRequest = await refundService.createRefundRequest(
      leaseId,
      req.user.id,
      reason
    );

    res.json({
      success: true,
      data: refundRequest,
      message: 'Refund request submitted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get refund requests (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.isHost ? 'landlord' : 'tenant';
    const refundRequests = await refundService.getRefundRequests(
      req.user.id,
      role
    );

    res.json({
      success: true,
      data: refundRequests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Approve refund (landlord)
router.post('/:id/approve', auth, async (req, res) => {
  try {
    if (!req.user.isHost) {
      return res.status(403).json({
        success: false,
        message: 'Only landlords can approve refunds',
      });
    }

    const { note } = req.body;
    const result = await refundService.approveRefund(
      req.params.id,
      req.user.id,
      note
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Reject refund (landlord)
router.post('/:id/reject', auth, async (req, res) => {
  try {
    if (!req.user.isHost) {
      return res.status(403).json({
        success: false,
        message: 'Only landlords can reject refunds',
      });
    }

    const { note } = req.body;
    const result = await refundService.rejectRefund(
      req.params.id,
      req.user.id,
      note || 'No reason provided'
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
