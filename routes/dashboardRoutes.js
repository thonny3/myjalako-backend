const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

router.get('/summary', DashboardController.summary);

module.exports = router;


