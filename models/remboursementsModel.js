const db = require('../config/db');

const Remboursements = {
  getByDette: (id_user, id_dette, callback) => {
    const sql = `SELECT * FROM Remboursements WHERE id_user=? AND (? IS NULL OR id_dette=?) ORDER BY date_paiement DESC`;
    db.query(sql, [id_user, id_dette || null, id_dette || null], callback);
  },

  create: (data, callback) => {
    const sql = `INSERT INTO Remboursements (id_dette, id_user, montant, date_paiement, id_compte)
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [
      data.id_dette,
      data.id_user,
      data.montant,
      data.date_paiement,
      data.id_compte || null
    ];
    db.query(sql, params, callback);
  }
};

module.exports = Remboursements;


