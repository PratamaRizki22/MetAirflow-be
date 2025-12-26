const paymentsController = require('./payments.controller');
const paymentsService = require('./payments.service');
const paymentsRoutes = require('./payments.routes');

module.exports = {
    controller: paymentsController,
    service: paymentsService,
    routes: paymentsRoutes,
};
