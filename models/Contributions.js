const db = require('../config/db');

const Contributions = {
  // Récupérer toutes les contributions d'un utilisateur
  getAll: (id_objectif, callback) => {
    const sql = `
      SELECT c.*, o.nom AS objectif_nom, co.nom AS compte_nom
      FROM Contributions c
      LEFT JOIN Objectifs o ON c.id_objectif = o.id_objectif
      LEFT JOIN Comptes co ON c.id_compte = co.id_compte
      WHERE c.id_objectif = ?
      ORDER BY c.date_contribution DESC
    `;
    db.query(sql, [id_objectif], callback);
  },

  // Ajouter une contribution
  add: (data, callback) => {
  const { id_user, id_objectif, montant, id_compte } = data;

  // Vérifier le plafond avant d'insérer la contribution
  const sqlSelectObj = `SELECT id_objectif, montant_objectif, montant_actuel FROM Objectifs WHERE id_objectif = ?`;
  db.query(sqlSelectObj, [id_objectif], (selErr, rows) => {
    if (selErr) return callback(selErr);
    if (!rows || rows.length === 0) return callback(new Error('Objectif introuvable'));

    const objectif = rows[0];
    const newMontantActuel = parseFloat(objectif.montant_actuel || 0) + parseFloat(montant || 0);
    const montantObjectif = parseFloat(objectif.montant_objectif || 0);

    if (newMontantActuel > montantObjectif) {
      const err = new Error('Le montant dépasse le montant de l\'objectif');
      err.status = 400;
      return callback(err);
    }

    const sqlInsert = `
      INSERT INTO Contributions (id_objectif, id_user, montant, date_contribution, id_compte)
      VALUES (?, ?, ?, CURRENT_DATE, ?)
    `;
    db.query(sqlInsert, [id_objectif, id_user, montant, id_compte], (err, result) => {
      if (err) return callback(err);

      // Mise à jour de l'objectif + recalcul du pourcentage et statut
      const sqlUpdateObjectif = `
        UPDATE Objectifs
        SET 
          montant_actuel = montant_actuel + ?,
          pourcentage = ROUND(LEAST(100, ((montant_actuel + ?) / montant_objectif) * 100)),
          statut = CASE 
            WHEN (montant_actuel + ?) >= montant_objectif THEN 'Atteint'
            WHEN CURRENT_DATE > date_limite THEN 'Retard'
            ELSE 'En cours'
          END
        WHERE id_objectif = ?
      `;
      db.query(sqlUpdateObjectif, [montant, montant, montant, id_objectif], (err2) => {
        if (err2) return callback(err2);

        // Mise à jour du compte
        if (id_compte) {
          const sqlUpdateCompte = `
            UPDATE Comptes
            SET solde = solde - ?
            WHERE id_compte = ?
          `;
          db.query(sqlUpdateCompte, [montant, id_compte], (err3) => {
            if (err3) return callback(err3);
            callback(null, { id_contribution: result.insertId, ...data, date_contribution: new Date() });
          });
        } else {
          callback(null, { id_contribution: result.insertId, ...data, date_contribution: new Date() });
        }
      });
    });
  });
}

};

module.exports = Contributions;
