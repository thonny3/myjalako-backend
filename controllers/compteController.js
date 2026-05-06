const Compte = require('../models/compteModel');
const ComptePartage  = require('../models/comptesPartagesModel');

// --- Controller Comptes ---
const compteController = {
    // Créer un compte
    create: (req, res) => {
        console.log('Body reçu:', req.body);
        console.log('Headers:', req.headers);
        
        if (!req.body) {
            return res.status(400).json({ message: "Body de la requête manquant" });
        }
        
        const { nom, solde, type } = req.body;
        const id_user = req.user.id_user; // récupéré depuis le middleware
        
        if (!nom || !type) {
            return res.status(400).json({ message: "Champs requis: nom, type" });
        }

        Compte.create({ id_user, nom, solde: solde || 0.00, type }, (err, result) => {
            if (err) {
                console.error('Erreur création compte:', err);
                return res.status(500).json({ error: err });
            }
            const accountId = result?.insertId;
            res.status(201).json({ message: "Compte créé avec succès", id: accountId });

            if (!accountId) {
                console.error('Compte créé mais id_compte introuvable, partage propriétaire ignoré');
                return;
            }

            ComptePartage.create(
                { id_compte: accountId, id_user, role: "proprietaire" },
                (shareErr) => {
                    if (shareErr) {
                        console.error('Erreur création partage propriétaire:', shareErr);
                    }
                }
            );
        });
    },

    // Récupérer tous les comptes
    getAll: (req, res) => {
        Compte.getAll((err, rows) => {
            if (err) return res.status(500).json({ error: err });
            res.json(rows);
        });
    },

    // Récupérer un compte par ID
    getById: (req, res) => {
        Compte.findById(req.params.id_compte, (err, row) => {
            if (err) return res.status(500).json({ error: err });
            if (!row || row.length === 0) return res.status(404).json({ message: "Compte non trouvé" });
            res.json(row[0]);
        });
    },

    // Récupérer tous les comptes d’un utilisateur
    getByUser: (req, res) => {
        Compte.findByUserId(req.params.id_user, (err, rows) => {
            if (err) return res.status(500).json({ error: err });
            res.json(rows);
        });
    },

    // Mettre à jour un compte
    update: (req, res) => {
        const { nom, solde, type } = req.body;
        Compte.update(req.params.id_compte, { nom, solde, type }, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Compte mis à jour avec succès" });
        });
    },

    // Supprimer un compte
    delete: (req, res) => {
        Compte.delete(req.params.id_compte, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Compte supprimé avec succès" });
        });
    },
    // Récupérer tous les comptes de l'utilisateur authentifié
    getMyAccounts: (req, res) => {
        const id_user = req.user.id_user;
        console.log(`Récupération des comptes pour l'utilisateur ID: ${id_user}`);

        Compte.findByUserId(id_user, (err, rows) => {
            if (err) {
                console.error('Erreur lors de la récupération des comptes:', err);
                return res.status(500).json({ error: err });
            }
            res.json(rows);
        });
    },

};

module.exports = compteController;
