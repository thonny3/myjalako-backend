const express = require('express');
const router = express.Router();
const ContributionController  = require('../controllers/ContributionsController');

router.get('/:id_objectif', ContributionController.getAll);
router.post('/', ContributionController.add);

module.exports = router;
