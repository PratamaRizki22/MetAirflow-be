const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isHost: true, // Make sure isHost is selected
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found or inactive.',
      });
    }

    // Attach computed isLandlord for convenience if needed by consumers relying on req.user directly
    // checking properties is expensive here so we rely on isHost mostly,
    // but strict landlord check usually happens in service layer
    user.isLandlord = user.isHost === true;

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.',
    });
  }
};

// Optional authentication - doesn't fail if no token, but sets req.user if valid token exists
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isHost: true, // Make sure isHost is selected
        isActive: true,
      },
    });

    if (user && user.isActive) {
      user.isLandlord = user.isHost === true;
      req.user = user;
    }

    next();
  } catch (error) {
    // Token invalid but we don't fail - just continue without user
    next();
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

module.exports = { auth, optionalAuth, authorize };
