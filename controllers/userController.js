const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');

const userController = {
    register: (req, res) => {
        const { nom, prenom, email, password, currency } = req.body;
        
        // Validation des champs requis
        if (!nom || !prenom || !email || !password || !currency) {
            return res.status(400).json({ 
                error: 'Tous les champs sont requis',
                message: 'nom, prenom, email, password et currency sont obligatoires'
            });
        }

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Format d\'email invalide',
                message: 'Veuillez fournir un email valide'
            });
        }

        // Validation de la longueur du mot de passe
        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Mot de passe trop court',
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }

        // Vérifier si l'email existe déjà
        User.findByEmail(email, (err, users) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            
            if (users.length > 0) {
                return res.status(409).json({ 
                    error: 'Email déjà utilisé',
                    message: 'Un compte avec cet email existe déjà'
                });
            }

            // Hacher le mot de passe
            const hashedPassword = bcrypt.hashSync(password, 10);

            // Créer l'utilisateur
            User.create({ 
                nom: nom.trim(), 
                prenom: prenom.trim(), 
                email, 
                mot_de_passe: hashedPassword, 
                devise: currency 
            }, (err, result) => {
                if (err) {
                    console.error('Erreur création utilisateur:', err);
                    return res.status(500).json({ 
                        error: 'Erreur lors de la création du compte',
                        details: err.message 
                    });
                }
                
                res.status(201).json({ 
                    message: 'Compte créé avec succès',
                    user: {
                        id_user: result.insertId,
                        nom,
                        prenom,
                        email,
                        devise: currency
                    }
                });
            });
        });
    },
    forgotPassword: (req, res) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!email) return res.status(400).json({ error: 'Email requis' });

        User.findByEmail(email, (err, users) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            if (users.length === 0) {
                // Ne pas révéler si l'email existe ou non
                return res.json({ message: 'Si un compte existe, un email a été envoyé' });
                return res.json({ message: email });
                
            }
            const user = users[0];
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

            User.createPasswordReset(user.id_user, token, expiresAt, async (prErr) => {
                if (prErr) return res.status(500).json({ error: 'Erreur génération lien', details: prErr });
                try {
                    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
                    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
                    await sendEmail({
                        to: email,
                        subject: 'Réinitialisation de mot de passe',
                        text: `Pour réinitialiser votre mot de passe, cliquez sur le lien: ${resetUrl}`,
                        html: `<p>Pour réinitialiser votre mot de passe, cliquez sur le lien:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
                    });
                    console.log('Email envoyé:', email);
                } catch (e) {
                    // Continue même si email non envoyé (mode dry-run)
                    console.log('Erreur email:', e);
                }
                res.json({ message: 'Si un compte existe, un email a été envoyé' });
            });
        });
    },
    resetPassword: (req, res) => {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

        User.findPasswordResetByToken(token, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            if (!rows || rows.length === 0) return res.status(400).json({ error: 'Token invalide' });
            const pr = rows[0];
            if (pr.used) return res.status(400).json({ error: 'Token déjà utilisé' });
            if (new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: 'Token expiré' });

            const hashed = bcrypt.hashSync(newPassword, 10);
            User.updatePassword(pr.id_user, hashed, (upErr) => {
                if (upErr) return res.status(500).json({ error: 'Erreur mise à jour', details: upErr });
                User.markPasswordResetUsed(pr.id, (muErr) => {
                    if (muErr) return res.status(500).json({ error: 'Erreur finalisation', details: muErr });
                    res.json({ message: 'Mot de passe réinitialisé avec succès' });
                });
            });
        });
    },

    // OTP flow: send 6-digit code to email
    forgotPasswordOtp: (req, res) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!email) return res.status(400).json({ error: 'Email requis' });

        User.findByEmail(email, (err, users) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            if (users.length === 0) {
                const debug = process.env.DEBUG_EMAIL === '1';
                return res.json({
                    message: 'Si un compte existe, un code a été envoyé',
                    success: true,
                    sent: true, // on ne révèle pas l'existence du compte
                    info: null,
                    ...(debug ? { debug: true, userFound: false } : {})
                });
            }
            const user = users[0];
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

            User.createPasswordReset(user.id_user, otp, expiresAt, async (prErr) => {
                if (prErr) return res.status(500).json({ error: 'Erreur génération code', details: prErr });
                try {
                    const appName = process.env.APP_NAME || 'MyJalako';
                    const logoUrl = process.env.EMAIL_LOGO_URL || '';
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
                              <div style="font-size:20px;line-height:28px;color:#111827;font-weight:700;margin:0 0 8px 0">Code de réinitialisation</div>
                              <div style="font-size:14px;line-height:20px;color:#374151;margin:0">Utilisez ce code pour réinitialiser votre mot de passe. Il expire dans 10 minutes.</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:8px 24px 24px 24px;text-align:center">
                              <div style="display:inline-block;background:#111827;color:#ffffff;border-radius:12px;padding:12px 16px;font-size:24px;font-weight:700;letter-spacing:6px">${otp}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:0 24px 24px 24px;color:#6b7280;font-size:12px">
                              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">
                              © ${new Date().getFullYear()} ${appName}. Tous droits réservés.
                            </td>
                          </tr>
                        </table>
                      </div>`;
                    const emailResp = await sendEmail({
                        to: email,
                        subject: 'Code de réinitialisation (OTP)',
                        text: `Votre code de réinitialisation est: ${otp}. Il expire dans 10 minutes.`,
                        html
                    });
                    if (process.env.DEBUG_EMAIL === '1') {
                        console.log('[ForgotPasswordOtp] sendEmail response', emailResp);
                    }
                    const debug = process.env.DEBUG_EMAIL === '1';
                    return res.json({
                        message: 'Si un compte existe, un code a été envoyé',
                        success: true,
                        sent: !!emailResp?.sent,
                        info: emailResp?.reason || null,
                        ...(debug ? { debug: true, userFound: true, attemptedSend: true } : {})
                    });
                } catch (_e) {
                    if (process.env.DEBUG_EMAIL === '1') {
                        console.error('[ForgotPasswordOtp] email send error', _e);
                    }
                    return res.json({
                        message: 'Si un compte existe, un code a été envoyé',
                        success: true,
                        sent: false,
                        info: 'send_error',
                        ...(process.env.DEBUG_EMAIL === '1' ? { debug: true, userFound: true, attemptedSend: true } : {})
                    });
                }
            });
        });
    },
    // Verify OTP and set new password
    resetPasswordWithOtp: (req, res) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
        if (!email || !code || !newPassword) return res.status(400).json({ error: 'Champs requis manquants' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

        User.findByEmail(email, (err, users) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            if (users.length === 0) return res.status(400).json({ error: 'Code invalide' });
            const user = users[0];
            User.findPasswordResetByToken(code, (prErr, rows) => {
                if (prErr) return res.status(500).json({ error: 'Erreur serveur', details: prErr });
                if (!rows || rows.length === 0) return res.status(400).json({ error: 'Code invalide' });
                const pr = rows[0];
                if (pr.id_user !== user.id_user) return res.status(400).json({ error: 'Code invalide' });
                if (pr.used) return res.status(400).json({ error: 'Code déjà utilisé' });
                if (new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: 'Code expiré' });

                const hashed = bcrypt.hashSync(newPassword, 10);
                User.updatePassword(user.id_user, hashed, (upErr) => {
                    if (upErr) return res.status(500).json({ error: 'Erreur mise à jour', details: upErr });
                    User.markPasswordResetUsed(pr.id, (muErr) => {
                        if (muErr) return res.status(500).json({ error: 'Erreur finalisation', details: muErr });
                        res.json({ message: 'Mot de passe réinitialisé avec succès' });
                    });
                });
            });
        });
    },
    login: (req, res) => {
        const { email, password } = req.body;

        // Validation des champs requis
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email et mot de passe requis',
                message: 'Veuillez fournir un email et un mot de passe'
            });
        }

        User.findByEmail(email, (err, users) => {
            if (err) {
                console.error('Erreur recherche utilisateur:', err);
                return res.status(500).json({ error: 'Erreur serveur', details: err });
            }
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    error: 'Utilisateur non trouvé',
                    message: 'Aucun compte trouvé avec cet email'
                });
            }

            const user = users[0];
            if (user.actif === 0) {
                return res.status(403).json({ 
                    error: 'Compte inactif',
                    message: 'Votre compte est désactivé. Contactez un administrateur.'
                });
            }
            
            // Vérifier le mot de passe
            if (!bcrypt.compareSync(password, user.mot_de_passe)) {
                return res.status(401).json({ 
                    error: 'Mot de passe incorrect',
                    message: 'Le mot de passe fourni est incorrect'
                });
            }

            // Générer le token JWT
            const token = jwt.sign({ id_user: user.id_user }, 'SECRET_KEY', { expiresIn: '1d' });
            
            res.json({ 
                message: 'Connexion réussie', 
                token, 
                user: { 
                    id_user: user.id_user, 
                    nom: user.nom, 
                    prenom: user.prenom, 
                    email: user.email, 
                    devise: user.devise, 
                    image: user.image, 
                    role: user.role,
                    actif: user.actif
                } 
            });
        });
    },

    getAllUsers: (req, res) => {
        User.getAll((err, users) => {
            if (err) return res.status(500).json({ error: err });
            res.json(users);
        });
    },

    getUser: (req, res) => {
        const id = req.params.id;
        User.findById(id, (err, users) => {
            if (err) return res.status(500).json({ error: err });
            if (users.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
            res.json(users[0]);
        });
    },

    updateUser: (req, res) => {
        const id = req.params.id;
        const rawActif = req.body?.actif;
        const requestedActif = typeof rawActif === 'string' ? (rawActif === '1' || rawActif.toLowerCase() === 'true') : (rawActif === 1 || rawActif === true) ? true : (rawActif === 0 || rawActif === false) ? false : undefined;
        const fields = {
            nom: req.body?.nom,
            prenom: req.body?.prenom,
            email: req.body?.email,
            devise: req.body?.devise,
            image: req.file ? req.file.filename : null,
            actif: requestedActif
        };

        // Récupérer l'utilisateur courant pour décider des droits de mise à jour
        User.findById(id, (findErr, rows) => {
            if (findErr) return res.status(500).json({ error: findErr });
            if (!rows || rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
            const current = rows[0];

            const isCurrentlyInactive = current.actif === 0;
            const isDeactivating = requestedActif === false;

            // Règles:
            // - Si le compte est déjà inactif: seul 'actif' peut être modifié
            // - Si on désactive (actif -> false): seule la colonne 'actif' doit changer dans cette requête
            if (isCurrentlyInactive || isDeactivating) {
                // Conserver les valeurs actuelles pour empêcher toute modification autre que 'actif'
                fields.nom = current.nom;
                fields.prenom = current.prenom;
                fields.email = current.email;
                fields.devise = current.devise;
                fields.image = current.image;
            }

            User.update(id, fields, (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ message: 'Utilisateur mis à jour' });
            });
        });
    },

    deleteUser: (req, res) => {
        const id = req.params.id;
        User.delete(id, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: 'Utilisateur supprimé' });
        });
    },

    verify: (req, res) => {
        // Le middleware auth a déjà vérifié le token et ajouté req.user
        const userId = req.user.id_user;
        
        User.findById(userId, (err, users) => {
            if (err) return res.status(500).json({ error: err });
            if (users.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
            
            const user = users[0];
            res.json({ 
                message: 'Token valide', 
                user: { 
                    id_user: user.id_user, 
                    nom: user.nom, 
                    prenom: user.prenom, 
                    email: user.email, 
                    devise: user.devise, 
                    image: user.image, 
                    role: user.role 
                } 
            });
        });
    },

    // Changer le mot de passe de l'utilisateur authentifié
    changePassword: (req, res) => {
        const userId = req.user.id_user;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Champs manquants',
                message: 'currentPassword et newPassword sont requis'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'Mot de passe trop court',
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            });
        }

        // Récupérer l'utilisateur pour vérifier l'ancien mot de passe
        User.findById(userId, (err, users) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur', details: err });
            if (users.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });

            const user = users[0];
            const isValid = bcrypt.compareSync(currentPassword, user.mot_de_passe);
            if (!isValid) {
                return res.status(401).json({
                    error: 'Mot de passe actuel incorrect',
                    message: 'Le mot de passe actuel ne correspond pas'
                });
            }

            const hashed = bcrypt.hashSync(newPassword, 10);
            User.updatePassword(userId, hashed, (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Erreur mise à jour', details: updateErr });
                res.json({ message: 'Mot de passe mis à jour avec succès' });
            });
        });
    },

    // Rechercher des utilisateurs par email (pour autocomplétion)
    searchUsers: (req, res) => {
        const emailQuery = req.query.email || req.query.q || '';
        
        if (!emailQuery || emailQuery.length < 2) {
            return res.json([]);
        }

        User.searchByEmail(emailQuery, (err, users) => {
            if (err) {
                console.error('Erreur recherche utilisateurs:', err);
                return res.status(500).json({ error: 'Erreur serveur', details: err });
            }
            
            // Retourner uniquement les informations publiques (sans mot de passe)
            const safeUsers = users.map(user => ({
                id_user: user.id_user,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                devise: user.devise,
                image: user.image,
                role: user.role
            }));
            
            res.json(safeUsers);
        });
    }
};

module.exports = userController;
