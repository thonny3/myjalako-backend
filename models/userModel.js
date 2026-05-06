const db = require('../config/db');

const User = {
    create: (data, callback) => {
        const sql = 'INSERT INTO Users (nom, prenom, email, mot_de_passe, devise, date_creation) VALUES (?, ?, ?, ?, ?, NOW())';
        db.query(sql, [data.nom, data.prenom, data.email, data.mot_de_passe, data.devise], callback);
    },

    findByEmail: (email, callback) => {
        db.query('SELECT * FROM Users WHERE email = ?', [email], callback);
    },

    searchByEmail: (emailQuery, callback) => {
        // Recherche partielle par email (pour autocomplétion)
        // Retourne id_user, nom, prenom, email (sans mot de passe)
        const sql = `
            SELECT id_user, nom, prenom, email, devise, image, role, actif
            FROM Users 
            WHERE email LIKE ? AND actif = 1
            ORDER BY email
            LIMIT 10
        `;
        db.query(sql, [`%${emailQuery}%`], callback);
    },

    findById: (id_user, callback) => {
        db.query('SELECT * FROM Users WHERE id_user = ?', [id_user], callback);
    },

    getAll: (callback) => {
        db.query('SELECT * FROM Users', callback);
    },

    update: (id_user, data, callback) => {
        const sql = 'UPDATE Users SET nom=?, prenom=?, email=?, devise=?, image=?, actif=COALESCE(?, actif) WHERE id_user=?';
        db.query(sql, [data.nom, data.prenom, data.email, data.devise, data.image, data.actif, id_user], callback);
    },

    updatePassword: (id_user, hashedPassword, callback) => {
        const sql = 'UPDATE Users SET mot_de_passe=? WHERE id_user=?';
        db.query(sql, [hashedPassword, id_user], callback);
    },

    delete: (id_user, callback) => {
        db.query('DELETE FROM Users WHERE id_user = ?', [id_user], callback);
    },

    // Password reset helpers
    createPasswordReset: (id_user, token, expiresAt, callback) => {
        const sql = 'INSERT INTO PasswordResets (id_user, token, expires_at) VALUES (?, ?, ?)';
        db.query(sql, [id_user, token, expiresAt], callback);
    },
    findPasswordResetByToken: (token, callback) => {
        const sql = 'SELECT * FROM PasswordResets WHERE token = ? LIMIT 1';
        db.query(sql, [token], callback);
    },
    markPasswordResetUsed: (id, callback) => {
        const sql = 'UPDATE PasswordResets SET used = TRUE WHERE id = ?';
        db.query(sql, [id], callback);
    }
};

module.exports = User;
