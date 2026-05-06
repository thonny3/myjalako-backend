const Transferts = require('../models/transfertsModel');

const TransfertsController = {
  compteVersObjectif: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: 'Non autorisé' });
    const { id_compte, id_objectif, montant } = req.body;
    if (!id_compte || !id_objectif || !montant) return res.status(400).json({ message: 'Champs requis manquants' });
    Transferts.transferCompteToObjectif(id_user, { id_compte, id_objectif, montant }, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(result);
    });
  },

  objectifVersCompte: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: 'Non autorisé' });
    const { id_compte, id_objectif, montant } = req.body;
    if (!id_compte || !id_objectif || !montant) return res.status(400).json({ message: 'Champs requis manquants' });
    Transferts.transferObjectifToCompte(id_user, { id_compte, id_objectif, montant }, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(result);
    });
  }
  ,
  compteVersCompte: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: 'Non autorisé' });
    const { id_compte_source, id_compte_cible, montant } = req.body;
    if (!id_compte_source || !id_compte_cible || !montant) return res.status(400).json({ message: 'Champs requis manquants' });
    Transferts.transferCompteToCompte(id_user, { id_compte_source, id_compte_cible, montant }, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(result);
    });
  }
  ,
  historique: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: 'Non autorisé' });
    const { limit = 50 } = req.query;
    const sql = `
      SELECT 
        h.*, 
        CASE 
          WHEN h.type = 'compte_to_objectif' THEN cs.nom
          WHEN h.type = 'objectif_to_compte' THEN os.nom
          WHEN h.type = 'compte_to_compte' THEN cs.nom
          ELSE NULL
        END AS source_nom,
        CASE 
          WHEN h.type = 'compte_to_objectif' THEN oc.nom
          WHEN h.type = 'objectif_to_compte' THEN cc.nom
          WHEN h.type = 'compte_to_compte' THEN cc.nom
          ELSE NULL
        END AS cible_nom,
        u.prenom AS user_prenom,
        u.nom AS user_nom,
        u.email AS user_email,
        u.image AS user_image
      FROM TransfertsHistorique h
      LEFT JOIN Comptes cs ON cs.id_compte = h.id_compte_source
      LEFT JOIN Comptes cc ON cc.id_compte = h.id_compte_cible
      LEFT JOIN Objectifs os ON os.id_objectif = h.id_objectif_source
      LEFT JOIN Objectifs oc ON oc.id_objectif = h.id_objectif_cible
      LEFT JOIN Users u ON u.id_user = h.id_user
      WHERE h.id_user = ?
      ORDER BY h.date_transfert DESC
      LIMIT ?
    `;
    req.app.get('db').query(sql, [id_user, parseInt(limit)], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(rows);
    });
  }
};

module.exports = TransfertsController;


