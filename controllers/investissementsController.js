const Investissements = require('../models/investissementsModel');

const asNumber = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

module.exports = {
  list: (req, res) => {
    const id_user = req.user?.id_user;
    Investissements.listByUser(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  },
  create: (req, res) => {
    const id_user = req.user?.id_user;
    const payload = req.body || {};
    const data = {
      id_user,
      nom: String(payload.nom || '').trim(),
      type: payload.type || 'immobilier',
      projet: payload.projet || null,
      date_achat: payload.date_achat,
      montant_investi: asNumber(payload.montant_investi),
      valeur_actuelle: asNumber(payload.valeur_actuelle),
      duree_mois: asNumber(payload.duree_mois),
      taux_prevu: asNumber(payload.taux_prevu)
    };
    if (!data.nom || !data.date_achat || data.montant_investi === null) return res.status(400).json({ error: 'Champs requis manquants' });
    Investissements.create(data, (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id_investissement: r.insertId });
    });
  },
  update: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    const payload = req.body || {};
    const data = {
      id_user,
      nom: String(payload.nom || '').trim(),
      type: payload.type || 'immobilier',
      projet: payload.projet || null,
      date_achat: payload.date_achat,
      montant_investi: asNumber(payload.montant_investi),
      valeur_actuelle: asNumber(payload.valeur_actuelle),
      duree_mois: asNumber(payload.duree_mois),
      taux_prevu: asNumber(payload.taux_prevu)
    };
    Investissements.update(id_investissement, data, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  },
  remove: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    Investissements.remove(id_investissement, id_user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  },
  listRevenus: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    Investissements.listRevenus(id_investissement, id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  },
  addRevenu: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    const p = req.body || {};
    const data = {
      id_user,
      montant: asNumber(p.montant),
      date_revenu: p.date,
      type: p.type || null,
      note: p.note || null,
      id_compte: asNumber(p.id_compte)
    };
    if (!data.montant || !data.date_revenu) return res.status(400).json({ error: 'Champs revenus requis' });
    Investissements.addRevenu(id_investissement, data, (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      // créditer le compte
      try {
        if (data.id_compte) {
          const sql = `UPDATE Comptes SET solde = solde + ? WHERE id_compte = ? AND id_user = ?`;
          const db = require('../config/db');
          db.query(sql, [data.montant, data.id_compte, id_user], () => {});
        }
      } catch (_e) {}
      res.json({ success: true, id: r.insertId });
    });
  },
  listDepenses: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    Investissements.listDepenses(id_investissement, id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  },
  addDepense: (req, res) => {
    const id_user = req.user?.id_user;
    const { id_investissement } = req.params;
    const p = req.body || {};
    const data = {
      id_user,
      montant: asNumber(p.montant),
      date_depense: p.date,
      type: p.type || null,
      note: p.note || null,
      id_compte: asNumber(p.id_compte)
    };
    if (!data.montant || !data.date_depense) return res.status(400).json({ error: 'Champs dépenses requis' });
    Investissements.addDepense(id_investissement, data, (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      // débiter le compte
      try {
        if (data.id_compte) {
          const sql = `UPDATE Comptes SET solde = solde - ? WHERE id_compte = ? AND id_user = ?`;
          const db = require('../config/db');
          db.query(sql, [data.montant, data.id_compte, id_user], () => {});
        }
      } catch (_e) {}
      res.json({ success: true, id: r.insertId });
    });
  }
};


