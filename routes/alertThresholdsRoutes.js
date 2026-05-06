const express = require('express');
const router = express.Router({ mergeParams: true });
const AlertThresholdsController = require('../controllers/alertThresholdsController');

// GET /api/alert-thresholds/:id_user
router.get('/:id_user', AlertThresholdsController.list);

// GET /api/alert-thresholds/:id_user/:domain
router.get('/:id_user/:domain', AlertThresholdsController.getOne);

// POST /api/alert-thresholds (upsert)
router.post('/', AlertThresholdsController.upsert);

// DELETE /api/alert-thresholds/:id_user/:domain
router.delete('/:id_user/:domain', AlertThresholdsController.remove);

module.exports = router;


