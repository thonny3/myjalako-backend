const express = require('express');
const router = express.Router();
const RevenuController = require('../controllers/revenuesController');

router.get('/', RevenuController.getAll);   
router.post('/', RevenuController.add);   
router.put('/:id', RevenuController.update);   
router.delete('/:id', RevenuController.delete);   
router.get('/:id', RevenuController.getById);   
   

module.exports = router;