const Depenses = require('../models/depensesModel');
const AlertThresholds = require('../models/alertThresholdsModel');
const Alertes = require('../models/alertesModel');
const { checkAccountPermission } = require('../utils/accountPermissions');
const ocrService = require('../services/ocrService');
const path = require('path');

const DepensesController = {
  getAll: (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    const { id_compte } = req.query;
    if (id_compte) {
      return Depenses.getByAccountForUser(id_user, id_compte, (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
      });
    }

    Depenses.getAll(id_user, (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    });
  },

  add: async (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    const id_compte = req.body?.id_compte;

    // Si un compte est spécifié, vérifier les permissions
    if (id_compte) {
      try {
        const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
        if (!hasAccess) {
          return res.status(403).json({
            message: 'Vous n\'avez pas la permission d\'ajouter des transactions sur ce compte. Seuls les contributeurs et propriétaires peuvent effectuer des transactions.',
            role: role || 'aucun'
          });
        }
      } catch (error) {
        console.error('Erreur vérification permissions:', error);
        return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
      }
    }

    const data = { ...req.body, id_user };
    Depenses.add(data, (err, result) => {
      if (err) return res.status(500).json({ error: err });
      // Après ajout, vérifier le seuil du domaine 'depenses' pour aujourd'hui (selon date serveur)
      const sumSql = `SELECT SUM(montant) AS total FROM Depenses WHERE id_user = ? AND DATE(date_depense) = CURDATE()`;
      const db = require('../config/db');
      db.query(sumSql, [id_user], (sumErr, rows) => {
        if (sumErr) {
          return res.json({ message: 'Dépense ajoutée', ...(result || {}), thresholdChecked: false, error: sumErr.message || String(sumErr) });
        }
        const totalToday = Number(rows?.[0]?.total || 0);
        AlertThresholds.getByUserAndDomain(id_user, 'depenses', (thrErr, thr) => {
          if (thrErr || !thr) {
            return res.json({ message: 'Dépense ajoutée', ...(result || {}), thresholdChecked: false, totalToday });
          }
          const thresholdValue = Number(thr.value || 0);
          if (!Number.isFinite(thresholdValue)) {
            return res.json({ message: 'Dépense ajoutée', ...(result || {}), thresholdChecked: false, totalToday });
          }
          const shouldNotify = totalToday >= thresholdValue;
          console.log('[Depenses] Check seuil jour', { id_user, totalToday, thresholdValue, shouldNotify });
          if (shouldNotify) {
            const alertPayload = {
              id_user,
              type_alerte: 'Limite de dépenses atteinte',
              message: `Vous avez atteint votre limite de dépenses aujourd'hui (${totalToday}/${thresholdValue}).`,
              date_declenchement: new Date()
            };
            Alertes.create(alertPayload, (_eIns, insRes) => {
              console.log('[Depenses] Alerte dépenses créée', { id_user, totalToday, thresholdValue })
              try {
                const io = req.app.get('io');
                if (io) {
                  io.to(`user:${id_user}`).emit('alert:new', { id_alerte: insRes?.insertId, ...alertPayload, lue: 0 });
                  console.log('[Depenses] Événement socket envoyé', { room: `user:${id_user}` })
                }
              } catch (_e) { }
              return res.json({ message: 'Dépense ajoutée', ...(result || {}), thresholdChecked: true, notified: true, totalToday, thresholdValue });
            });
          } else {
            return res.json({ message: 'Dépense ajoutée', ...(result || {}), thresholdChecked: true, notified: false, totalToday, thresholdValue });
          }
        });
      });
    });
  },

  update: async (req, res) => {
    const { id_depense } = req.params;
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    console.log('📝 UPDATE DEPENSE - ID:', id_depense);
    console.log('📝 UPDATE DEPENSE - DATA:', req.body);
    console.log('📝 UPDATE DEPENSE - USER:', id_user);

    // Récupérer la dépense pour vérifier les permissions
    const db = require('../config/db');
    db.query('SELECT id_user, id_compte FROM Depenses WHERE id_depense = ?', [id_depense], async (err, rows) => {
      if (err) {
        console.error('❌ Erreur getById:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Dépense introuvable" });
      }

      const depenseData = rows[0];
      const id_compte = depenseData.id_compte;

      // Si la dépense appartient à l'utilisateur, il peut la modifier
      if (depenseData.id_user === id_user) {
        Depenses.update(id_depense, req.body, (err, result) => {
          if (err) {
            console.error('❌ Erreur update model:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('✅ Dépense mise à jour avec succès');
          res.json({ message: 'Dépense mise à jour', data: req.body });
        });
        return;
      }

      // Si la dépense est sur un compte partagé, vérifier les permissions
      if (id_compte) {
        try {
          const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
          if (!hasAccess) {
            return res.status(403).json({
              message: 'Vous n\'avez pas la permission de modifier cette transaction. Seuls les contributeurs et propriétaires peuvent modifier les transactions.',
              role: role || 'aucun'
            });
          }

          Depenses.update(id_depense, req.body, (err, result) => {
            if (err) {
              console.error('❌ Erreur update model:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log('✅ Dépense mise à jour avec succès');
            res.json({ message: 'Dépense mise à jour', data: req.body });
          });
        } catch (error) {
          console.error('Erreur vérification permissions:', error);
          return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
        }
      } else {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette dépense" });
      }
    });
  },

  delete: async (req, res) => {
    const { id_depense } = req.params;
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    // Récupérer la dépense pour vérifier les permissions
    const db = require('../config/db');
    db.query('SELECT id_user, id_compte FROM Depenses WHERE id_depense = ?', [id_depense], async (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Dépense introuvable" });
      }

      const depenseData = rows[0];
      const id_compte = depenseData.id_compte;

      // Si la dépense appartient à l'utilisateur, il peut la supprimer
      if (depenseData.id_user === id_user) {
        Depenses.delete(id_depense, (err) => {
          if (err) return res.status(500).json({ error: err });
          res.json({ message: 'Dépense supprimée' });
        });
        return;
      }

      // Si la dépense est sur un compte partagé, vérifier les permissions
      if (id_compte) {
        try {
          const { hasAccess, role } = await checkAccountPermission(id_user, id_compte, 'write');
          if (!hasAccess) {
            return res.status(403).json({
              message: 'Vous n\'avez pas la permission de supprimer cette transaction. Seuls les contributeurs et propriétaires peuvent supprimer les transactions.',
              role: role || 'aucun'
            });
          }

          Depenses.delete(id_depense, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: 'Dépense supprimée' });
          });
        } catch (error) {
          console.error('Erreur vérification permissions:', error);
          return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
        }
      } else {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer cette dépense" });
      }
    });
  },

  /**
   * Scanner un reçu avec OCR pour extraire les informations
   * POST /api/depenses/scan-receipt
   */
  scanReceipt: async (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    try {
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;
      console.log('📸 Traitement OCR du fichier:', filePath, 'Type:', mimeType);

      // Traiter le fichier (image ou PDF) avec OCR
      const result = await ocrService.processReceipt(filePath, mimeType);
      
      console.log('📤 Résultat OCR à envoyer:', {
        success: result.success,
        confidence: result.confidence,
        hasMontant: !!result.extractedData?.montant,
        hasDate: !!result.extractedData?.date,
        hasDescription: !!result.extractedData?.description,
        rawTextLength: result.rawText?.length || 0
      });

      // Toujours retourner un résultat, même si success est false
      // Le frontend pourra afficher les données partielles ou l'erreur
      res.json({
        success: result.success !== false, // Toujours true sauf si explicitement false
        confidence: result.confidence || 0,
        extractedData: result.extractedData || {
          montant: null,
          date: new Date().toISOString().split('T')[0],
          description: null,
          rawText: result.rawText || ''
        },
        allExpenses: result.allExpenses || null, // Toutes les dépenses pour les exports Jalako
        isJalakoExport: result.isJalakoExport || false,
        rawText: (result.rawText || result.extractedData?.rawText || '').substring(0, 2000), // Limiter la taille
        fileUrl: `/uploads/${req.file.filename}`,
        fileType: mimeType,
        error: result.error || null
      });
    } catch (error) {
      console.error('Erreur scan reçu:', error);
      res.status(500).json({
        error: 'Erreur lors du scan du reçu',
        details: error.message
      });
    }
  },

  /**
   * Créer une dépense directement depuis un reçu scanné
   * POST /api/depenses/from-receipt
   */
  addFromReceipt: async (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    try {
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;
      console.log('📸 Création dépense depuis reçu:', filePath, 'Type:', mimeType);

      // Traiter le fichier (image ou PDF) avec OCR
      const ocrResult = await ocrService.processReceipt(filePath, mimeType);

      if (!ocrResult.success) {
        return res.status(500).json({
          error: 'Erreur lors du traitement OCR',
          details: ocrResult.error
        });
      }

      const extracted = ocrResult.extractedData;

      // Vérifier que le montant a été trouvé
      if (!extracted.montant || extracted.montant <= 0) {
        return res.status(400).json({
          error: 'Impossible d\'extraire le montant du reçu. Veuillez le saisir manuellement.',
          extractedData: extracted,
          rawText: ocrResult.rawText.substring(0, 500)
        });
      }

      // Préparer les données de dépense
      // Les champs peuvent être fournis dans req.body pour compléter/override les données OCR
      const depenseData = {
        id_user,
        montant: req.body.montant || extracted.montant,
        date_depense: req.body.date_depense || extracted.date || new Date().toISOString().split('T')[0],
        description: req.body.description || extracted.description || 'Dépense depuis reçu',
        id_categorie_depense: req.body.id_categorie_depense || null,
        id_compte: req.body.id_compte || null,
        use_objectif: req.body.use_objectif || false,
        id_objectif: req.body.id_objectif || null
      };

      // Vérifier les permissions si un compte est spécifié
      if (depenseData.id_compte) {
        try {
          const { hasAccess, role } = await checkAccountPermission(id_user, depenseData.id_compte, 'write');
          if (!hasAccess) {
            return res.status(403).json({
              message: 'Vous n\'avez pas la permission d\'ajouter des transactions sur ce compte.',
              role: role || 'aucun'
            });
          }
        } catch (error) {
          console.error('Erreur vérification permissions:', error);
          return res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
        }
      }

      // Créer la dépense
      Depenses.add(depenseData, (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message || err });
        }

        // Vérifier le seuil de dépenses (code similaire à la méthode add)
        const sumSql = `SELECT SUM(montant) AS total FROM Depenses WHERE id_user = ? AND DATE(date_depense) = CURDATE()`;
        const db = require('../config/db');
        db.query(sumSql, [id_user], (sumErr, rows) => {
          if (sumErr) {
            return res.json({
              message: 'Dépense créée depuis reçu',
              ...(result || {}),
              thresholdChecked: false,
              ocrData: {
                confidence: ocrResult.confidence,
                extractedData: extracted
              }
            });
          }

          const totalToday = Number(rows?.[0]?.total || 0);
          AlertThresholds.getByUserAndDomain(id_user, 'depenses', (thrErr, thr) => {
            if (thrErr || !thr) {
              return res.json({
                message: 'Dépense créée depuis reçu',
                ...(result || {}),
                thresholdChecked: false,
                totalToday,
                ocrData: {
                  confidence: ocrResult.confidence,
                  extractedData: extracted
                }
              });
            }

            const thresholdValue = Number(thr.value || 0);
            if (!Number.isFinite(thresholdValue)) {
              return res.json({
                message: 'Dépense créée depuis reçu',
                ...(result || {}),
                thresholdChecked: false,
                totalToday,
                ocrData: {
                  confidence: ocrResult.confidence,
                  extractedData: extracted
                }
              });
            }

            const shouldNotify = totalToday >= thresholdValue;
            if (shouldNotify) {
              const alertPayload = {
                id_user,
                type_alerte: 'Limite de dépenses atteinte',
                message: `Vous avez atteint votre limite de dépenses aujourd'hui (${totalToday}/${thresholdValue}).`,
                date_declenchement: new Date()
              };
              Alertes.create(alertPayload, (_eIns, insRes) => {
                try {
                  const io = req.app.get('io');
                  if (io) {
                    io.to(`user:${id_user}`).emit('alert:new', {
                      id_alerte: insRes?.insertId,
                      ...alertPayload,
                      lue: 0
                    });
                  }
                } catch (_e) {}
                return res.json({
                  message: 'Dépense créée depuis reçu',
                  ...(result || {}),
                  thresholdChecked: true,
                  notified: true,
                  totalToday,
                  thresholdValue,
                  ocrData: {
                    confidence: ocrResult.confidence,
                    extractedData: extracted
                  }
                });
              });
            } else {
              return res.json({
                message: 'Dépense créée depuis reçu',
                ...(result || {}),
                thresholdChecked: true,
                notified: false,
                totalToday,
                thresholdValue,
                ocrData: {
                  confidence: ocrResult.confidence,
                  extractedData: extracted
                }
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Erreur création dépense depuis reçu:', error);
      res.status(500).json({
        error: 'Erreur lors de la création de la dépense depuis le reçu',
        details: error.message
      });
    }
  },

  /**
   * Créer automatiquement toutes les dépenses depuis un PDF d'export Jalako
   * POST /api/depenses/bulk-from-receipt
   * Body peut contenir: id_compte (optionnel, pour forcer un compte pour toutes les dépenses)
   */
  bulkCreateFromReceipt: async (req, res) => {
    const id_user = req.user?.id_user;
    if (!id_user) return res.status(401).json({ message: "Non autorisé" });

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Compte choisi par l'utilisateur (optionnel)
    const selectedCompteId = req.body?.id_compte ? parseInt(req.body.id_compte) : null;

    try {
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;
      console.log('🤖 Création automatique de dépenses depuis PDF:', filePath);

      // Traiter le fichier avec OCR
      const ocrResult = await ocrService.processReceipt(filePath, mimeType);

      if (!ocrResult.success) {
        return res.status(500).json({
          error: 'Erreur lors du traitement OCR',
          details: ocrResult.error
        });
      }

      // Vérifier si c'est un export Jalako avec plusieurs dépenses
      if (!ocrResult.isJalakoExport || !ocrResult.allExpenses || ocrResult.allExpenses.length === 0) {
        return res.status(400).json({
          error: 'Ce fichier ne contient pas d\'export Jalako avec plusieurs dépenses. Utilisez /from-receipt pour une dépense unique.',
          extractedData: ocrResult.extractedData
        });
      }

      const expenses = ocrResult.allExpenses;
      const results = {
        success: [],
        errors: [],
        total: expenses.length
      };

      // Récupérer les catégories et comptes pour faire le mapping
      const db = require('../config/db');
      const [categories, comptes] = await Promise.all([
        new Promise((resolve, reject) => {
          // Les catégories sont partagées, pas de filtre par id_user
          db.query('SELECT id, nom FROM categories_depenses ORDER BY id ASC', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.query('SELECT id_compte, nom FROM Comptes WHERE id_user = ?', [id_user], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        })
      ]);

      // Utiliser l'IA pour mapper intelligemment les catégories
      const findCategoryIdWithAI = async (nomCategorie) => {
        if (!nomCategorie) return null;
        
        // D'abord essayer la recherche manuelle
        const nomLower = nomCategorie.toLowerCase().trim();
        
        // Recherche exacte
        let cat = categories.find(c => c.nom.toLowerCase().trim() === nomLower);
        if (cat) return cat.id;
        
        // Recherche partielle (contient)
        cat = categories.find(c => c.nom.toLowerCase().includes(nomLower) || nomLower.includes(c.nom.toLowerCase()));
        if (cat) return cat.id;
        
        // Recherche par mot clé
        const keywords = nomLower.split(/\s+/);
        for (const keyword of keywords) {
          cat = categories.find(c => c.nom.toLowerCase().includes(keyword));
          if (cat) return cat.id;
        }
        
        // Si pas trouvé, utiliser l'IA pour trouver la meilleure correspondance
        try {
          const { chatWithGemini } = require('../services/geminiService');
          const categoriesList = categories.map((c, idx) => `${idx + 1}. ${c.nom}`).join('\n');
          
          const prompt = `Tu es un expert en catégorisation de dépenses financières.

Voici les catégories disponibles dans la base de données:
${categoriesList}

Catégorie trouvée dans le document à mapper: "${nomCategorie}"

Tâche: Trouve la catégorie la plus appropriée dans la liste ci-dessus qui correspond le mieux à "${nomCategorie}".

Règles:
- Compare le sens et le contexte, pas seulement le nom exact
- Exemples de correspondances intelligentes:
  * "Transport" ou "Transports" -> "Transport"
  * "Alimentation" ou "Nourriture" -> "Alimentation"
  * "Santé" ou "Médical" -> "Santé"
  * "Loisirs" ou "Divertissement" -> "Divertissement"
- Retourne UNIQUEMENT le nom exact de la catégorie correspondante (tel qu'il apparaît dans la liste)
- Si aucune correspondance logique n'existe, retourne "null"

Réponse (uniquement le nom exact de la catégorie ou "null"):`;
          
          const aiResponse = await chatWithGemini(prompt, '');
          let matchedCategory = aiResponse?.text?.trim();
          
          // Nettoyer la réponse (enlever guillemets, points, etc.)
          matchedCategory = matchedCategory.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim();
          
          if (matchedCategory && matchedCategory.toLowerCase() !== 'null') {
            // Chercher la correspondance (insensible à la casse)
            cat = categories.find(c => c.nom.toLowerCase() === matchedCategory.toLowerCase());
            if (cat) {
              console.log(`✅ IA a mappé "${nomCategorie}" -> "${cat.nom}"`);
              return cat.id;
            } else {
              // Essayer une recherche partielle
              cat = categories.find(c => matchedCategory.toLowerCase().includes(c.nom.toLowerCase()) || c.nom.toLowerCase().includes(matchedCategory.toLowerCase()));
              if (cat) {
                console.log(`✅ IA a mappé "${nomCategorie}" -> "${cat.nom}" (correspondance partielle)`);
                return cat.id;
              }
            }
          }
        } catch (aiError) {
          console.warn('⚠️ Erreur mapping IA catégorie:', aiError.message);
        }
        
        return null;
      };

      // Fonction pour trouver l'ID d'un compte par nom (recherche flexible)
      const findCompteId = (nom) => {
        if (!nom) return null;
        const nomLower = nom.toLowerCase().trim();
        
        // Recherche exacte
        let compte = comptes.find(c => c.nom.toLowerCase().trim() === nomLower);
        if (compte) return compte.id_compte;
        
        // Recherche partielle (contient)
        compte = comptes.find(c => c.nom.toLowerCase().includes(nomLower) || nomLower.includes(c.nom.toLowerCase()));
        if (compte) return compte.id_compte;
        
        return null;
      };

      // Utiliser le compte choisi par l'utilisateur pour toutes les dépenses
      const finalIdCompte = selectedCompteId || (comptes.length > 0 ? comptes[0].id_compte : null);
      
      if (!finalIdCompte) {
        return res.status(400).json({
          error: 'Aucun compte disponible. Veuillez créer un compte d\'abord.'
        });
      }

      // Vérifier les permissions du compte une seule fois
      try {
        const { hasAccess } = await checkAccountPermission(id_user, finalIdCompte, 'write');
        if (!hasAccess) {
          return res.status(403).json({
            error: 'Vous n\'avez pas la permission d\'ajouter des transactions sur ce compte.'
          });
        }
      } catch (permError) {
        return res.status(500).json({
          error: 'Erreur lors de la vérification des permissions',
          details: permError.message
        });
      }

      console.log(`💳 Utilisation du compte ${finalIdCompte} pour toutes les ${expenses.length} dépenses`);

      // Créer chaque dépense avec le même compte choisi
      for (const expense of expenses) {
        try {
          // Mapper la catégorie avec l'IA (compare avec la base de données)
          const id_categorie_depense = await findCategoryIdWithAI(expense.categorie);

          // Créer la dépense (toutes utilisent le même compte choisi)
          const depenseData = {
            id_user,
            montant: expense.montant,
            date_depense: expense.date || new Date().toISOString().split('T')[0],
            description: expense.description || 'Dépense importée',
            id_categorie_depense: id_categorie_depense, // Mappé avec l'IA
            id_compte: finalIdCompte // Même compte pour toutes les dépenses
          };

          await new Promise((resolve, reject) => {
            Depenses.add(depenseData, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          results.success.push({
            description: depenseData.description,
            montant: depenseData.montant,
            date: depenseData.date_depense
          });

        } catch (error) {
          console.error('Erreur création dépense:', error);
          results.errors.push({
            expense,
            error: error.message || 'Erreur lors de la création'
          });
        }
      }

      // Retourner les résultats
      res.json({
        message: `${results.success.length} dépense(s) créée(s) sur ${results.total}`,
        success: results.success.length,
        errors: results.errors.length,
        details: {
          created: results.success,
          failed: results.errors
        }
      });

    } catch (error) {
      console.error('Erreur création en masse:', error);
      res.status(500).json({
        error: 'Erreur lors de la création automatique des dépenses',
        details: error.message
      });
    }
  }
};

module.exports = DepensesController;
