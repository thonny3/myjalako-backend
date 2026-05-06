const db = require('../config/db');

const Depenses = {
  getAll: (id_user, callback) => {
    db.query(
      `SELECT d.*,
              c.nom AS categorie_nom,
              co.nom AS compte_nom,
              u.prenom AS user_prenom,
              u.nom AS user_nom,
              u.email AS user_email,
              u.image AS user_image
       FROM Depenses d
       LEFT JOIN categories_depenses c ON d.id_categorie_depense = c.id
       LEFT JOIN Comptes co ON d.id_compte = co.id_compte
       LEFT JOIN Users u ON d.id_user = u.id_user
       WHERE d.id_user = ?
          OR d.id_compte IN (
            SELECT cp.id_compte FROM Comptes_partages cp WHERE cp.id_user = ?
          )
       ORDER BY d.date_depense DESC`,
      [id_user, id_user],
      callback
    );
  },

  getByAccountForUser: (id_user, id_compte, callback) => {
    db.query(
      `SELECT d.*,
              c.nom AS categorie_nom,
              co.nom AS compte_nom,
              u.prenom AS user_prenom,
              u.nom AS user_nom,
              u.email AS user_email,
              u.image AS user_image
       FROM Depenses d
       LEFT JOIN categories_depenses c ON d.id_categorie_depense = c.id
       LEFT JOIN Comptes co ON d.id_compte = co.id_compte
       LEFT JOIN Users u ON d.id_user = u.id_user
       WHERE d.id_compte = ?
         AND (
           co.id_user = ?
           OR EXISTS (
             SELECT 1 FROM Comptes_partages cp
             WHERE cp.id_compte = d.id_compte AND cp.id_user = ?
           )
         )
       ORDER BY d.date_depense DESC`,
      [id_compte, id_user, id_user],
      callback
    );
  },

add: (data, callback) => {
  const { id_user, montant, date_depense, description, id_categorie_depense, id_compte, use_objectif, id_objectif } = data;

  const date = new Date(date_depense);
  const monthStr = date.toISOString().slice(0, 7);

  db.beginTransaction((txErr) => {
    if (txErr) return callback({ success: false, message: "Erreur début transaction", error: txErr });

    const insertSql = `
      INSERT INTO Depenses (id_user, montant, date_depense, description, id_categorie_depense, id_compte)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(insertSql, [id_user, montant, date_depense, description, id_categorie_depense, id_compte], (err, result) => {
      if (err) {
        return db.rollback(() => callback({ success: false, message: "Erreur insertion dépense", error: err }));
      }

      const id_depense = result.insertId;

      // Lire le solde du compte
      db.query('SELECT solde FROM Comptes WHERE id_compte = ? FOR UPDATE', [id_compte], (accErr, accRows) => {
        if (accErr || accRows.length === 0) {
          return db.rollback(() => callback({ success: false, message: "Compte introuvable", error: accErr }));
        }
        const soldeActuel = Number(accRows[0].solde || 0);
        const montantDepuisCompte = Math.min(soldeActuel, Number(montant));
        const manque = Number(montant) - montantDepuisCompte;

        const updateCompteSql = `UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?`;
        db.query(updateCompteSql, [montantDepuisCompte, id_compte], (ucErr) => {
          if (ucErr) {
            return db.rollback(() => callback({ success: false, message: "Erreur mise à jour du compte", error: ucErr }));
          }

          const proceedBudgetUpdate = () => {
            const updateBudgetSql = `
              UPDATE Budgets
              SET montant_restant = montant_restant - ?
              WHERE id_user = ? 
                AND id_categorie_depense = ? 
                AND LEFT(mois, 7) = ?
            `;
            db.query(updateBudgetSql, [montant, id_user, id_categorie_depense, monthStr], (err3, resultBudget) => {
              if (err3) return db.rollback(() => callback({ success: false, message: "Erreur mise à jour budget", error: err3 }));

              const message = resultBudget.affectedRows === 0
                ? "Dépense ajoutée, mais aucun budget existant pour ce mois et cette catégorie."
                : "Dépense ajoutée et budget mis à jour.";

              db.commit((commitErr) => {
                if (commitErr) return db.rollback(() => callback({ success: false, message: "Erreur commit", error: commitErr }));
                return callback(null, { success: true, message, depense: { id_depense, ...data } });
              });
            });
          };

          if (manque > 0) {
            if (!use_objectif || !id_objectif) {
              return db.rollback(() => callback({ success: false, message: "Solde insuffisant et aucun objectif utilisé", error: null }));
            }

            // Vérifier et débiter l'objectif
            db.query('SELECT montant_actuel FROM Objectifs WHERE id_objectif = ? AND id_user = ? FOR UPDATE', [id_objectif, id_user], (objErr, objRows) => {
              if (objErr || objRows.length === 0) {
                return db.rollback(() => callback({ success: false, message: "Objectif introuvable", error: objErr }));
              }
              const montantActuel = Number(objRows[0].montant_actuel || 0);
              if (montantActuel < manque) {
                return db.rollback(() => callback({ success: false, message: "Fonds objectif insuffisants", error: null }));
              }

              db.query('UPDATE Objectifs SET montant_actuel = montant_actuel - ? WHERE id_objectif = ?', [manque, id_objectif], (uoErr) => {
                if (uoErr) {
                  return db.rollback(() => callback({ success: false, message: "Erreur débit objectif", error: uoErr }));
                }
                // Optionnel: garder une trace du transfert interne
                // INSERT INTO TransfertsObjectif (id_user, id_objectif, id_compte, montant, date) VALUES (...)
                proceedBudgetUpdate();
              });
            });
          } else {
            proceedBudgetUpdate();
          }
        });
      });
    });
  });
}



,


  update: (id_depense, data, callback) => {
    const { montant, date_depense, description, id_categorie_depense, id_compte } = data;
    
    // 1️⃣ Récupérer l'ancienne dépense pour connaître le montant et le compte précédents
    db.query('SELECT montant AS old_montant, id_compte AS old_id_compte FROM Depenses WHERE id_depense = ?', [id_depense], (err, rows) => {
      if (err) return callback(err);
      if (!rows || rows.length === 0) return callback(new Error('Dépense introuvable'));
      
      const old_montant = rows[0].old_montant;
      const old_id_compte = rows[0].old_id_compte;
      const montantDiff = montant - old_montant;
      const compteChanged = old_id_compte !== id_compte;
      
      // 2️⃣ Mettre à jour la dépense
      db.query(
        'UPDATE Depenses SET montant=?, date_depense=?, description=?, id_categorie_depense=?, id_compte=? WHERE id_depense=?',
        [montant, date_depense, description, id_categorie_depense, id_compte, id_depense],
        (errUpdate) => {
          if (errUpdate) return callback(errUpdate);
          
          // 3️⃣ Gérer la mise à jour des soldes des comptes
          if (compteChanged) {
            // Rembourser l'ancien compte et débit du nouveau
            db.query('UPDATE Comptes SET solde = solde + ? WHERE id_compte = ?', [old_montant, old_id_compte], (err1) => {
              if (err1) return callback(err1);
              db.query('UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?', [montant, id_compte], (err2) => {
                if (err2) return callback(err2);
                callback(null, { message: 'Dépense et soldes mis à jour' });
              });
            });
          } else if (montantDiff !== 0) {
            // Ajuster seulement la différence si le compte est le même
            db.query('UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?', [montantDiff, id_compte], (err3) => {
              if (err3) return callback(err3);
              callback(null, { message: 'Dépense et solde mis à jour' });
            });
          } else {
            // Rien n'a changé
            callback(null, { message: 'Dépense mise à jour sans changement de solde' });
          }
        }
      );
    });
  },

  delete: (id_depense, callback) => {
    db.beginTransaction((txErr) => {
      if (txErr) return callback({ success: false, message: 'Erreur début transaction', error: txErr });

      // 1) Lire la dépense à supprimer
      const selectSql = `SELECT id_user, id_compte, id_categorie_depense, montant, date_depense FROM Depenses WHERE id_depense = ? FOR UPDATE`;
      db.query(selectSql, [id_depense], (selErr, rows) => {
        if (selErr) {
          return db.rollback(() => callback({ success: false, message: 'Erreur lecture dépense', error: selErr }));
        }
        if (rows.length === 0) {
          return db.rollback(() => callback({ success: false, message: 'Dépense introuvable', error: null }));
        }

        const { id_user, id_compte, id_categorie_depense, montant, date_depense } = rows[0];

        // 2) Rembourser le compte
        const refundSql = `UPDATE Comptes SET solde = solde + ? WHERE id_compte = ?`;
        db.query(refundSql, [Number(montant) || 0, id_compte], (refErr) => {
          if (refErr) {
            return db.rollback(() => callback({ success: false, message: 'Erreur remboursement compte', error: refErr }));
          }

          // 3) Rétablir le budget du mois/catégorie (si existe)
          const monthStr = new Date(date_depense).toISOString().slice(0, 7);
          const budgetSql = `
            UPDATE Budgets
            SET montant_restant = montant_restant + ?
            WHERE id_user = ?
              AND id_categorie_depense = ?
              AND LEFT(mois, 7) = ?
          `;
          db.query(budgetSql, [Number(montant) || 0, id_user, id_categorie_depense, monthStr], (budErr) => {
            if (budErr) {
              return db.rollback(() => callback({ success: false, message: 'Erreur mise à jour budget', error: budErr }));
            }

            // 4) Supprimer la dépense
            db.query('DELETE FROM Depenses WHERE id_depense = ?', [id_depense], (delErr) => {
              if (delErr) {
                return db.rollback(() => callback({ success: false, message: 'Erreur suppression dépense', error: delErr }));
              }

              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => callback({ success: false, message: 'Erreur commit', error: commitErr }));
                }
                return callback(null, { success: true, message: 'Dépense supprimée, compte remboursé et budget rétabli.' });
              });
            });
          });
        });
      });
    });
  }
};

module.exports = Depenses;
