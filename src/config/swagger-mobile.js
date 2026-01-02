const swaggerJsdoc = require('swagger-jsdoc');

const swaggerMobileOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rentverse Mobile API',
      version: '1.0.0',
      description:
        'Mobile API documentation for Rentverse application. Endpoint prefix: /api/v1/m/',
      contact: {
        name: 'API Support',
        email: 'support@rentverse.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: 'https://rentverse-api.loseyourip.com/api',
        description: 'Production server',
      },
      {
        url: `http://localhost:${process.env.PORT || 3005}`,
        description: 'Local development server',
      },
      {
        url:
          process.env.NGROK_URL ||
          `http://localhost:${process.env.PORT || 3005}`,
        description: process.env.NGROK_URL
          ? 'Ngrok tunnel server'
          : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Mobile - General',
        description: 'General mobile endpoints',
      },
      {
        name: 'Mobile - Auth',
        description: 'Authentication endpoints for mobile app',
      },
      {
        name: 'Mobile - Users',
        description: 'User management endpoints for mobile app',
      },
      {
        name: 'Mobile - Properties',
        description: 'Property endpoints for mobile app',
      },
      {
        name: 'Mobile - Bookings',
        description: 'Booking endpoints for mobile app',
      },
      {
        name: 'Mobile - Property Types',
        description: 'Property type endpoints for mobile app',
      },
      {
        name: 'Mobile - Amenities',
        description: 'Amenity endpoints for mobile app',
      },
      {
        name: 'Mobile - Predictions',
        description: 'Prediction endpoints for mobile app',
      },
    ],
  },
  apis: [
    './src/routes/mobile/*.js',
    './src/modules/*/mobile.routes.js',
    './src/app.js',
  ],
};

const mobileSpecs = swaggerJsdoc(swaggerMobileOptions);

module.exports = mobileSpecs;
