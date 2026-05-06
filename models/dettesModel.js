const db = require('../config/db');

const Dettes = {
  getAllByUser: (id_user, callback) => {
    const sql = 'SELECT * FROM Dettes WHERE id_user = ? ORDER BY date_debut DESC';
    db.query(sql, [id_user], callback);
  },

  create: (data, callback) => {
    const sql = `INSERT INTO Dettes (id_user, nom, montant_initial, montant_restant, taux_interet, date_debut, date_fin_prevue, paiement_mensuel, creancier, sens, statut, type, id_compte)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      data.id_user,
      data.nom,
      data.montant_initial,
      data.montant_restant ?? data.montant_initial,
      data.taux_interet ?? 0,
      data.date_debut,
      data.date_fin_prevue,
      data.paiement_mensuel ?? 0,
      data.creancier || '',
      data.sens || 'autre',
      data.statut || 'en cours',
      data.type || 'personne',
      data.id_compte || null
    ];
    db.query(sql, params, callback);
  },

  update: (id_dette, data, callback) => {
    const hasRestant = data.montant_restant !== undefined && data.montant_restant !== null;
    const sql = `UPDATE Dettes SET nom=?, montant_initial=?, ${hasRestant ? 'montant_restant=?,' : ''} taux_interet=?, date_debut=?, date_fin_prevue=?, paiement_mensuel=?, creancier=?, sens=?, statut=?, type=?, id_compte=?
                 WHERE id_dette=? AND id_user=?`;
    const baseParams = [
      data.nom,
      data.montant_initial,
    ];
    const afterRestant = [
      data.taux_interet ?? 0,
      data.date_debut,
      data.date_fin_prevue,
      data.paiement_mensuel ?? 0,
      data.creancier || '',
      data.sens || 'autre',
      data.statut || 'en cours',
      data.type || 'personne',
      data.id_compte || null,
      id_dette,
      data.id_user
    ];
    const params = hasRestant ? [...baseParams, data.montant_restant, ...afterRestant] : [...baseParams, ...afterRestant];
    db.query(sql, params, callback);
  },

  delete: (id_dette, id_user, callback) => {
    const sql = `DELETE FROM Dettes WHERE id_dette=? AND id_user=?`;
    db.query(sql, [id_dette, id_user], callback);
  }
};

module.exports = Dettes;


