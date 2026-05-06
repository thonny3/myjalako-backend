const db = require('../config/db');

const Categorie = {
    // --- CATEGORIES DE REVENUS ---
    allRevenue: (callback) => {
        db.query('SELECT * FROM categories_revenus ORDER BY id ASC', callback);
    },

    addrevenue: (nom, callback) => {
        db.query('INSERT INTO categories_revenus (nom) VALUES (?)', [nom], callback);
    },

    deleteRevenue: (id, callback) => {
        db.query('DELETE FROM categories_revenus WHERE id = ?', [id], callback);
    },

    updateRevenue: (id, nom, callback) => {
        db.query('UPDATE categories_revenus SET nom = ? WHERE id = ?', [nom, id], callback);
    },

    // --- CATEGORIES DE DEPENSES ---
    allDepenses: (callback) => {
        db.query('SELECT * FROM categories_depenses ORDER BY id ASC', callback);
    },

    addDepenses: (nom, callback) => {
        db.query('INSERT INTO categories_depenses (nom) VALUES (?)', [nom], callback);
    },

    deleteDepenses: (id, callback) => {

        db.query('DELETE FROM categories_depenses WHERE id = ?', [id], callback);
    },

    updateDepenses: (id, nom, callback) => {
        db.query('UPDATE categories_depenses SET nom = ? WHERE id = ?', [nom, id], callback);
    }
}

exports = module.exports = Categorie;