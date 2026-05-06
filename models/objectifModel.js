const db = require('../config/db');

const Objectifs = {
  getAll: (id_user, callback) => {
    db.query('SELECT * FROM Objectifs WHERE id_user=? ORDER BY id_objectif DESC', [id_user], callback);
  },

  add: (data, callback) => {
    const { id_user, nom, montant_objectif, date_limite, montant_actuel, statut, pourcentage, icone, couleur } = data;
    db.query(
      'INSERT INTO Objectifs (id_user, nom, montant_objectif, date_limite, montant_actuel, statut, pourcentage, icone, couleur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id_user, nom, montant_objectif, date_limite, montant_actuel, statut, pourcentage, icone || null, couleur || null],
      callback
    );
  },

  update: (id_objectif, data, callback) => {
    const { nom, montant_objectif, date_limite, montant_actuel, icone, couleur } = data;
    const sql = `
      UPDATE Objectifs 
      SET 
        nom=?,
        montant_objectif=?,
        date_limite=?,
        montant_actuel=?,
        icone=?,
        couleur=?,
        pourcentage = ROUND(LEAST(100, (CASE WHEN ? > 0 THEN (? / ?) * 100 ELSE 0 END))),
        statut = CASE 
          WHEN ? >= ? THEN 'Atteint'
          WHEN CURRENT_DATE > ? THEN 'Retard'
          ELSE 'En cours'
        END
      WHERE id_objectif=?
    `
    const params = [
      nom,
      montant_objectif,
      date_limite,
      montant_actuel,
      icone || null,
      couleur || null,
      montant_objectif,
      montant_actuel,
      montant_objectif,
      montant_actuel,
      montant_objectif,
      date_limite,
      id_objectif,
    ]
    db.query(sql, params, callback)
  },

  delete: (id_objectif, callback) => {
    db.query('DELETE FROM Objectifs WHERE id_objectif=?', [id_objectif], callback);
  }
};

module.exports = Objectifs;
