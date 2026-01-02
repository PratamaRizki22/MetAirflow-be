const { prisma } = require('../../config/database');

class LocationsService {
  /**
   * Get popular locations with property counts
   */
  async getPopularLocations(limit = 10) {
    const locations = await prisma.$queryRaw`
      SELECT 
        state as name,
        COUNT(*)::int as "propertyCount",
        MIN(latitude) as latitude,
        MIN(longitude) as longitude
      FROM properties
      WHERE status = 'ACTIVE' AND "isAvailable" = true
      GROUP BY state
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `;

    return locations;
  }

  /**
   * Get all unique states with property counts
   */
  async getStates() {
    const states = await prisma.$queryRaw`
      SELECT 
        state as name,
        COUNT(*)::int as "propertyCount"
      FROM properties
      WHERE status = 'ACTIVE' AND "isAvailable" = true
      GROUP BY state
      ORDER BY state ASC
    `;

    return states;
  }

  /**
   * Get cities for a specific state
   */
  async getCitiesByState(state) {
    const cities = await prisma.$queryRaw`
      SELECT 
        city as name,
        COUNT(*)::int as "propertyCount"
      FROM properties
      WHERE status = 'ACTIVE' 
        AND "isAvailable" = true
        AND state = ${state}
      GROUP BY city
      ORDER BY COUNT(*) DESC
    `;

    return cities;
  }
}

module.exports = LocationsService;
