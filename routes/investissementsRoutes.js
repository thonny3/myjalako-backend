const express = require('express');
const router = express.Router({ mergeParams: true });
const Ctrl = require('../controllers/investissementsController');

router.get('/', Ctrl.list);
router.post('/', Ctrl.create);
router.put('/:id_investissement', Ctrl.update);
router.delete('/:id_investissement', Ctrl.remove);

router.get('/:id_investissement/revenus', Ctrl.listRevenus);
router.post('/:id_investissement/revenus', Ctrl.addRevenu);

router.get('/:id_investissement/depenses', Ctrl.listDepenses);
router.post('/:id_investissement/depenses', Ctrl.addDepense);

module.exports = router;


