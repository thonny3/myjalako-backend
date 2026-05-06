const db = require('../config/db');

const Investissements = {
  listByUser: (id_user, cb) => {
    const sql = `
      SELECT i.*,
             COALESCE(r.total_revenus, 0) AS total_revenus,
             COALESCE(d.total_depenses, 0) AS total_depenses
      FROM Investissements i
      LEFT JOIN (
        SELECT id_investissement, SUM(montant) AS total_revenus
        FROM Investissements_Revenus
        WHERE id_user = ?
        GROUP BY id_investissement
      ) r ON r.id_investissement = i.id_investissement
      LEFT JOIN (
        SELECT id_investissement, SUM(montant) AS total_depenses
        FROM Investissements_Depenses
        WHERE id_user = ?
        GROUP BY id_investissement
      ) d ON d.id_investissement = i.id_investissement
      WHERE i.id_user = ?
      ORDER BY i.created_at DESC`;
    db.query(sql, [id_user, id_user, id_user], cb);
  },
  create: (data, cb) => {
    const sql = `INSERT INTO Investissements (id_user, nom, type, projet, date_achat, montant_investi, valeur_actuelle, duree_mois, taux_prevu)
                 VALUES (?,?,?,?,?,?,?,?,?)`;
    const params = [
      data.id_user,
      data.nom,
      data.type || 'immobilier',
      data.projet || null,
      data.date_achat,
      data.montant_investi,
      data.valeur_actuelle ?? null,
      data.duree_mois ?? null,
      data.taux_prevu ?? null
    ];
    db.query(sql, params, cb);
  },
  update: (id_investissement, data, cb) => {
    const sql = `UPDATE Investissements SET nom=?, type=?, projet=?, date_achat=?, montant_investi=?, valeur_actuelle=?, duree_mois=?, taux_prevu=?
                 WHERE id_investissement=? AND id_user=?`;
    const params = [
      data.nom,
      data.type || 'immobilier',
      data.projet || null,
      data.date_achat,
      data.montant_investi,
      data.valeur_actuelle ?? null,
      data.duree_mois ?? null,
      data.taux_prevu ?? null,
      id_investissement,
      data.id_user
    ];
    db.query(sql, params, cb);
  },
  remove: (id_investissement, id_user, cb) => {
    db.query(`DELETE FROM Investissements WHERE id_investissement=? AND id_user=?`, [id_investissement, id_user], cb);
  },

  // revenus
  listRevenus: (id_investissement, id_user, cb) => {
    db.query(`SELECT * FROM Investissements_Revenus WHERE id_investissement=? AND id_user=? ORDER BY date_revenu DESC`, [id_investissement, id_user], cb);
  },
  addRevenu: (id_investissement, data, cb) => {
    const sql = `INSERT INTO Investissements_Revenus (id_investissement, id_user, montant, date_revenu, type, note, id_compte)
                 VALUES (?,?,?,?,?,?,?)`;
    const params = [
      id_investissement,
      data.id_user,
      data.montant,
      data.date_revenu,
      data.type || null,
      data.note || null,
      data.id_compte || null
    ];
    db.query(sql, params, cb);
  },

  // depenses
  listDepenses: (id_investissement, id_user, cb) => {
    db.query(`SELECT * FROM Investissements_Depenses WHERE id_investissement=? AND id_user=? ORDER BY date_depense DESC`, [id_investissement, id_user], cb);
  },
  addDepense: (id_investissement, data, cb) => {
    const sql = `INSERT INTO Investissements_Depenses (id_investissement, id_user, montant, date_depense, type, note, id_compte)
                 VALUES (?,?,?,?,?,?,?)`;
    const params = [
      id_investissement,
      data.id_user,
      data.montant,
      data.date_depense,
      data.type || null,
      data.note || null,
      data.id_compte || null
    ];
    db.query(sql, params, cb);
  }
};

module.exports = Investissements;


