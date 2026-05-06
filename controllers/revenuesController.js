const Revenues = require('../models/revenuesModel');
const { checkAccountPermission } = require('../utils/accountPermissions');

const RevenuesController = {
   
    // --- REVENUS ---
    getAll: (req, res) => {
        const id_user = req.user?.id_user;
        if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    const { id_compte } = req.query;
    if (id_compte) {
        return Revenues.getByAccountForUser(id_user, id_compte, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }

    Revenues.getAll(id_user, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
    },

    add: async (req, res) => {
        const id_user = req.user?.id_user;
        if (!id_user) return res.status(401).json({ message: "Non autorisé" });

        const id_compte = req.body?.id_compte;
        
        // Si un compte est spécifié, vérifier les permissions
        if (id_compte) {
            try {
                const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
                if (!hasAccess) {
                    return res.status(403).json({ 
                        message: 'Vous n\'avez pas la permission d\'ajouter des transactions sur ce compte. Seuls les contributeurs et propriétaires peuvent effectuer des transactions.',
                        role: role || 'aucun'
                    });
                }
            } catch (error) {
                console.error('Erreur vérification permissions:', error);
                return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
            }
        }

        const data = { ...req.body, id_user };
        Revenues.add(data, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Revenu ajouté", id: result.insertId });
        });
    },

    update: async (req, res) => {
        const { id } = req.params;
        const id_user = req.user?.id_user;
        if (!id_user) return res.status(401).json({ message: "Non autorisé" });
        
        console.log('📝 UPDATE REVENU - ID:', id);
        console.log('📝 UPDATE REVENU - DATA:', req.body);
        console.log('📝 UPDATE REVENU - USER:', id_user);
        
        // Récupérer le revenu pour vérifier les permissions
        Revenues.getById(id, async (err, revenue) => {
            if (err) {
                console.error('❌ Erreur getById:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!revenue || revenue.length === 0) {
                console.error('❌ Revenu introuvable:', id);
                return res.status(404).json({ message: "Revenu introuvable" });
            }
            
            console.log('✅ Revenu trouvé:', revenue[0]);
            
            const revenueData = revenue[0];
            const id_compte = revenueData.id_compte;
            
            // Si le revenu appartient à l'utilisateur, il peut le modifier
            if (revenueData.id_user === id_user) {
                Revenues.update(id, req.body, (err) => {
                    if (err) {
                        console.error('❌ Erreur update model:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    console.log('✅ Revenu mis à jour avec succès');
                    res.json({ message: "Revenu mis à jour", data: req.body });
                });
                return;
            }
            
            // Si le revenu est sur un compte partagé, vérifier les permissions
            if (id_compte) {
                try {
                    const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
                    if (!hasAccess) {
                        return res.status(403).json({ 
                            message: 'Vous n\'avez pas la permission de modifier cette transaction. Seuls les contributeurs et propriétaires peuvent modifier les transactions.',
                            role: role || 'aucun'
                        });
                    }
                    
                    // L'utilisateur a la permission, continuer avec la mise à jour
                    Revenues.update(id, req.body, (err) => {
                        if (err) {
                            console.error('❌ Erreur update model:', err);
                            return res.status(500).json({ error: err.message });
                        }
                        console.log('✅ Revenu mis à jour avec succès');
                        res.json({ message: "Revenu mis à jour", data: req.body });
                    });
                } catch (error) {
                    console.error('Erreur vérification permissions:', error);
                    return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
                }
            } else {
                return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier ce revenu" });
            }
        });
    },

    delete: async (req, res) => {
        const { id } = req.params;
        const id_user = req.user?.id_user;
        if (!id_user) return res.status(401).json({ message: "Non autorisé" });
        
        // Récupérer le revenu pour vérifier les permissions
        Revenues.getById(id, async (err, revenue) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!revenue || revenue.length === 0) {
                return res.status(404).json({ message: "Revenu introuvable" });
            }
            
            const revenueData = revenue[0];
            const id_compte = revenueData.id_compte;
            
            // Si le revenu appartient à l'utilisateur, il peut le supprimer
            if (revenueData.id_user === id_user) {
                Revenues.delete(id, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "Revenu supprimé" });
                });
                return;
            }
            
            // Si le revenu est sur un compte partagé, vérifier les permissions
            if (id_compte) {
                try {
                    const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
                    if (!hasAccess) {
                        return res.status(403).json({ 
                            message: 'Vous n\'avez pas la permission de supprimer cette transaction. Seuls les contributeurs et propriétaires peuvent supprimer les transactions.',
                            role: role || 'aucun'
                        });
                    }
                    
                    Revenues.delete(id, (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: "Revenu supprimé" });
                    });
                } catch (error) {
                    console.error('Erreur vérification permissions:', error);
                    return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
                }
            } else {
                return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer ce revenu" });
            }
        });
    },

    getById: (req, res) => {
        const { id } = req.params;
        Revenues.getById(id, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
        });
    }
};

module.exports = RevenuesController;
