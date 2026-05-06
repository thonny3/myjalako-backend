const Alertes = require('../models/alertesModel');

const AlertesController = {
  list: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    // Purge des alertes de plus de 7 jours avant listing
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    Alertes.deleteOlderThan(cutoff, () => {
      Alertes.getAllByUser(id_user, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message || err });
        res.json(rows);
      });
    });
  },

  listUnread: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    Alertes.getUnreadByUser(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json(rows);
    });
  },

  create: (req, res) => {
    const payload = req.body || {};
    if (!payload.id_user || !payload.type_alerte) {
      return res.status(400).json({ error: 'id_user et type_alerte requis' });
    }
    Alertes.create(payload, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      try {
        const io = req.app.get('io');
        if (io) io.to(`user:${payload.id_user}`).emit('alert:new', { id_alerte: result.insertId, ...payload });
      } catch (_e) {}
      res.json({ id_alerte: result.insertId });
    });
  },

  markAsRead: (req, res) => {
    const { id_alerte } = req.params;
    if (!id_alerte) return res.status(400).json({ error: 'id_alerte requis' });
    Alertes.markAsRead(id_alerte, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  },

  markAllAsRead: (req, res) => {
    const id_user = req.params.id_user || req.user?.id_user;
    if (!id_user) return res.status(400).json({ error: 'id_user requis' });
    Alertes.markAllAsReadForUser(id_user, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  },

  remove: (req, res) => {
    const { id_alerte } = req.params;
    if (!id_alerte) return res.status(400).json({ error: 'id_alerte requis' });
    Alertes.delete(id_alerte, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ success: true });
    });
  }
};

module.exports = AlertesController;


