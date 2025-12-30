const axios = require('axios');

// Status global untuk mengontrol forward ke model
let predictionServiceStatus = {
  isEnabled: true, // Default: nyala
  lastUpdated: new Date(),
  updatedBy: null,
};

class PredictionsController {
  // Endpoint untuk toggle status ON/OFF
  async toggleStatus(req, res) {
    try {
      const { enabled } = req.body;
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Field "enabled" must be a boolean value',
        });
      }

      // Update status
      predictionServiceStatus = {
        isEnabled: enabled,
        lastUpdated: new Date(),
        updatedBy: userEmail || userId,
      };

      res.json({
        success: true,
        message: `Prediction service ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          status: predictionServiceStatus,
        },
      });
    } catch (error) {
      console.error('Toggle prediction status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  // Endpoint untuk melihat status saat ini
  async getStatus(req, res) {
    try {
      res.json({
        success: true,
        data: {
          status: predictionServiceStatus,
        },
      });
    } catch (error) {
      console.error('Get prediction status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  // Endpoint proxy untuk forward request ke model
  async predict(req, res) {
    try {
      // Check if prediction service is enabled
      if (!predictionServiceStatus.isEnabled) {
        return res.status(503).json({
          success: false,
          message: 'Prediction service is currently disabled',
        });
      }

      console.log('Forwarding prediction request to ML service:', req.body);

      // Forward request to AI model with timeout
      const aiServiceUrl =
        process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.post(
        `${aiServiceUrl}/api/v1/predict/single`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      console.log('ML service response:', response.data);

      res.json({
        success: true,
        data: response.data,
      });
    } catch (error) {
      console.error('Prediction error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Handle specific error cases
      if (error.code === 'ECONNREFUSED') {
        return res.status(502).json({
          success: false,
          message:
            'ML prediction service is unavailable. Please try again later.',
          error: 'Connection refused',
        });
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'Prediction request timed out. Please try again.',
          error: 'Timeout',
        });
      }

      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || 'Failed to get prediction',
        error: error.response?.data || error.message,
      });
    }
  }
}

module.exports = new PredictionsController();
