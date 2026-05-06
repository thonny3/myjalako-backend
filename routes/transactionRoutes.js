const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transactionController');
const auth = require('../middlewares/auth');
router.get('/', auth, TransactionController.getAll);
module.exports = router;