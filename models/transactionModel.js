const db = require('../config/db');

const Transactions = {
    // Récupérer toutes les transactions d'un utilisateur
 getAllTransaction: (id_user, filterUserId, callback) => {
  const sql = `
    SELECT 
      t.*,
      u.prenom AS user_prenom,
      u.nom AS user_nom,
      u.email AS user_email,
      u.image AS user_image,
      CASE 
        WHEN t.type = 'revenu' THEN c.nom
        WHEN t.type = 'depense' THEN cd.nom
        WHEN t.type = 'remboursement_dette' THEN 'Remboursement'
      END AS categorie_nom,
      cp.nom AS compte_nom,
      o.nom AS objectif_nom,
      (SELECT MAX(date_transaction) 
       FROM (
         SELECT date_revenu AS date_transaction FROM Revenus WHERE id_user = ?
         UNION ALL
         SELECT date_depense AS date_transaction FROM Depenses WHERE id_user = ?
         UNION ALL
         SELECT date_contribution AS date_transaction FROM Contributions WHERE id_user = ?
         UNION ALL
         SELECT date_paiement AS date_transaction FROM Remboursements WHERE id_user = ?
       ) AS all_dates
      ) AS derniere_date
    FROM (
      SELECT 
        id_revenu AS id_transaction, 
        Revenus.id_user, 
        Revenus.montant, 
        date_revenu AS date_transaction,
        source AS description, 
        id_categorie_revenu AS id_categorie, 
        id_compte,
        NULL AS id_objectif,
        'revenu' AS type
      FROM Revenus
      WHERE id_user = ? OR id_compte IN (SELECT id_compte FROM Comptes_partages WHERE id_user = ?)

      UNION ALL

      SELECT 
        id_depense AS id_transaction, 
        d.id_user, 
        d.montant, 
        date_depense AS date_transaction,
        description, 
        id_categorie_depense AS id_categorie, 
        d.id_compte,
        NULL AS id_objectif,
        CASE WHEN cd.nom = 'Abonnements' THEN 'abonnement' ELSE 'depense' END AS type
      FROM Depenses d
      LEFT JOIN categories_depenses cd ON d.id_categorie_depense = cd.id
      WHERE d.id_user = ? OR d.id_compte IN (SELECT id_compte FROM Comptes_partages WHERE id_user = ?)

      UNION ALL

      SELECT
        id_contribution AS id_transaction,
        Contributions.id_user,
        Contributions.montant,
        date_contribution AS date_transaction,
        'Contribution' AS description,
        NULL AS id_categorie,
        Contributions.id_compte,
        id_objectif,
        'contribution' AS type
      FROM Contributions
      WHERE id_user = ? OR id_compte IN (SELECT id_compte FROM Comptes_partages WHERE id_user = ?)

      UNION ALL

      SELECT
        id_remboursement AS id_transaction,
        r.id_user,
        -r.montant AS montant,
        r.date_paiement AS date_transaction,
        COALESCE(d.nom, '') AS description,
        NULL AS id_categorie,
        r.id_compte,
        NULL AS id_objectif,
        'remboursement_dette' AS type
      FROM Remboursements r
      LEFT JOIN Dettes d ON r.id_dette = d.id_dette
      WHERE r.id_user = ? OR r.id_compte IN (SELECT id_compte FROM Comptes_partages WHERE id_user = ?)
    ) AS t
    LEFT JOIN categories_revenus c 
      ON t.type = 'revenu' AND t.id_categorie = c.id
    LEFT JOIN categories_depenses cd 
      ON (t.type = 'depense' OR t.type = 'abonnement') AND t.id_categorie = cd.id
    LEFT JOIN Comptes cp 
      ON t.id_compte = cp.id_compte
    LEFT JOIN Objectifs o
      ON t.type = 'contribution' AND t.id_objectif = o.id_objectif
    LEFT JOIN Users u
      ON u.id_user = t.id_user
    WHERE (? IS NULL OR t.id_user = ?)
    ORDER BY t.date_transaction DESC
  `;

  db.query(sql, [
    // all_dates subquery
    id_user, id_user, id_user, id_user,
    // main UNION blocks with shared inclusion
    id_user, id_user,
    id_user, id_user,
    id_user, id_user,
    id_user, id_user,
    // optional user filter
    (filterUserId ?? null), (filterUserId ?? null)
  ], callback);
}


};

module.exports = Transactions;
