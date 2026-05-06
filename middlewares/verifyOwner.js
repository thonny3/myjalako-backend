const db = require('../config/db');

const verifyOwnerRole = (req, res, next) => {
    const partageId = req.params.id;
    const userId = req.user?.id_user;

    if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

    db.query('SELECT id_compte FROM Comptes_partages WHERE id = ?', [partageId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        if (results.length === 0) return res.status(404).json({ error: 'Partage introuvable' });

        const id_compte = results[0].id_compte;
        console.log(id_compte);
        
        db.query(
            'SELECT role FROM Comptes_partages WHERE id_compte = ? AND id_user = ?',
            [id_compte, userId],
            (err, results2) => {
                if (err) return res.status(500).json({ error: 'Erreur serveur' });
                if (results2.length === 0) return res.status(403).json({ error: "Pas de rôle trouvé" });

                // Normalisation
                const role = results2[0].role.toLowerCase().trim();
                if (role !== 'proprietaire') {
                    return res.status(403).json({ error: "Seul le propriétaire peut effectuer cette action" });
                }

                next();
            }
        );
    });
};





module.exports = verifyOwnerRole;
