const express = require('express');
const router = express.Router();
const controller = require('../controllers/transfertsController');

router.post('/compte-vers-objectif', controller.compteVersObjectif);
router.post('/objectif-vers-compte', controller.objectifVersCompte);
router.post('/compte-vers-compte', controller.compteVersCompte);
router.get('/historique', controller.historique);

module.exports = router;


