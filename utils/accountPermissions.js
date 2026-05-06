const db = require('../config/db');

/**
 * Vérifier les permissions d'un utilisateur sur un compte
 * @param {number} id_user - ID de l'utilisateur
 * @param {number} id_compte - ID du compte
 * @param {string} requiredPermission - Permission requise: 'read', 'write', 'owner'
 * @returns {Promise<{hasAccess: boolean, role: string|null, isOwner: boolean}>}
 */
const checkAccountPermission = (id_user, id_compte, requiredPermission = 'read') => {
    return new Promise((resolve, reject) => {
        // Vérifier si l'utilisateur est propriétaire du compte
        db.query('SELECT id_user FROM Comptes WHERE id_compte = ?', [id_compte], (err, compteRows) => {
            if (err) return reject(err);
            if (compteRows.length === 0) {
                return resolve({ hasAccess: false, role: null, isOwner: false });
            }

            const compteOwnerId = compteRows[0].id_user;
            const isOwner = compteOwnerId === id_user;

            // Si l'utilisateur est propriétaire, il a tous les droits
            if (isOwner) {
                return resolve({ hasAccess: true, role: 'proprietaire', isOwner: true });
            }

            // Vérifier si l'utilisateur a un partage sur ce compte
            db.query(
                'SELECT role FROM Comptes_partages WHERE id_compte = ? AND id_user = ?',
                [id_compte, id_user],
                (err, partageRows) => {
                    if (err) return reject(err);
                    if (partageRows.length === 0) {
                        return resolve({ hasAccess: false, role: null, isOwner: false });
                    }

                    const role = partageRows[0].role?.toLowerCase().trim();
                    
                    // Vérifier les permissions selon le rôle
                    let hasAccess = false;
                    
                    switch (requiredPermission) {
                        case 'read':
                            // Lecteur, contributeur et propriétaire peuvent lire
                            hasAccess = ['lecteur', 'contributeur', 'proprietaire'].includes(role);
                            break;
                        case 'write':
                            // Seuls contributeur et propriétaire peuvent écrire
                            hasAccess = ['contributeur', 'proprietaire'].includes(role);
                            break;
                        case 'owner':
                            // Seul le propriétaire peut gérer
                            hasAccess = role === 'proprietaire';
                            break;
                        default:
                            hasAccess = false;
                    }

                    resolve({ hasAccess, role, isOwner: false });
                }
            );
        });
    });
};

/**
 * Middleware pour vérifier les permissions d'accès à un compte
 * @param {string} permission - Permission requise: 'read', 'write', 'owner'
 */
const verifyAccountPermission = (permission = 'read') => {
    return async (req, res, next) => {
        const id_user = req.user?.id_user;
        if (!id_user) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Récupérer l'ID du compte depuis le body, query ou params
        const id_compte = req.body?.id_compte || req.query?.id_compte || req.params?.id_compte;

        if (!id_compte) {
            return res.status(400).json({ message: 'ID du compte requis' });
        }

        try {
            const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, permission);
            
            if (!hasAccess) {
                const messages = {
                    read: 'Vous n\'avez pas accès à ce compte',
                    write: 'Vous n\'avez pas la permission d\'effectuer des transactions sur ce compte. Seuls les contributeurs et propriétaires peuvent modifier les transactions.',
                    owner: 'Seul le propriétaire peut effectuer cette action'
                };
                return res.status(403).json({ 
                    message: messages[permission] || 'Accès refusé',
                    role: role || 'aucun'
                });
            }

            // Ajouter les informations de permission à la requête
            req.accountPermission = { role, id_compte };
            next();
        } catch (error) {
            console.error('Erreur lors de la vérification des permissions:', error);
            return res.status(500).json({ message: 'Erreur serveur lors de la vérification des permissions' });
        }
    };
};

module.exports = {
    checkAccountPermission,
    verifyAccountPermission
};




