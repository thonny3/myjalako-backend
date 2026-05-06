require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const userRoutes = require('./routes/userRoutes');
const compteRoutes = require('./routes/compteRoutes');
const comptesPartagesRoutes = require('./routes/comptesPartagesRoutes');
const revenuesRoutes = require('./routes/revenuesRoutes');
const abonnementRoutes = require('./routes/abonnementRoutes');
const alertesRoutes = require('./routes/alertesRoutes');
const alertThresholdsRoutes = require('./routes/alertThresholdsRoutes');
const categorieRoutes = require('./routes/categoriesRoutes');
const depenseroutes = require('./routes/depensesRoutes');
const aiRoutes = require('./routes/aiRoutes');
const budgetroutes = require('./routes/budgetRoutes');
const objectifroutes = require('./routes/objectifRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const transfertsRoutes = require('./routes/transfertsRoutes');
const dettesRoutes = require('./routes/dettesRoutes');
const investissementsRoutes = require('./routes/investissementsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { scheduleAutoRenewals } = require('./services/autoRenewalJob');



const fs = require('fs');
const path = require('path');
const auth = require('./middlewares/auth');
// Créer le dossier uploads si pas existant
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Middleware
app.use(express.json());
app.use(cors({
  //origin: 'http://192.168.1.248:8081', // ton front (Next.js/React)
  origin: '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));

app.use('/uploads', express.static(uploadDir));
app.set('db', require('./config/db'));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', userRoutes); // Routes d'authentification
app.use('/api/comptes', auth, compteRoutes);
app.use('/api/comptes-partages', auth, comptesPartagesRoutes);
app.use('/api/revenus', auth, revenuesRoutes);
app.use('/api/categories', auth, categorieRoutes);
app.use('/api/depenses', auth, depenseroutes);
app.use('/api/ai', auth, aiRoutes);
app.use('/api/budgets', auth, budgetroutes);
app.use('/api/objectifs', auth, objectifroutes);
app.use('/api/transactions', auth, transactionRoutes);
app.use('/api/contributions', auth, contributionRoutes);
app.use('/api/transferts', auth, transfertsRoutes);
app.use('/api/abonnements', auth, abonnementRoutes);
app.use('/api/alertes', auth, alertesRoutes);
app.use('/api/alert-thresholds', auth, alertThresholdsRoutes);
app.use('/api/dettes', auth, dettesRoutes);
app.use('/api/investissements', auth, investissementsRoutes);
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/admin', auth, adminRoutes);

// Endpoint de santé pour les tests de connectivité
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Endpoint de test pour l'authentification (sans token)
app.get('/api/auth/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Auth endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de ping simple
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'pong', 
    message: 'Server is responding',
    timestamp: new Date().toISOString()
  });
});

// Test d'envoi d'email (protégé)
app.post('/api/email/test', auth, async (req, res) => {
  try {
    const { to, subject, text } = req.body || {};
    const { sendEmail } = require('./services/emailService');
    const recipient = to || req.user?.email;
    if (!recipient) return res.status(400).json({ error: 'Destinataire requis' });
    const resp = await sendEmail({
      to: recipient,
      subject: subject || 'Test Email MyJalako',
      text: text || 'Ceci est un email de test.'
    });
    res.json({ success: true, sent: !!resp.sent, info: resp.reason || null });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur envoi email' });
  }
});

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*'} });

app.set('io', io);

io.on('connection', (socket) => {
  // lier l'utilisateur si id_user fourni
  socket.on('auth:join', (id_user) => {
    if (id_user) socket.join(`user:${id_user}`);
  });
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));

scheduleAutoRenewals();

// Tâche quotidienne d'alertes email: J-10, J-3, J-1, et retard (quotidien)
try {
  const db = app.get('db');
  const { sendEmail } = require('./services/emailService');
  const runAlerts = () => {
    const sql = `
      SELECT a.id_abonnement, a.id_user, a.nom, a.prochaine_echeance, u.email
      FROM Abonnements a
      JOIN Users u ON u.id_user = a.id_user
      WHERE (a.actif IS NULL OR a.actif = 1)
    `;
    db.query(sql, [], (err, rows) => {
      if (err || !Array.isArray(rows)) return;
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      rows.forEach((row) => {
        const due = new Date(row.prochaine_echeance);
        const diffDays = Math.ceil((due - startOfToday) / (1000 * 60 * 60 * 24));
        let shouldSend = false;
        let type = '';
        if (diffDays === 10 || diffDays === 3 || diffDays === 1) {
          shouldSend = true;
          type = `ABO_REMINDER_J-${diffDays}`;
        } else if (diffDays < 0) {
          shouldSend = true;
          type = 'ABO_REMINDER_OVERDUE';
        }
        if (!shouldSend || !row.email) return;

        // éviter doublons: enregistrer une alerte par jour et type
        const message = diffDays < 0
          ? `Votre abonnement "${row.nom}" est en retard depuis ${Math.abs(diffDays)} jour(s).`
          : `Rappel: votre abonnement "${row.nom}" arrive à échéance dans ${diffDays} jour(s).`;
        const checkSql = `SELECT 1 FROM Alertes WHERE id_user=? AND type_alerte=? AND DATE(date_declenchement)=CURDATE() LIMIT 1`;
        db.query(checkSql, [row.id_user, type], (e0, exist) => {
          if (e0) return;
          if (exist && exist.length > 0) return; // déjà envoyé aujourd'hui
          const insertSql = `INSERT INTO Alertes (id_user, type_alerte, message, date_declenchement) VALUES (?, ?, ?, NOW())`;
          db.query(insertSql, [row.id_user, type, message], async (_e1, r1) => {
            // Envoyer email (best-effort) avec branding
            try {
              const appName = process.env.APP_NAME || 'MyJalako';
              const brand = process.env.APP_BRAND_COLOR || '#10B981';
              const logoUrl = process.env.EMAIL_LOGO_URL || '';
              const appUrl = process.env.APP_URL || '#';
              const subject = diffDays < 0 ? `${appName} - Abonnement en retard` : `${appName} - Rappel abonnement`;
              const title = diffDays < 0 ? 'Abonnement en retard' : 'Rappel abonnement';
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
                        <div style="font-size:20px;line-height:28px;color:#111827;font-weight:700;margin:0 0 8px 0">${title}</div>
                        <div style="font-size:14px;line-height:20px;color:#374151;margin:0">${message}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 24px 24px 24px">
                        <a href="${appUrl}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:600">Ouvrir ${appName}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">
                        © ${new Date().getFullYear()} ${appName}. Tous droits réservés.
                      </td>
                    </tr>
                  </table>
                </div>`;
              await sendEmail({ to: row.email, subject, text: message, html });
            } catch (_e2) {}
            try {
              const io = app.get('io');
              if (io) io.to(`user:${row.id_user}`).emit('alert:new', { id_alerte: r1?.insertId, id_user: row.id_user, type_alerte: type, message, date_declenchement: new Date() });
            } catch (_e3) {}
          });
        });
      });
    });
  };
  runAlerts();
  setInterval(runAlerts, 24 * 60 * 60 * 1000);
} catch (_e) {
  // ignore alert scheduler errors
}