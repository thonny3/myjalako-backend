const express = require('express');
const router = express.Router({ mergeParams: true });
const DettesController = require('../controllers/dettesController');

// Dettes
router.get('/', DettesController.list);
router.post('/', DettesController.create);
router.put('/:id_dette', DettesController.update);
router.delete('/:id_dette', DettesController.remove);

// Remboursements
router.get('/:id_dette/remboursements', DettesController.listPayments);
router.post('/:id_dette/remboursements', DettesController.addPayment);

module.exports = router;


