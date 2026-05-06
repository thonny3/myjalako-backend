const express = require('express');
const router = express.Router();
const compteController = require('../controllers/compteController');

// CRUD Comptes
router.post('/', compteController.create);            // Créer un compte
router.get('/', compteController.getAll);             // Récupérer tous les comptes
router.get('/:id_compte', compteController.getById);  // Récupérer un compte par ID
router.get('/user/:id_user', compteController.getByUser); // Récupérer les comptes d’un utilisateur
router.put('/:id_compte', compteController.update);   // Mettre à jour un compte
router.delete('/:id_compte', compteController.delete); // Supprimer un compte
router.get('/mycompte/user', compteController.getMyAccounts); // Récupérer les comptes de l'utilisateur authentifié
module.exports = router;
