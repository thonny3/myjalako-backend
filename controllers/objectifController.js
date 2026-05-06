const Objectifs = require('../models/objectifModel');

const ObjectifController = {
  getAll: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    Objectifs.getAll(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    });
  },

  add: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    const data = { ...req.body, id_user };

    Objectifs.add(data, (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: 'Objectif ajouté', id: result.insertId });
    });
  },

  update: (req, res) => {
    Objectifs.update(req.params.id_objectif, req.body, (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: 'Objectif mis à jour' });
    });
  },

  delete: (req, res) => {
    Objectifs.delete(req.params.id_objectif, (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: 'Objectif supprimé' });
    });
  }
};

module.exports = ObjectifController;
