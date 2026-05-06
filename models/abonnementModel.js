const db = require('../config/db');
const { sendEmail } = require('../services/emailService');

const Abonnements = {

    getAll: (id_user, includeInactive, callback) => {
        const sqlActive = 'SELECT * FROM Abonnements WHERE id_user=? AND (actif IS NULL OR actif=1) ORDER BY id_abonnement DESC';
        const sqlAll = 'SELECT * FROM Abonnements WHERE id_user=? ORDER BY id_abonnement DESC';
        // If explicitly asked to include inactive, try without filter first
        if (includeInactive) {
            return db.query(sqlAll, [id_user], (err, rows) => {
                if (err && err.code === 'ER_BAD_FIELD_ERROR') {
                    // No 'actif' column - return rows anyway
                    return db.query('SELECT * FROM Abonnements WHERE id_user=? ORDER BY id_abonnement DESC', [id_user], callback);
                }
                return callback(err, rows);
            });
        }
        db.query(sqlActive, [id_user], (err, rows) => {
            if (err && err.code === 'ER_BAD_FIELD_ERROR') {
                // Colonne 'actif' absente: fallback sans filtre
                return db.query(sqlAll, [id_user], callback);
            }
            return callback(err, rows);
        });
    },
    
    add: (data, callback) => {
        const { id_user, nom, montant, prochaine_echeance, rappel } = data;
        const frequence = data['fréquence'] || data.frequence;
        const icon = data.icon || null;
        const couleur = data.couleur || null;
        const id_compte = data.id_compte || null;
        const auto_renouvellement = data.auto_renouvellement ? 1 : 0;
        // Empêcher les doublons par (id_user, nom)
        db.query('SELECT 1 FROM Abonnements WHERE id_user=? AND nom=? LIMIT 1', [id_user, nom], (e0, rows) => {
            if (e0) return callback(e0);
            if (rows && rows.length > 0) return callback(Object.assign(new Error('Abonnement déjà existant'), { code: 'DUPLICATE_ABO' }));
            // Essayer avec les colonnes optionnelles icon/couleur, fallback si absentes
            const sqlWithExtras = 'INSERT INTO Abonnements (id_user, nom, montant, fréquence, prochaine_echeance, rappel, icon, couleur, id_compte, auto_renouvellement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const sqlFallbackNoAuto = 'INSERT INTO Abonnements (id_user, nom, montant, fréquence, prochaine_echeance, rappel, icon, couleur, id_compte) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const sqlBase = 'INSERT INTO Abonnements (id_user, nom, montant, fréquence, prochaine_echeance, rappel) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(sqlWithExtras, [id_user, nom, montant, frequence, prochaine_echeance, rappel, icon, couleur, id_compte, auto_renouvellement], (e1, result) => {
                if (e1 && e1.code === 'ER_BAD_FIELD_ERROR') {
                    // Essayer sans auto_renouvellement
                    return db.query(sqlFallbackNoAuto, [id_user, nom, montant, frequence, prochaine_echeance, rappel, icon, couleur, id_compte], (e1b, result2) => {
                        if (e1b && e1b.code === 'ER_BAD_FIELD_ERROR') {
                            // Fallback minimal
                    return db.query(sqlBase, [id_user, nom, montant, frequence, prochaine_echeance, rappel], callback);
                        }
                        return callback(e1b, result2);
                    });
                }
                return callback(e1, result);
            });
        });
    },

    setActive: (id_abonnement, actif, callback) => {
        // Toggle actif; if column missing, return error code so controller can fallback
        db.query('UPDATE Abonnements SET actif=? WHERE id_abonnement=?', [actif ? 1 : 0, id_abonnement], (err, result) => {
            if (err && err.code === 'ER_BAD_FIELD_ERROR') {
                return callback(Object.assign(new Error("Colonne 'actif' manquante"), { code: 'NO_ACTIF_COLUMN' }));
            }
            callback(err, result);
        });
    },

    update: (id_abonnement, data, callback) => {
        const { nom, montant, prochaine_echeance, rappel } = data;
        const frequence = data['fréquence'] || data.frequence;
        const icon = data.icon;
        const couleur = data.couleur;
        const id_compte = data.id_compte || null;
        const auto_renouvellement = data.auto_renouvellement != null ? (data.auto_renouvellement ? 1 : 0) : null;
        // Tenter mise à jour avec icon/couleur, fallback sans si colonnes absentes
        const sqlWithExtras = 'UPDATE Abonnements SET nom=?, montant=?, fréquence=?, prochaine_echeance=?, rappel=?, icon=COALESCE(?, icon), couleur=COALESCE(?, couleur), id_compte=COALESCE(?, id_compte), auto_renouvellement=COALESCE(?, auto_renouvellement) WHERE id_abonnement=?';
        const sqlFallbackNoAuto = 'UPDATE Abonnements SET nom=?, montant=?, fréquence=?, prochaine_echeance=?, rappel=?, icon=COALESCE(?, icon), couleur=COALESCE(?, couleur), id_compte=COALESCE(?, id_compte) WHERE id_abonnement=?';
        const sqlBase = 'UPDATE Abonnements SET nom=?, montant=?, fréquence=?, prochaine_echeance=?, rappel=? WHERE id_abonnement=?';
        db.query(sqlWithExtras, [nom, montant, frequence, prochaine_echeance, rappel, icon, couleur, id_compte, auto_renouvellement, id_abonnement], (e1, result) => {
            if (e1 && e1.code === 'ER_BAD_FIELD_ERROR') {
                return db.query(sqlFallbackNoAuto, [nom, montant, frequence, prochaine_echeance, rappel, icon, couleur, id_compte, id_abonnement], (e1b, result2) => {
                    if (e1b && e1b.code === 'ER_BAD_FIELD_ERROR') {
                return db.query(sqlBase, [nom, montant, frequence, prochaine_echeance, rappel, id_abonnement], callback);
                    }
                    return callback(e1b, result2);
                });
            }
            return callback(e1, result);
        });
    },

    delete: (id_abonnement, callback) => {
        db.query('UPDATE Abonnements SET actif=0 WHERE id_abonnement=?', [id_abonnement], (err, result) => {
            if (err) {
                if (err.code === 'ER_BAD_FIELD_ERROR') {
                    return db.query('DELETE FROM Abonnements WHERE id_abonnement=?', [id_abonnement], callback);
                }
                return callback(err);
            }
            callback(null, result);
        });
    },

    renew: (id_user, { id_abonnement, id_compte }, callback) => {
        // Débiter le compte choisi, avancer l'échéance selon la fréquence, et enregistrer en historique Transactions optionnellement
        db.beginTransaction((err) => {
            if (err) return callback(err);

            db.query('SELECT * FROM Abonnements WHERE id_abonnement=? AND id_user=? FOR UPDATE', [id_abonnement, id_user], (e1, rowsA) => {
                if (e1 || rowsA.length === 0) return db.rollback(() => callback(e1 || new Error('Abonnement introuvable')));
                const abo = rowsA[0];
                if (abo.actif != null && Number(abo.actif) === 0) {
                    return db.rollback(() => callback(new Error('Abonnement inactif')));
                }
                const targetCompte = id_compte || abo.id_compte;
                if (!targetCompte) return db.rollback(() => callback(new Error('Compte introuvable')));

                db.query('SELECT solde FROM Comptes WHERE id_compte=? AND id_user=? FOR UPDATE', [targetCompte, id_user], (e2, rowsC) => {
                    if (e2 || rowsC.length === 0) return db.rollback(() => callback(e2 || new Error('Compte introuvable')));
                    const solde = Number(rowsC[0].solde);
                    const montant = Number(abo.montant);
                    if (solde < montant) return db.rollback(() => callback(new Error('Solde insuffisant')));

                    db.query('UPDATE Comptes SET solde = solde - ? WHERE id_compte = ?', [montant, targetCompte], (e3) => {
                        if (e3) return db.rollback(() => callback(e3));

                        // Calcul prochaine échéance
                        let next = new Date(abo.prochaine_echeance);
                        const freq = (abo.fréquence || abo.frequence || '').toLowerCase();
                        if (freq.includes('mensuel')) next.setMonth(next.getMonth() + 1);
                        else if (freq.includes('trimestr')) next.setMonth(next.getMonth() + 3);
                        else if (freq.includes('semestr')) next.setMonth(next.getMonth() + 6);
                        else if (freq.includes('annuel')) next.setFullYear(next.getFullYear() + 1);
                        else next.setMonth(next.getMonth() + 1);

                        const y = next.getFullYear();
                        const m = String(next.getMonth() + 1).padStart(2, '0');
                        const d = String(next.getDate()).padStart(2, '0');
                        const nextStr = `${y}-${m}-${d}`;

                        // Tenter de mettre à jour aussi la date du dernier renouvellement
                        const sqlWithLast = 'UPDATE Abonnements SET prochaine_echeance=?, date_dernier_renouvellement=CURDATE(), actif=1 WHERE id_abonnement=?';
                        const sqlBase = 'UPDATE Abonnements SET prochaine_echeance=?, actif=1 WHERE id_abonnement=?';
                        db.query(sqlWithLast, [nextStr, id_abonnement], (e4) => {
                            if (e4 && e4.code === 'ER_BAD_FIELD_ERROR') {
                                return db.query(sqlBase, [nextStr, id_abonnement], (e4b) => {
                                    if (e4b) return db.rollback(() => callback(e4b));
                                    // Enregistrer une dépense pour l'abonnement afin d'apparaître dans Transactions
                                    const freqLabel = abo['fréquence'] || abo.frequence || 'Mensuel';
                                    const desc = `Renouvellement abonnement - ${abo.nom || 'Abonnement'} (${freqLabel})`;
                                    const insertDepenseSql = `
                                      INSERT INTO Depenses (id_user, montant, date_depense, description, id_categorie_depense, id_compte)
                                      VALUES (?, ?, NOW(), ?, (SELECT id FROM categories_depenses WHERE nom='Abonnements' LIMIT 1), ?)
                                    `;
                                    db.query(insertDepenseSql, [id_user, montant, desc, targetCompte], (eDep) => {
                                        if (eDep) return db.rollback(() => callback(eDep));

                                db.commit(async (e5) => {
                                            if (e5) return db.rollback(() => callback(e5));
                                    // Envoi email de confirmation de renouvellement (best-effort)
                                    try {
                                        const brand = process.env.APP_BRAND_COLOR || '#10B981';
                                        const appName = process.env.APP_NAME || 'MyJalako';
                                        const logoUrl = process.env.EMAIL_LOGO_URL || '';
                                        const appUrl = process.env.APP_URL || '#';
                                        const subject = `${appName} - Renouvellement réussi`;
                                        const message = `Votre abonnement "${abo.nom || 'Abonnement'}" a été renouvelé avec succès.`;
                                        const html = `
                                          <div style=\"font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px\">
                                            <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb\">
                                              <tr>
                                                <td style=\"background:${brand};padding:20px 24px;text-align:center\">${logoUrl ? `<img src=\\\"${logoUrl}\\\" alt=\\\"${appName}\\\" style=\\\"height:42px;object-fit:contain;display:inline-block\\\" />` : `<div style=\\\"color:#ffffff;font-size:20px;font-weight:700\\\">${appName}</div>`}</td>
                                              </tr>
                                              <tr>
                                                <td style=\"padding:24px 24px 8px 24px\">
                                                  <div style=\"font-size:20px;line-height:28px;color:#111827;font-weight:700;margin:0 0 8px 0\">Renouvellement réussi</div>
                                                  <div style=\"font-size:14px;line-height:20px;color:#374151;margin:0\">${message}</div>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td style=\"padding:8px 24px 16px 24px\">
                                                  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px\">
                                                    <tr>
                                                      <td style=\"padding:14px 16px;font-size:14px;color:#111827\">Montant</td>
                                                      <td style=\"padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600\">${montant}</td>
                                                    </tr>
                                                    <tr>
                                                      <td style=\"padding:14px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb\">Nouvelle échéance</td>
                                                      <td style=\"padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600;border-top:1px solid #e5e7eb\">${nextStr}</td>
                                                    </tr>
                                                  </table>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td style=\"padding:8px 24px 24px 24px\"><a href=\"${appUrl}\" style=\"display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:600\">Ouvrir ${appName}</a></td>
                                              </tr>
                                              <tr>
                                                <td style=\"padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center\">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</td>
                                              </tr>
                                            </table>
                                          </div>`;
                                        db.query('SELECT email FROM Users WHERE id_user=? LIMIT 1', [id_user], async (_em, erows) => {
                                            const mail = Array.isArray(erows) && erows[0]?.email;
                                            if (mail) {
                                                try { await sendEmail({ to: mail, subject, text: message, html }); } catch (_ee) {}
                                            }
                                        });
                                    } catch (_e) {}
                                    callback(null, { success: true, prochaine_echeance: nextStr, nom: abo.nom, montant });
                                        });
                                    });
                                });
                            }
                            if (e4) return db.rollback(() => callback(e4));

                            // Enregistrer une dépense pour l'abonnement afin d'apparaître dans Transactions
                            const freqLabel = abo['fréquence'] || abo.frequence || 'Mensuel';
                            const desc = `Renouvellement abonnement - ${abo.nom || 'Abonnement'} (${freqLabel})`;
                            const insertDepenseSql = `
                              INSERT INTO Depenses (id_user, montant, date_depense, description, id_categorie_depense, id_compte)
                              VALUES (?, ?, NOW(), ?, (SELECT id FROM categories_depenses WHERE nom='Abonnements' LIMIT 1), ?)
                            `;
                            db.query(insertDepenseSql, [id_user, montant, desc, targetCompte], (eDep) => {
                                if (eDep) return db.rollback(() => callback(eDep));

                                db.commit((e5) => {
                                    if (e5) return db.rollback(() => callback(e5));
                                    callback(null, { success: true, prochaine_echeance: nextStr });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
};

module.exports = Abonnements;
