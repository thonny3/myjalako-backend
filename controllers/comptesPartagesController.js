const ComptesPartages = require('../models/comptesPartagesModel');
const User = require('../models/userModel');
const db = require('../config/db');

const comptesPartagesController = {

    // Ajouter un partage (seul le propriétaire)
    create: (req, res) => {
        const { id_compte, email, role } = req.body;
        const currentUserId = req.user?.id_user;
        
        if (!id_compte || !email || !role) {
            return res.status(400).json({ message: "Champs requis: id_compte, email, role" });
        }

        if (!currentUserId) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Vérifier que l'utilisateur actuel n'est pas admin
        db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [currentUserId], (err, userRows) => {
            if (err) return res.status(500).json({ error: err });
            const currentUserRole = userRows?.[0]?.role;
            
            if (currentUserRole === 'admin') {
                return res.status(403).json({ 
                    message: 'Les administrateurs ne peuvent pas partager de comptes utilisateurs pour des raisons de confidentialité' 
                });
            }

            User.findByEmail(email, (err, users) => {
                if (err) return res.status(500).json({ error: err });
                if (users.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });

                const user = users[0];

                // Empêcher l'ajout d'un admin comme utilisateur partagé
                if (user.role === 'admin') {
                    return res.status(403).json({ 
                        message: 'Les comptes administrateurs ne peuvent pas être partagés pour des raisons de confidentialité' 
                    });
                }

                // Vérifier que l'utilisateur actuel est propriétaire du compte
                db.query('SELECT id_user FROM Comptes WHERE id_compte = ?', [id_compte], (err, compteRows) => {
                    if (err) return res.status(500).json({ error: err });
                    if (compteRows.length === 0) return res.status(404).json({ message: 'Compte non trouvé' });
                    
                    const compteOwnerId = compteRows[0].id_user;
                    if (compteOwnerId !== currentUserId) {
                        return res.status(403).json({ 
                            message: 'Seul le propriétaire du compte peut le partager' 
                        });
                    }

                    // Vérifier si l'utilisateur a déjà un partage sur ce compte
                    ComptesPartages.findByCompteId(id_compte, (err, rows) => {
                        if (err) return res.status(500).json({ error: err });
                        const exists = rows.find(r => r.id_user === user.id_user);
                        if (exists) {
                            return res.status(400).json({ message: "Cet utilisateur a déjà un partage sur ce compte" });
                        }

                        // Créer le partage
                        ComptesPartages.create({ id_compte, id_user: user.id_user, role }, (err, result) => {
                            if (err) return res.status(500).json({ error: err });
                            res.status(201).json({ message: "Partage créé avec succès", id: result.insertId });
                        });
                    });
                });
            });
        });
    }
    ,

    // Récupérer utilisateurs ayant accès à un compte
    getByCompte: (req, res) => {
        const currentUserId = req.user?.id_user;
        
        if (!currentUserId) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Vérifier que l'utilisateur actuel n'est pas admin
        db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [currentUserId], (err, userRows) => {
            if (err) return res.status(500).json({ error: err });
            const currentUserRole = userRows?.[0]?.role;
            
            if (currentUserRole === 'admin') {
                return res.status(403).json({ 
                    message: 'Les administrateurs ne peuvent pas accéder aux comptes partagés des utilisateurs pour des raisons de confidentialité' 
                });
            }

            // Vérifier que l'utilisateur a accès à ce compte
            db.query('SELECT id_user FROM Comptes WHERE id_compte = ?', [req.params.id_compte], (err, compteRows) => {
                if (err) return res.status(500).json({ error: err });
                if (compteRows.length === 0) return res.status(404).json({ message: 'Compte non trouvé' });
                
                const compteOwnerId = compteRows[0].id_user;
                
                // Vérifier si l'utilisateur est propriétaire ou a un partage
                if (compteOwnerId !== currentUserId) {
                    db.query('SELECT id FROM Comptes_partages WHERE id_compte = ? AND id_user = ?', 
                        [req.params.id_compte, currentUserId], (err, partageRows) => {
                        if (err) return res.status(500).json({ error: err });
                        if (partageRows.length === 0) {
                            return res.status(403).json({ 
                                message: 'Vous n\'avez pas accès à ce compte' 
                            });
                        }
                        
                        // L'utilisateur a accès, continuer
                        ComptesPartages.findByCompteId(req.params.id_compte, (err, rows) => {
                            if (err) return res.status(500).json({ error: err });
                            res.json(rows);
                        });
                    });
                } else {
                    // L'utilisateur est propriétaire
                    ComptesPartages.findByCompteId(req.params.id_compte, (err, rows) => {
                        if (err) return res.status(500).json({ error: err });
                        res.json(rows);
                    });
                }
            });
        });
    },

    // Récupérer comptes auxquels un utilisateur a accès
    getByUser: (req, res) => {
        const currentUserId = req.user?.id_user;
        const requestedUserId = parseInt(req.params.id_user);
        
        if (!currentUserId) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Vérifier que l'utilisateur actuel n'est pas admin
        db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [currentUserId], (err, userRows) => {
            if (err) return res.status(500).json({ error: err });
            const currentUserRole = userRows?.[0]?.role;
            
            if (currentUserRole === 'admin') {
                return res.status(403).json({ 
                    message: 'Les administrateurs ne peuvent pas accéder aux comptes partagés des utilisateurs pour des raisons de confidentialité' 
                });
            }

            // Un utilisateur ne peut voir que ses propres comptes partagés
            if (currentUserId !== requestedUserId) {
                return res.status(403).json({ 
                    message: 'Vous ne pouvez accéder qu\'à vos propres comptes partagés' 
                });
            }

            ComptesPartages.findByUserId(req.params.id_user, (err, rows) => {
                if (err) return res.status(500).json({ error: err });
                res.json(rows);
            });
        });
    },

    // Supprimer un partage (seul le propriétaire)
    delete: (req, res) => {
        const currentUserId = req.user?.id_user;
        
        if (!currentUserId) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Vérifier que l'utilisateur actuel n'est pas admin
        db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [currentUserId], (err, userRows) => {
            if (err) return res.status(500).json({ error: err });
            const currentUserRole = userRows?.[0]?.role;
            
            if (currentUserRole === 'admin') {
                return res.status(403).json({ 
                    message: 'Les administrateurs ne peuvent pas gérer les partages de comptes utilisateurs pour des raisons de confidentialité' 
                });
            }

            ComptesPartages.delete(req.params.id, (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ message: "Partage supprimé avec succès" });
            });
        });
    },

    // Modifier le rôle d'un utilisateur sur un compte partagé (seul le propriétaire)
    updateRole: (req, res) => {
        const role = req.body.role;
        const id = req.params.id;
        const currentUserId = req.user?.id_user;
        
        if (!role) {
            return res.status(400).json({ message: "Champs requis:  role" });
        }

        if (!currentUserId) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Vérifier que l'utilisateur actuel n'est pas admin
        db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [currentUserId], (err, userRows) => {
            if (err) return res.status(500).json({ error: err });
            const currentUserRole = userRows?.[0]?.role;
            
            if (currentUserRole === 'admin') {
                return res.status(403).json({ 
                    message: 'Les administrateurs ne peuvent pas gérer les partages de comptes utilisateurs pour des raisons de confidentialité' 
                });
            }

            ComptesPartages.updateRole(id, role, (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ message: "Rôle modifié avec succès" });
            });
        });
    }

};

module.exports = comptesPartagesController;
