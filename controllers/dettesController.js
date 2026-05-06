const Dettes = require('../models/dettesModel');
const Remboursements = require('../models/remboursementsModel');
const db = require('../config/db');

const DettesController = {
  list: (req, res) => {
    const id_user = req.user?.id_user || req.params.id_user;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    Dettes.getAllByUser(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      try {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const enriched = (rows || []).map((d) => {
          const out = { ...d };
          const dateFin = d?.date_fin_prevue ? new Date(d.date_fin_prevue) : null;
          const montantInitial = Number(d?.montant_initial || 0);
          const montantRestant = Number(d?.montant_restant || 0);
          if (montantRestant <= 0) {
            out.statut = 'terminé';
          } else if (dateFin && !isNaN(dateFin) && dateFin < startOfToday) {
            out.statut = 'en retard';
          }
          return out;
        });
        res.json(enriched);
      } catch (_e) {
        res.json(rows);
      }
    });
  },

  create: (req, res) => {
    const payload = req.body || {};
    payload.id_user = req.user?.id_user || payload.id_user;
    if (!payload.id_user || !payload.nom) return res.status(400).json({ error: 'id_user et nom requis' });
    try {
      const taux = Number(payload.taux_interet || 0) / 100;
      const montantInitial = Number(payload.montant_initial || 0);
      if (!(payload.montant_restant > 0) && montantInitial > 0 && taux > 0) {
        payload.montant_restant = Number((montantInitial * (1 + taux)).toFixed(2));
      }
    } catch (_e) {}
    Dettes.create(payload, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      const id_compte = payload.id_compte ? Number(payload.id_compte) : null;
      const montant = Number(payload.montant_initial || 0);
      const sens = (payload.sens || 'autre');
      if (!id_compte || !(montant > 0)) {
        return res.json({ id_dette: result.insertId });
      }
      const sign = sens === 'moi' ? -1 : 1; // moi: sortie; autre: entrée
      db.query('UPDATE Comptes SET solde = solde + ? WHERE id_compte = ? AND id_user = ?', [sign * montant, id_compte, payload.id_user], (eUpd) => {
        if (eUpd) return res.status(500).json({ error: eUpd.message || eUpd });
        res.json({ id_dette: result.insertId });
      });
    });
  },

  update: (req, res) => {
    const id_dette = req.params.id_dette;
    const payload = req.body || {};
    payload.id_user = req.user?.id_user || payload.id_user;
    if (!id_dette || !payload.id_user) return res.status(400).json({ error: 'id_dette et id_user requis' });
    Dettes.update(id_dette, payload, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  },

  remove: (req, res) => {
    const id_dette = req.params.id_dette;
    const id_user = req.user?.id_user || req.body?.id_user;
    if (!id_dette || !id_user) return res.status(400).json({ error: 'id_dette et id_user requis' });
    Dettes.delete(id_dette, id_user, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  },

  listPayments: (req, res) => {
    const id_user = req.user?.id_user || req.params.id_user;
    const id_dette = req.params.id_dette || null;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    Remboursements.getByDette(id_user, id_dette, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(rows);
    });
  },

  addPayment: (req, res) => {
    const payload = req.body || {};
    payload.id_user = req.user?.id_user || payload.id_user;
    if (!payload.id_user || !payload.id_dette || !payload.montant || !payload.date_paiement || !payload.id_compte) {
      return res.status(400).json({ error: 'id_user, id_dette, montant, date_paiement, id_compte requis' });
    }

    const montant = Number(payload.montant);
    if (!(montant > 0)) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // 1) Charger la dette pour vérifier le restant, le sens et le plafond (sans appliquer d'intérêts au remboursement)
    db.query('SELECT montant_restant, sens, montant_initial, date_debut, taux_interet FROM Dettes WHERE id_dette=? AND id_user=? LIMIT 1', [payload.id_dette, payload.id_user], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Dette introuvable' });
      const restant = Number(rows[0].montant_restant || 0);
      const sens = rows[0].sens || 'autre';
      const plafond = Number(rows[0].montant_initial || 0);
      // Ne pas ajouter d'intérêts au moment du remboursement; on se base sur le restant stocké
      if (montant > restant) {
        return res.status(400).json({ error: 'Montant supérieur au restant de la dette' });
      }

      // 2) Vérifier le compte: pour sens 'autre' (Entrée initiale → remboursement = sortie), on doit vérifier le solde suffisant
      const checkCompte = (cb) => {
        db.query('SELECT solde FROM Comptes WHERE id_compte=? AND id_user=? LIMIT 1', [payload.id_compte, payload.id_user], (e2, r2) => {
          if (e2) return cb(e2);
          if (!r2 || r2.length === 0) return cb({ status: 404, message: 'Compte introuvable' });
          const solde = Number(r2[0].solde || 0);
          // sens === 'autre' => remboursement = sortie => vérifier le solde
          if (sens === 'autre' && solde < montant) return cb({ status: 400, message: 'Solde insuffisant' });
          cb(null, true);
        });
      };

      checkCompte((eCompte) => {
        if (eCompte) {
          const status = eCompte.status || 500;
          return res.status(status).json({ error: eCompte.message || 'Erreur compte' });
        }

        // 3) Créer remboursement
        Remboursements.create(payload, (errCreate, result) => {
          if (errCreate) return res.status(500).json({ error: errCreate.message || errCreate });

          // 4) Mettre à jour la dette: on diminue le restant directement
          const updateDetteSql = `UPDATE Dettes
            SET montant_restant = GREATEST(montant_restant - ?, 0),
                statut = CASE WHEN (montant_restant - ?) <= 0 THEN 'terminé' ELSE statut END
            WHERE id_dette=? AND id_user=?`;
          db.query(updateDetteSql, [montant, montant, payload.id_dette, payload.id_user], (eUpd) => {
            if (eUpd) return res.status(500).json({ error: eUpd.message || eUpd });
            // 5) Optionnel: mouvement sur le compte (si fourni) selon sens
            const maybeDebit = () => {
              const sign = sens === 'moi' ? 1 : -1; // remboursement: moi => entrée (crédit), autre => sortie (débit)
              db.query('UPDATE Comptes SET solde = solde + ? WHERE id_compte=? AND id_user=?', [sign * montant, payload.id_compte, payload.id_user], (eDeb) => {
                if (eDeb) return res.status(500).json({ error: eDeb.message || eDeb });
                res.json({ id_remboursement: result.insertId });
              });
            };
            maybeDebit();
          });
        });
      });
    });
  }
};

module.exports = DettesController;


