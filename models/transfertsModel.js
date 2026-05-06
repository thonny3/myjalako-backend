const db = require('../config/db');

const Transferts = {
  // Historique
  logTransfer: (payload, callback) => {
    const { id_user, type, id_compte_source, id_compte_cible, id_objectif_source, id_objectif_cible, montant } = payload;
    const sql = `INSERT INTO TransfertsHistorique (id_user, type, id_compte_source, id_compte_cible, id_objectif_source, id_objectif_cible, montant, date_transfert)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
    const vals = [id_user, type, id_compte_source || null, id_compte_cible || null, id_objectif_source || null, id_objectif_cible || null, montant];
    return db.query(sql, vals, callback);
  },

  transferCompteToObjectif: (id_user, { id_compte, id_objectif, montant }, callback) => {
    db.beginTransaction((err) => {
      if (err) return callback(err);

      db.query('SELECT solde FROM Comptes WHERE id_compte = ? AND id_user = ? FOR UPDATE', [id_compte, id_user], (e1, rowsC) => {
        if (e1 || rowsC.length === 0) return db.rollback(() => callback(e1 || new Error('Compte introuvable')));

        db.query('SELECT montant_actuel FROM Objectifs WHERE id_objectif = ? AND id_user = ? FOR UPDATE', [id_objectif, id_user], (e2, rowsO) => {
          if (e2 || rowsO.length === 0) return db.rollback(() => callback(e2 || new Error('Objectif introuvable')));

          if (Number(rowsC[0].solde) < Number(montant)) return db.rollback(() => callback(new Error('Solde compte insuffisant')));
          db.query('UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?', [montant, id_compte], (e3) => {
            if (e3) return db.rollback(() => callback(e3));
            db.query('UPDATE Objectifs SET montant_actuel = montant_actuel + ? WHERE id_objectif = ?', [montant, id_objectif], (e4) => {
              if (e4) return db.rollback(() => callback(e4));
              Transferts.logTransfer({ id_user, type: 'compte_to_objectif', id_compte_source: id_compte, id_objectif_cible: id_objectif, montant }, (eLog) => {
                if (eLog) return db.rollback(() => callback(eLog));
                db.commit((e5) => {
                  if (e5) return db.rollback(() => callback(e5));
                  callback(null, { success: true });
                });
              });
            });
          });
        });
      });
    });
  },

  transferObjectifToCompte: (id_user, { id_compte, id_objectif, montant }, callback) => {
    db.beginTransaction((err) => {
      if (err) return callback(err);

      db.query('SELECT montant_actuel FROM Objectifs WHERE id_objectif = ? AND id_user = ? FOR UPDATE', [id_objectif, id_user], (e1, rowsO) => {
        if (e1 || rowsO.length === 0) return db.rollback(() => callback(e1 || new Error('Objectif introuvable')));

        db.query('SELECT solde FROM Comptes WHERE id_compte = ? AND id_user = ? FOR UPDATE', [id_compte, id_user], (e2, rowsC) => {
          if (e2 || rowsC.length === 0) return db.rollback(() => callback(e2 || new Error('Compte introuvable')));

          if (Number(rowsO[0].montant_actuel) < Number(montant)) return db.rollback(() => callback(new Error('Solde objectif insuffisant')));
          db.query('UPDATE Objectifs SET montant_actuel = montant_actuel - ? WHERE id_objectif = ?', [montant, id_objectif], (e3) => {
            if (e3) return db.rollback(() => callback(e3));
            db.query('UPDATE Comptes SET solde = solde + ? WHERE id_compte = ?', [montant, id_compte], (e4) => {
              if (e4) return db.rollback(() => callback(e4));
              Transferts.logTransfer({ id_user, type: 'objectif_to_compte', id_objectif_source: id_objectif, id_compte_cible: id_compte, montant }, (eLog) => {
                if (eLog) return db.rollback(() => callback(eLog));
                db.commit((e5) => {
                  if (e5) return db.rollback(() => callback(e5));
                  callback(null, { success: true });
                });
              });
            });
          });
        });
      });
    });
  },

  transferCompteToCompte: (id_user, { id_compte_source, id_compte_cible, montant }, callback) => {
    db.beginTransaction((err) => {
      if (err) return callback(err);
      // Authorize if user owns the account or is contributor/proprietaire via Comptes_partages
      const sqlSource = `
        SELECT c.solde
        FROM Comptes c
        LEFT JOIN Comptes_partages cp ON cp.id_compte = c.id_compte AND cp.id_user = ? AND cp.role IN ('contributeur','proprietaire')
        WHERE c.id_compte = ? AND (c.id_user = ? OR cp.id IS NOT NULL)
        FOR UPDATE`;
      db.query(sqlSource, [id_user, id_compte_source, id_user], (e1, rowsS) => {
        if (e1 || rowsS.length === 0) return db.rollback(() => callback(e1 || new Error('Compte source introuvable')));
        if (Number(rowsS[0].solde) <= 0 || Number(rowsS[0].solde) < Number(montant)) return db.rollback(() => callback(new Error('Solde source insuffisant')));
        const sqlTarget = `
          SELECT c.id_compte
          FROM Comptes c
          LEFT JOIN Comptes_partages cp ON cp.id_compte = c.id_compte AND cp.id_user = ? AND cp.role IN ('contributeur','proprietaire')
          WHERE c.id_compte = ? AND (c.id_user = ? OR cp.id IS NOT NULL)
          FOR UPDATE`;
        db.query(sqlTarget, [id_user, id_compte_cible, id_user], (e2, rowsT) => {
          if (e2 || rowsT.length === 0) return db.rollback(() => callback(e2 || new Error('Compte cible introuvable')));
          db.query('UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?', [montant, id_compte_source], (e3) => {
            if (e3) return db.rollback(() => callback(e3));
            db.query('UPDATE Comptes SET solde = solde + ? WHERE id_compte = ?', [montant, id_compte_cible], (e4) => {
              if (e4) return db.rollback(() => callback(e4));
              Transferts.logTransfer({ id_user, type: 'compte_to_compte', id_compte_source, id_compte_cible, montant }, (eLog) => {
                if (eLog) return db.rollback(() => callback(eLog));
                db.commit((e5) => {
                  if (e5) return db.rollback(() => callback(e5));
                  callback(null, { success: true });
                });
              });
            });
          });
        });
      });
    });
  }
};

module.exports = Transferts;


