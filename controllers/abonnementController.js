const Abonnements = require('../models/abonnementModel');
const Users = require('../models/userModel');
const { sendEmail } = require('../services/emailService');

const AbonnementController = {
  getAll: (req, res) => {
    const includeInactive = req.query.includeInactive === 'true'
    Abonnements.getAll(req.params.id_user, includeInactive, (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    });
  },

  add: (req, res) => {
    Abonnements.add(req.body, (err, result) => {
      if (err) {
        if (err.code === 'DUPLICATE_ABO') return res.status(409).json({ error: 'Abonnement déjà existant' });
        return res.status(500).json({ error: err.message || err });
      }
      // Envoi email de confirmation (best-effort)
      try {
        const id_user = req.body?.id_user;
        if (id_user) {
          Users.findById(id_user, async (_eU, rowsU) => {
            const user = Array.isArray(rowsU) && rowsU[0];
            const to = user?.email;
            if (to) {
              const appName = process.env.APP_NAME || 'MyJalako';
              const logoUrl = process.env.EMAIL_LOGO_URL || '';
              const nom = req.body?.nom || 'Abonnement';
              const montant = req.body?.montant;
              const prochaine = req.body?.prochaine_echeance;
              const brand = (process.env.APP_BRAND_COLOR || '#10B981');
              const html = `
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                    <tr>
                      <td style="background:${brand};padding:20px 24px;text-align:center">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="height:42px;object-fit:contain;display:inline-block" />` : `<div style=\"color:#ffffff;font-size:20px;font-weight:700\">${appName}</div>`}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 24px 8px 24px">
                        <div style="font-size:20px;line-height:28px;color:#111827;font-weight:700;margin:0 0 8px 0">Nouvel abonnement créé</div>
                        <div style="font-size:14px;line-height:20px;color:#374151;margin:0">Votre abonnement <strong>${nom}</strong> a été ajouté avec succès.</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 24px 16px 24px">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px">
                          <tr>
                            <td style="padding:14px 16px;font-size:14px;color:#111827">Montant</td>
                            <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600">${montant}</td>
                          </tr>
                          <tr>
                            <td style="padding:14px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb">Prochaine échéance</td>
                            <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600;border-top:1px solid #e5e7eb">${prochaine}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 24px 24px 24px">
                        <a href="${process.env.APP_URL || '#'}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:600">Ouvrir ${appName}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">
                        © ${new Date().getFullYear()} ${appName}. Tous droits réservés.
                      </td>
                    </tr>
                  </table>
                </div>`;
              try { await sendEmail({ to, subject: `${appName} - Nouvel abonnement`, text: `Nouvel abonnement: ${nom}`, html }); } catch (_e) {}
            }
          });
        }
      } catch (_e2) {}
      res.json({ message: 'Abonnement ajouté', id: result.insertId });
    });
  },

  update: (req, res) => {
    Abonnements.update(req.params.id_abonnement, req.body, (err) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({ message: 'Abonnement mis à jour' });
    });
  },

  delete: (req, res) => {
    Abonnements.delete(req.params.id_abonnement, (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: 'Abonnement supprimé' });
    });
  },

  renew: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: 'Non autorisé' });
    const { id_abonnement, id_compte } = req.body;
    if (!id_abonnement) return res.status(400).json({ message: 'id_abonnement requis' });
    Abonnements.renew(id_user, { id_abonnement, id_compte }, (err, result) => {
      if (err) return res.status(500).json({ error: err.message || err });
      // Best-effort: envoyer un email de confirmation de renouvellement depuis le contrôleur aussi
      try {
        Users.findById(id_user, async (_eU, rowsU) => {
          const user = Array.isArray(rowsU) && rowsU[0];
          const to = user?.email;
          if (to) {
            const appName = process.env.APP_NAME || 'MyJalako';
            const brand = process.env.APP_BRAND_COLOR || '#10B981';
            const logoUrl = process.env.EMAIL_LOGO_URL || '';
            const appUrl = process.env.APP_URL || '#';
            const nom = result?.nom || 'Abonnement';
            const montant = result?.montant != null ? result.montant : '';
            const prochaine = result?.prochaine_echeance || '';
            const subject = `${appName} - Renouvellement réussi`;
            const text = `Votre abonnement "${nom}" a été renouvelé avec succès. Nouvelle échéance: ${prochaine}.`;
            const html = `
              <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                  <tr>
                    <td style="background:${brand};padding:20px 24px;text-align:center">${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="height:42px;object-fit:contain;display:inline-block" />` : `<div style=\"color:#ffffff;font-size:20px;font-weight:700\">${appName}</div>`}</td>
                  </tr>
                  <tr>
                    <td style="padding:24px 24px 8px 24px">
                      <div style="font-size:20px;line-height:28px;color:#111827;font-weight:700;margin:0 0 8px 0">Renouvellement réussi</div>
                      <div style="font-size:14px;line-height:20px;color:#374151;margin:0">${text}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 24px 16px 24px">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px">
                        <tr>
                          <td style="padding:14px 16px;font-size:14px;color:#111827">Montant</td>
                          <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600">${montant}</td>
                        </tr>
                        <tr>
                          <td style="padding:14px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb">Nouvelle échéance</td>
                          <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;font-weight:600;border-top:1px solid #e5e7eb">${prochaine}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 24px 24px 24px"><a href="${appUrl}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:600">Ouvrir ${appName}</a></td>
                  </tr>
                  <tr>
                    <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</td>
                  </tr>
                </table>
              </div>`;
            try { await sendEmail({ to, subject, text, html }); } catch (_e) {}
          }
        });
      } catch (_e2) {}
      res.json(result);
    });
  }
  ,
  setActive: (req, res) => {
    const { id_abonnement } = req.params;
    const { actif } = req.body;
    Abonnements.setActive(id_abonnement, !!actif, (err) => {
      if (err) {
        if (err.code === 'NO_ACTIF_COLUMN') return res.status(400).json({ error: "Colonne 'actif' manquante. Exécutez la migration." });
        return res.status(500).json({ error: err.message || err });
      }
      res.json({ success: true });
    });
  }
};

module.exports = AbonnementController;
