const express = require('express');
const router = express.Router();
const BudgetController = require('../controllers/budgetController');

router.get('/', BudgetController.getAll);
router.post('/', BudgetController.add);
router.put('/:id_budget', BudgetController.update);
router.delete('/:id_budget', BudgetController.delete);

module.exports = router;
