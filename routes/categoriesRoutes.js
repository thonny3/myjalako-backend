const express = require('express');
const router = express.Router();
const CategoriesController = require('../controllers/categoriesController');

// Routes for categories depenses
router.get('/depenses', CategoriesController.allDepenses); 
router.post('/depenses', CategoriesController.add);
router.put('/depenses/:id', CategoriesController.update);
router.delete('/depenses/:id', CategoriesController.delete);
// Routes for categories revenues
router.get('/revenues', CategoriesController.allRevenues);
router.post('/revenues', CategoriesController.addRevenues);
router.put('/revenues/:id', CategoriesController.updateRevenues);
router.delete('/revenues/:id', CategoriesController.deleteRevenues);
   

module.exports = router;