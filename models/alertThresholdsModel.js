const db = require('../config/db');

const AlertThresholds = {
  getAllByUser: (id_user, callback) => {
    const sql = 'SELECT id, id_user, domain, value, info, updated_at FROM AlertThresholds WHERE id_user = ? ORDER BY domain ASC';
    db.query(sql, [id_user], callback);
  },

  getByUserAndDomain: (id_user, domain, callback) => {
    const sql = 'SELECT id, id_user, domain, value, info, updated_at FROM AlertThresholds WHERE id_user = ? AND domain = ? LIMIT 1';
    db.query(sql, [id_user, domain], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows && rows[0] ? rows[0] : null);
    });
  },

  upsert: (data, callback) => {
    const sql = `INSERT INTO AlertThresholds (id_user, domain, value, info, updated_at)
                 VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE value = VALUES(value), info = VALUES(info), updated_at = NOW()`;
    const params = [data.id_user, data.domain, data.value, data.info || null];
    db.query(sql, params, callback);
  },

  deleteByUserAndDomain: (id_user, domain, callback) => {
    const sql = 'DELETE FROM AlertThresholds WHERE id_user = ? AND domain = ?';
    db.query(sql, [id_user, domain], callback);
  }
};

module.exports = AlertThresholds;


