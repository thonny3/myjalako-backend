const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');

// Routes protégées pour les administrateurs - Utilisation du middleware isAdmin
router.get('/stats', auth, auth.isAdmin, AdminController.getStats);
router.get('/users', auth, auth.isAdmin, AdminController.getAllUsers);

module.exports = router;
