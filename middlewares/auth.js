const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if(!token) return res.status(401).json({ message: 'Token manquant' });

    try {
        const decoded = jwt.verify(token, 'SECRET_KEY');
        req.user = decoded; // id_user disponible
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user?.id_user) return res.status(401).json({ message: 'Non authentifié' });
    const db = require('../config/db');
    db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [req.user.id_user], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Erreur serveur' });
        const role = rows?.[0]?.role;
        if (role !== 'admin') return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
        next();
    });
};

// Middleware pour empêcher l'admin d'accéder aux fonctionnalités de partage de comptes
const preventAdminShare = (req, res, next) => {
    if (!req.user?.id_user) return res.status(401).json({ message: 'Non authentifié' });
    const db = require('../config/db');
    db.query('SELECT role FROM Users WHERE id_user = ? LIMIT 1', [req.user.id_user], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Erreur serveur' });
        const role = rows?.[0]?.role;
        if (role === 'admin') {
            return res.status(403).json({ 
                message: 'Les administrateurs ne peuvent pas partager de comptes utilisateurs pour des raisons de confidentialité' 
            });
        }
        next();
    });
};

module.exports = auth;
module.exports.isAdmin = isAdmin;
module.exports.preventAdminShare = preventAdminShare;
