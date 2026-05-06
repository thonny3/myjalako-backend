const db = require('../config/db');

const Alertes = {
  getAllByUser: (id_user, callback) => {
    const sql = 'SELECT * FROM Alertes WHERE id_user = ? ORDER BY date_creation DESC';
    db.query(sql, [id_user], callback);
  },

  getUnreadByUser: (id_user, callback) => {
    const sql = 'SELECT * FROM Alertes WHERE id_user = ? AND lue = FALSE ORDER BY date_creation DESC';
    db.query(sql, [id_user], callback);
  },

  create: (data, callback) => {
    const sql = `INSERT INTO Alertes (id_user, type_alerte, message, date_declenchement)
                 VALUES (?, ?, ?, ?)`;
    const params = [
      data.id_user,
      data.type_alerte,
      data.message || null,
      data.date_declenchement || null
    ];
    db.query(sql, params, callback);
  },

  markAsRead: (id_alerte, callback) => {
    const sql = 'UPDATE Alertes SET lue = TRUE WHERE id_alerte = ?';
    db.query(sql, [id_alerte], callback);
  },

  markAllAsReadForUser: (id_user, callback) => {
    const sql = 'UPDATE Alertes SET lue = TRUE WHERE id_user = ? AND lue = FALSE';
    db.query(sql, [id_user], callback);
  },

  delete: (id_alerte, callback) => {
    const sql = 'DELETE FROM Alertes WHERE id_alerte = ?';
    db.query(sql, [id_alerte], callback);
  },

  deleteOlderThan: (cutoffDate, callback) => {
    const sql = 'DELETE FROM Alertes WHERE date_creation < ?';
    db.query(sql, [cutoffDate], callback);
  }
};

module.exports = Alertes;


