const express = require('express');
const router = express.Router();
const ObjectifController = require('../controllers/objectifController');

router.get('/', ObjectifController.getAll);
router.post('/', ObjectifController.add);
router.put('/:id_objectif', ObjectifController.update);
router.delete('/:id_objectif', ObjectifController.delete);

module.exports = router;
