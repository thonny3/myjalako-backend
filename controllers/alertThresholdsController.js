const AlertThresholds = require('../models/alertThresholdsModel');
const Compte = require('../models/compteModel');
const User = require('../models/userModel');
const { sendEmail } = require('../services/emailService');
const Alertes = require('../models/alertesModel');

const VALID_DOMAINS = new Set(['solde', 'comptes', 'depenses', 'budget', 'objectifs']);

const AlertThresholdsController = {
  list: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    AlertThresholds.getAllByUser(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(rows);
    });
  },

  getOne: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    const { domain } = req.params;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    if (!domain || !VALID_DOMAINS.has(domain)) return res.status(400).json({ error: 'domain invalide' });
    AlertThresholds.getByUserAndDomain(id_user, domain, (err, row) => {
      if (err) return res.status(500).json({ error: err.message || err });
      if (!row) return res.status(404).json({ error: 'Aucun seuil trouvé' });
      res.json(row);
    });
  },

  upsert: (req, res) => {
    const payload = req.body || {};
    const id_user = payload.id_user || req.user?.id_user;
    const { domain, value, info } = payload;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    if (!domain || !VALID_DOMAINS.has(domain)) return res.status(400).json({ error: 'domain invalide' });
    if (typeof value !== 'number') return res.status(400).json({ error: 'value doit être un nombre' });
    AlertThresholds.upsert({ id_user, domain, value, info }, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      if (domain !== 'comptes') {
        return res.json({ success: true, notified: false });
      }
      // Vérifier chaque compte individuellement (solde <= seuil)
      Compte.findByUserId(id_user, async (cErr, comptes) => {
        if (cErr) {
          return res.json({ success: true, notified: false, checkError: cErr.message || String(cErr) });
        }
        const list = Array.isArray(comptes) ? comptes : [];
        const thresholdValue = Number(value);
        console.log('[AlertThresholds] Vérification comptes:', { id_user, thresholdValue, comptes: list.length });
        list.forEach((c) => {
          const soldeNum = Number(c.solde || 0)
          const matched = soldeNum <= thresholdValue
          console.log('[AlertThresholds] Compte check', { id_compte: c.id_compte, nom: c.nom, solde: soldeNum, '<=': thresholdValue, matched })
        })
        const matches = list.filter((c) => Number(c.solde || 0) <= thresholdValue);
        console.log('[AlertThresholds] Comptes sous seuil:', matches.map(c => ({ id_compte: c.id_compte, nom: c.nom, solde: Number(c.solde || 0) })))
        if (matches.length === 0) {
          return res.json({ success: true, notified: false, accountsChecked: list.length });
        }
        // Création d'une alerte par compte correspondant
        const createAlert = (a) => new Promise((resolve) => {
          Alertes.create(a, () => resolve());
        });
        const now = new Date();
        const alertPromises = matches.map((c) => createAlert({
          id_user,
          type_alerte: 'Alerte seuil comptes',
          message: `Le compte \"${c.nom || c.type || c.id_compte}\" (solde ${Number(c.solde || 0)}) est inférieur ou égal au seuil (${thresholdValue}).`,
          date_declenchement: now
        }));
        try {
          await Promise.all(alertPromises);
          console.log('[AlertThresholds] Alertes créées:', matches.length)
          try {
            const io = req.app.get('io');
            if (io) {
              // Récupérer la dernière minute créée pour renvoyer leurs id (simple stratégie)
              const db = req.app.get('db');
              db.query('SELECT id_alerte, type_alerte, message, date_declenchement FROM Alertes WHERE id_user = ? AND date_declenchement >= (NOW() - INTERVAL 1 MINUTE)', [id_user], (_selErr, rows) => {
                const recent = Array.isArray(rows) ? rows : [];
                recent.forEach((r) => {
                  io.to(`user:${id_user}`).emit('alert:new', { id_alerte: r.id_alerte, id_user, type_alerte: r.type_alerte, message: r.message, date_declenchement: r.date_declenchement, lue: 0 });
                })
              })
              console.log('[AlertThresholds] Événements socket émis pour', matches.length, 'alertes')
            }
          } catch (_e) {}
          // Email récapitulatif (best-effort)
          try {
            User.findById(id_user, async (uErr, user) => {
              if (!uErr && user?.email) {
                const to = user.email;
                const subject = 'Alerte seuil comptes';
                const lines = matches.map((c) => `- ${c.nom || c.type || c.id_compte}: ${Number(c.solde || 0)} ≤ ${thresholdValue}`).join('\n');
                const text = `Les comptes suivants sont sous le seuil:\n${lines}`;
                try { await sendEmail({ to, subject, text }); console.log('[AlertThresholds] Email récapitulatif envoyé à', to) } catch (_mailErr) { console.log('[AlertThresholds] Email non envoyé:', _mailErr?.message) }
              }
              return res.json({ success: true, notified: true, matchedAccounts: matches.length });
            });
          } catch (_e) {
            return res.json({ success: true, notified: true, matchedAccounts: matches.length });
          }
        } catch (_e) {
          return res.json({ success: true, notified: true, matchedAccounts: matches.length });
        }
      });
    });
  },

  remove: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    const { domain } = req.params;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    if (!domain || !VALID_DOMAINS.has(domain)) return res.status(400).json({ error: 'domain invalide' });
    AlertThresholds.deleteByUserAndDomain(id_user, domain, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  }
};

module.exports = AlertThresholdsController;


