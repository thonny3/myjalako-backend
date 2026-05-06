const express = require('express');
const router = express.Router();
const comptesPartagesController = require('../controllers/comptesPartagesController');
const verifyOwnerRole = require('../middlewares/verifyOwner');

// Ajouter un partage
router.post('/' , comptesPartagesController.create);

// Lister tous les utilisateurs liés à un compte
router.get('/compte/:id_compte', comptesPartagesController.getByCompte);

// Lister tous les comptes auxquels un utilisateur a accès
router.get('/user/:id_user', comptesPartagesController.getByUser);

// Supprimer un partage
router.delete('/:id', comptesPartagesController.delete);

router.put('/:id', comptesPartagesController.updateRole);

module.exports = router;
