const LocationsService = require('./locations.service');

class LocationsController {
  constructor() {
    this.locationsService = new LocationsService();
  }

  /**
   * Get popular locations with property counts
   * @route GET /api/properties/locations/popular
   */
  getPopularLocations = async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const locations = await this.locationsService.getPopularLocations(
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: locations,
      });
    } catch (error) {
      console.error('Error getting popular locations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get popular locations',
        error: error.message,
      });
    }
  };

  /**
   * Get all unique states/provinces
   * @route GET /api/properties/locations/states
   */
  getStates = async (req, res) => {
    try {
      const states = await this.locationsService.getStates();

      res.status(200).json({
        success: true,
        data: states,
      });
    } catch (error) {
      console.error('Error getting states:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get states',
        error: error.message,
      });
    }
  };

  /**
   * Get all unique cities for a specific state
   * @route GET /api/properties/locations/cities
   */
  getCitiesByState = async (req, res) => {
    try {
      const { state } = req.query;
      if (!state) {
        return res.status(400).json({
          success: false,
          message: 'State parameter is required',
        });
      }

      const cities = await this.locationsService.getCitiesByState(state);

      res.status(200).json({
        success: true,
        data: cities,
      });
    } catch (error) {
      console.error('Error getting cities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cities',
        error: error.message,
      });
    }
  };
}

module.exports = new LocationsController();
