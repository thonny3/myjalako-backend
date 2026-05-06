const db = require('../config/db');

const Budgets = {
getAll: (id_user, callback) => {
  db.query(
    `
    SELECT 
      b.id_budget,
      b.id_categorie_depense,
      c.nom AS categorie,
      b.mois,
      b.montant_max,
      b.montant_restant,
      IFNULL(SUM(d.montant), 0) AS montant_depense,
      CASE 
        WHEN b.montant_max > 0 THEN ROUND(IFNULL(SUM(d.montant), 0) / b.montant_max * 100, 2)
        ELSE 0
      END AS pourcentage_utilise
    FROM Budgets b
    LEFT JOIN categories_depenses c ON b.id_categorie_depense = c.id
    LEFT JOIN Depenses d 
      ON b.id_categorie_depense = d.id_categorie_depense
      AND b.id_user = d.id_user
      AND LEFT(b.mois, 7) = DATE_FORMAT(d.date_depense, '%Y-%m')
    WHERE b.id_user = ?
    GROUP BY b.id_budget, c.nom, b.mois, b.montant_max, b.montant_restant
    ORDER BY b.mois ASC, c.nom ASC
    `,
    [id_user],
    callback
  );
}


,

  add: (data, callback) => {
    const { id_user, id_categorie_depense, mois, montant_max } = data;
    // Défaut défensif coté modèle: si non fourni, montant_restant = montant_max
    const montant_restant = Number.isFinite(Number(data.montant_restant))
      ? Number(data.montant_restant)
      : Number(montant_max);
    db.query(
      'INSERT INTO Budgets (id_user, id_categorie_depense, mois, montant_max, montant_restant) VALUES (?, ?, ?, ?, ?)',
      [id_user, id_categorie_depense, mois, montant_max, montant_restant],
      callback
    );
  },

  update: (id_budget, data, callback) => {
    const { montant_max, montant_restant } = data;
    db.query(
      'UPDATE Budgets SET montant_max=?, montant_restant=? WHERE id_budget=?',
      [montant_max, montant_restant, id_budget],
      callback
    );
  },

  delete: (id_budget, callback) => {
    db.query('DELETE FROM Budgets WHERE id_budget=?', [id_budget], callback);
  }
};

module.exports = Budgets;
