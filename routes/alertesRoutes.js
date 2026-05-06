const express = require('express');
const router = express.Router({ mergeParams: true });
const AlertesController = require('../controllers/alertesController');

// GET /api/alertes/:id_user
router.get('/:id_user', AlertesController.list);

// GET /api/alertes/:id_user/unread
router.get('/:id_user/unread', AlertesController.listUnread);

// POST /api/alertes
router.post('/', AlertesController.create);

// PATCH /api/alertes/:id_alerte/read
router.patch('/:id_alerte/read', AlertesController.markAsRead);

// PATCH /api/alertes/:id_user/read-all
router.patch('/:id_user/read-all', AlertesController.markAllAsRead);

// DELETE /api/alertes/:id_alerte
router.delete('/:id_alerte', AlertesController.remove);

module.exports = router;


