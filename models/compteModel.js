const db = require('../config/db');

const Compte = {
    // Créer un compte
    create: (data, callback) => {
        const sql = 'INSERT INTO Comptes (id_user, nom, solde, type) VALUES (?, ?, ?, ?)';
        db.query(sql, [data.id_user, data.nom, data.solde, data.type], callback);
    },

    // Trouver les comptes d’un utilisateur
    findByUserId: (id_user, callback) => {
        const sql = 'SELECT * FROM Comptes WHERE id_user = ?';
        db.query(sql, [id_user], callback);
    },

    // Trouver un compte par son id
    findById: (id_compte, callback) => {
        db.query('SELECT * FROM Comptes WHERE id_compte = ?', [id_compte], callback);
    },

    // Récupérer tous les comptes
    getAll: (callback) => {
        db.query('SELECT * FROM Comptes', callback);
    },

    // Mettre à jour un compte
    update: (id_compte, data, callback) => {
        const sql = 'UPDATE Comptes SET nom=?, solde=?, type=? WHERE id_compte=?';
        db.query(sql, [data.nom, data.solde, data.type, id_compte], callback);
    },


    // Supprimer un compte
    delete: (id_compte, callback) => {
        db.query('DELETE FROM Comptes WHERE id_compte = ?', [id_compte], callback);
    },

    // Récupérer les comptes partagés avec les infos utilisateur + compte
    getSharedAccounts: (id_compte, callback) => {
        db.query(' SELECT u.email, cp.role,c.nom AS compte_nom, c.solde, c.type FROM Comptes_partages cp INNER JOIN Users u ON u.id_user = cp.id_user INNER JOIN Comptes c ON c.id_compte = cp.id_compte  WHERE cp.id_compte = ?', [id_compte], callback);
    }



};

module.exports = Compte;
