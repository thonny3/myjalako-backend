const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Import Gemini de manière sécurisée
let chatWithGemini;
try {
  const geminiService = require('./geminiService');
  chatWithGemini = geminiService.chatWithGemini;
  if (!chatWithGemini) {
    console.warn('⚠️ chatWithGemini non disponible dans geminiService');
  }
} catch (error) {
  console.warn('⚠️ Impossible d\'importer geminiService:', error.message);
  chatWithGemini = null;
}

// pdf-parse est optionnel (pour les PDFs textuels)
let pdf;
try {
  pdf = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse non installé. Les PDFs textuels ne seront pas supportés. Installez avec: npm install pdf-parse');
}

/**
 * Service OCR pour extraire les informations des reçus et factures
 */
class OCRService {
  /**
   * Extrait le texte d'un PDF (texte natif)
   * @param {string} pdfPath - Chemin vers le PDF
   * @returns {Promise<{text: string, confidence: number}>}
   */
  async extractTextFromPDF(pdfPath) {
    if (!pdf) {
      throw new Error('pdf-parse n\'est pas installé. Installez-le avec: npm install pdf-parse');
    }

    try {
      if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF introuvable');
      }

      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);

      return {
        text: pdfData.text,
        confidence: 100, // PDF textuel = 100% de confiance
        words: []
      };
    } catch (error) {
      console.error('Erreur extraction PDF:', error);
      throw error;
    }
  }

  /**
   * Convertit la première page d'un PDF en image (pour OCR)
   * Note: Cette fonction nécessite pdf2pic ou une autre bibliothèque de conversion
   * Pour l'instant, on essaie d'extraire le texte directement
   * @param {string} pdfPath - Chemin vers le PDF
   * @returns {Promise<string>} - Chemin vers l'image générée
   */
  async convertPDFToImage(pdfPath) {
    // Pour l'instant, on retourne le chemin du PDF
    // L'utilisateur devra installer pdf2pic ou utiliser une autre méthode
    // Pour une solution simple, on peut utiliser sharp avec pdf-lib
    throw new Error('Conversion PDF en image non implémentée. Utilisez pdf-parse pour les PDFs textuels.');
  }

  /**
   * Extrait le texte d'une image ou d'un PDF
   * @param {string} filePath - Chemin vers le fichier (image ou PDF)
   * @param {string} mimeType - Type MIME du fichier
   * @returns {Promise<{text: string, confidence: number}>}
   */
  async extractText(filePath, mimeType = null) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Fichier introuvable');
      }

      // Détecter le type de fichier
      const ext = path.extname(filePath).toLowerCase();
      const isPDF = ext === '.pdf' || mimeType === 'application/pdf';

      if (isPDF) {
        // Essayer d'extraire le texte directement du PDF
        try {
          return await this.extractTextFromPDF(filePath);
        } catch (pdfError) {
          console.warn('Impossible d\'extraire le texte du PDF (peut-être scanné), erreur:', pdfError.message);
          // Si le PDF est scanné, on devrait le convertir en image
          // Pour l'instant, on lance une erreur explicite
          throw new Error('Le PDF semble être une image scannée. Veuillez convertir le PDF en image (PNG/JPEG) avant de l\'uploader, ou utilisez un PDF avec du texte sélectionnable.');
        }
      }

      // Traitement d'image avec Tesseract
      const { data } = await Tesseract.recognize(filePath, 'fra+eng', {
        logger: (m) => {
          // Log progress si nécessaire
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      return {
        text: data.text,
        confidence: data.confidence,
        words: data.words || []
      };
    } catch (error) {
      console.error('Erreur OCR:', error);
      throw error;
    }
  }

  /**
   * Détecte si le texte contient un tableau de dépenses (PDF ou image)
   * @param {string} text - Texte extrait
   * @returns {boolean}
   */
  isTableFormat(text) {
    const hasHeaders = (text.includes('Description') || text.includes('description')) &&
                      (text.includes('Montant') || text.includes('montant') || text.includes('Montant')) &&
                      (text.includes('Date') || text.includes('date'));
    
    const hasMultipleLines = (text.match(/\d+\s+[A-Za-z]/g) || []).length > 2; // Plusieurs lignes avec nombres
    
    const hasJalako = text.includes('Jalako') || text.includes('jalako');
    
    return hasHeaders || (hasMultipleLines && hasJalako) || hasMultipleLines;
  }

  /**
   * Parse un tableau de dépenses depuis une image OCR ou PDF
   * @param {string} text - Texte extrait du PDF ou image
   * @returns {Array} - Liste des dépenses trouvées
   */
  parseJalakoExportTable(text) {
    const expenses = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Chercher le début du tableau (après l'en-tête)
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      // Chercher les en-têtes de colonnes (plusieurs variantes possibles)
      if ((line.includes('id') || line.includes('description')) && 
          (line.includes('description') || line.includes('catégorie') || line.includes('categorie')) &&
          (line.includes('montant') || line.includes('montant'))) {
        startIndex = i + 1;
        break;
      }
      // Alternative: chercher juste "Description" et "Montant" séparément
      if (line.includes('description') && line.includes('montant')) {
        startIndex = i + 1;
        break;
      }
    }
    
    // Si pas d'en-tête trouvé, chercher des lignes qui ressemblent à des dépenses
    if (startIndex === -1) {
      // Chercher des lignes avec des montants et dates
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Pattern: texte + nombre + "Ar" + date
        if (line.match(/\d+\s*Ar/i) && line.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          startIndex = i;
          break;
        }
      }
    }
    
    if (startIndex === -1) {
      console.log('⚠️ Aucun début de tableau trouvé, tentative de parsing de toutes les lignes');
      startIndex = 0; // Essayer de parser toutes les lignes
    }
    
    // Parser chaque ligne de dépense
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Ignorer les lignes qui ne ressemblent pas à des dépenses
      if (line.includes('Jalako') || line.includes('Total') || line.includes('Nombre')) {
        continue;
      }
      
      // Pattern pour une ligne de dépense : ID Description Catégorie Compte Montant Date
      // Exemple: "9 Frais bus Transport Mvola 1 200 Ar 01/12/2025"
      const parts = line.split(/\s+/);
      
      if (parts.length < 5) continue;
      
      // Format: ID Description Catégorie Compte Montant Date
      // Exemple: "9 Frais bus Transport Mvola 1 200 Ar 01/12/2025"
      
      let montant = null;
      let date = null;
      let description = '';
      let categorie = '';
      let compte = '';
      
      // Chercher la date (format DD/MM/YYYY) - peut être n'importe où dans la ligne
      for (let j = 0; j < parts.length; j++) {
        const dateMatch = parts[j].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
          date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
          break;
        }
      }
      
      // Chercher le montant - plusieurs stratégies
      // 1. Chercher "Ar" ou devise et prendre le nombre avant
      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j];
        
        // Si on trouve "Ar" ou une devise
        if (part.match(/^(Ar|€|EUR|FCFA|XAF|USD|\$)$/i)) {
          // Le montant est juste avant
          if (j > 0) {
            const montantStr = parts[j - 1].replace(/\s/g, '');
            const num = parseFloat(montantStr);
            if (!isNaN(num) && num > 0) {
              montant = num;
              break;
            }
          }
        }
        
        // 2. Chercher un nombre suivi de "Ar" dans la même partie
        const montantWithDevise = part.match(/(\d[\d\s]*)\s*(Ar|€|EUR|FCFA|XAF|USD|\$)/i);
        if (montantWithDevise) {
          const montantStr = montantWithDevise[1].replace(/\s/g, '');
          const num = parseFloat(montantStr);
          if (!isNaN(num) && num > 0) {
            montant = num;
            break;
          }
        }
      }
      
      // 3. Si pas trouvé, chercher le plus grand nombre qui ressemble à un montant
      if (!montant) {
        let maxNum = 0;
        for (const part of parts) {
          const num = parseFloat(part.replace(/\s/g, ''));
          if (!isNaN(num) && num > maxNum && num < 10000000) { // Limite raisonnable
            maxNum = num;
          }
        }
        if (maxNum > 0) {
          montant = maxNum;
        }
      }
      
      // Reconstruire les autres champs
      // Trouver où se trouve le montant dans la ligne
      let montantIndex = -1;
      for (let j = 0; j < parts.length; j++) {
        if (parts[j].includes('Ar') || parts[j].match(/\d+\s*Ar/i)) {
          montantIndex = j;
          break;
        }
        const num = parseFloat(parts[j].replace(/\s/g, ''));
        if (!isNaN(num) && num === montant) {
          montantIndex = j;
          break;
        }
      }
      
      // Trouver où se trouve la date
      let dateIndex = -1;
      for (let j = 0; j < parts.length; j++) {
        if (parts[j].match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          dateIndex = j;
          break;
        }
      }
      
      // Reconstruire description, catégorie, compte
      // Format typique: Description Catégorie Compte Montant Date
      // Ou: ID Description Catégorie Compte Montant Date
      
      if (montantIndex > 0 && dateIndex > montantIndex) {
        // Les champs sont entre le début et le montant
        const startDesc = parts[0].match(/^\d+$/) ? 1 : 0; // Ignorer l'ID si présent
        
        if (montantIndex - startDesc >= 2) {
          // Au moins description + catégorie + compte
          description = parts.slice(startDesc, montantIndex - 2).join(' ');
          categorie = parts[montantIndex - 2] || '';
          compte = parts[montantIndex - 1] || '';
        } else if (montantIndex - startDesc >= 1) {
          // Au moins description
          description = parts.slice(startDesc, montantIndex).join(' ');
        }
      } else if (parts.length >= 3) {
        // Fallback: prendre les premiers mots comme description
        const startDesc = parts[0].match(/^\d+$/) ? 1 : 0;
        description = parts.slice(startDesc, Math.min(startDesc + 3, parts.length - 2)).join(' ');
      }
      
      if (montant && montant > 0) {
        expenses.push({
          montant: montant,
          date: date || new Date().toISOString().split('T')[0],
          description: description || 'Dépense importée',
          categorie: categorie,
          compte: compte,
          rawLine: line
        });
      }
    }
    
    return expenses;
  }

  /**
   * Parse le texte extrait pour trouver les informations de dépense
   * @param {string} text - Texte extrait de l'image
   * @returns {Object} - Informations structurées
   */
  parseReceiptText(text) {
    const result = {
      montant: null,
      date: null,
      description: null,
      rawText: text
    };

    // Extraire le montant (chercher les nombres avec devise ou format monétaire)
    const montantPatterns = [
      /(?:total|montant|prix|amount|total\s*:?)\s*[:\s]*([0-9]+[.,]\d{2})/i,
      /([0-9]+[.,]\d{2})\s*(?:€|EUR|FCFA|XAF|USD|\$)/i,
      /(?:€|EUR|FCFA|XAF|USD|\$)\s*([0-9]+[.,]\d{2})/i,
      /([0-9]+[.,]\d{2})/g
    ];

    for (const pattern of montantPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        // Prendre le montant le plus élevé (probablement le total)
        const amounts = matches
          .map(m => {
            const num = typeof m === 'string' ? m : m[1] || m[0];
            return parseFloat(num.replace(',', '.'));
          })
          .filter(n => !isNaN(n) && n > 0);
        
        if (amounts.length > 0) {
          result.montant = Math.max(...amounts);
          break;
        }
      }
    }

    // Extraire la date (formats courants)
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
      /(?:date|le|on)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        const date = this.parseDate(dateStr);
        if (date) {
          result.date = date;
          break;
        }
      }
    }

    // Si pas de date trouvée, utiliser la date actuelle
    if (!result.date) {
      result.date = new Date().toISOString().split('T')[0];
    }

    // Extraire la description (nom du commerçant ou premiers mots significatifs)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const descriptionPatterns = [
      /^(?:magasin|store|shop|boutique|restaurant|café|pharmacie|supermarket|supermarché)\s*:?\s*(.+)/i,
      /^([A-Z][A-Z\s&]+(?:S\.?A\.?|SARL|LTD|INC)?)/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/
    ];

    for (const line of lines.slice(0, 5)) {
      for (const pattern of descriptionPatterns) {
        const match = line.match(pattern);
        if (match) {
          result.description = match[1].trim().substring(0, 200);
          break;
        }
      }
      if (result.description) break;
    }

    // Si pas de description trouvée, prendre les premiers mots significatifs
    if (!result.description && lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 3 && firstLine.length < 100) {
        result.description = firstLine.substring(0, 200);
      } else {
        result.description = 'Dépense depuis reçu';
      }
    }

    return result;
  }

  /**
   * Parse une date depuis une chaîne
   * @param {string} dateStr - Chaîne de date
   * @returns {string|null} - Date au format YYYY-MM-DD ou null
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    try {
      // Formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length !== 3) return null;

      let day, month, year;

      // Format YYYY-MM-DD
      if (parts[0].length === 4) {
        year = parseInt(parts[0]);
        month = parseInt(parts[1]);
        day = parseInt(parts[2]);
      } else {
        // Format DD/MM/YYYY ou DD-MM-YYYY
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
        year = parseInt(parts[2]);
        if (year < 100) {
          year += 2000; // Convertir 24 -> 2024
        }
      }

      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (day < 1 || day > 31 || month < 1 || month > 12) return null;

      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }

      return date.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Utilise l'IA Gemini pour parser intelligemment le texte extrait
   * @param {string} text - Texte extrait du PDF/image
   * @param {boolean} isJalakoExport - Si c'est un export Jalako
   * @returns {Promise<Object>} - Données parsées par l'IA
   */
  async parseWithAI(text, isJalakoExport = false) {
    if (!chatWithGemini) {
      throw new Error('Service Gemini non disponible');
    }
    
    try {
      const prompt = isJalakoExport
        ? `Tu es un expert en extraction de données financières. Analyse ce texte qui contient un export de dépenses Jalako et extrais TOUTES les dépenses sous forme de tableau JSON.

Format attendu du texte:
- En-tête avec "Jalako — Liste des dépenses"
- Tableau avec colonnes: ID, Description, Catégorie, Compte, Montant, Date
- Chaque ligne représente une dépense

Exemple de ligne: "9 Frais bus Transport Mvola 1 200 Ar 01/12/2025"

Extrais TOUTES les dépenses et retourne un JSON avec ce format exact:
{
  "expenses": [
    {
      "montant": 1200,
      "date": "2025-12-01",
      "description": "Frais bus",
      "categorie": "Transport",
      "compte": "Mvola"
    }
  ]
}

Texte à analyser:
${text.substring(0, 5000)}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.`
        : `Tu es un expert en extraction de données de reçus/factures. Analyse ce texte et extrais les informations importantes.

Extrais et retourne un JSON avec ce format exact:
{
  "montant": 25.50,
  "date": "2024-01-15",
  "description": "Nom du commerçant ou description"
}

Si une information n'est pas trouvée, utilise null. Pour la date, utilise le format YYYY-MM-DD.

Texte à analyser:
${text.substring(0, 3000)}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.`;

      console.log('🤖 Utilisation de l\'IA pour parser le texte...');
      const aiResponse = await chatWithGemini(prompt, '');
      const aiText = aiResponse?.text || '';

      // Extraire le JSON de la réponse
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ IA a extrait:', parsed);
        return parsed;
      }

      throw new Error('L\'IA n\'a pas retourné de JSON valide');
    } catch (error) {
      console.error('❌ Erreur parsing IA:', error);
      throw error;
    }
  }

  /**
   * Traite une image ou un PDF de reçu et retourne les informations structurées
   * @param {string} filePath - Chemin vers le fichier (image ou PDF)
   * @param {string} mimeType - Type MIME du fichier (optionnel)
   * @returns {Promise<Object>} - Informations extraites
   */
  async processReceipt(filePath, mimeType = null) {
    try {
      console.log('🔍 Début traitement OCR:', filePath, 'Type:', mimeType);
      
      // Extraire le texte
      const { text, confidence } = await this.extractText(filePath, mimeType);
      
      console.log('📝 Texte extrait (premiers 500 caractères):', text.substring(0, 500));
      console.log('📊 Confiance:', confidence);

      // Vérifier si c'est un export Jalako ou un tableau de dépenses
      const isJalakoExport = (text.includes('Jalako') || text.includes('jalako')) && 
                            (text.includes('Liste des dépenses') || text.includes('Exporté') || text.includes('exporté'));
      
      // Vérifier si c'est un tableau (même sans mention Jalako)
      const isTable = this.isTableFormat(text);
      
      // Si c'est un tableau, essayer d'extraire toutes les dépenses
      if (isJalakoExport || isTable) {
        console.log(`📋 Détection d'un ${isJalakoExport ? 'export Jalako' : 'tableau de dépenses'} - Utilisation de l'IA pour parser`);
        
        try {
          // Utiliser l'IA pour parser intelligemment
          const aiResult = await this.parseWithAI(text, true);
          
          if (aiResult.expenses && aiResult.expenses.length > 0) {
            console.log(`✅ IA a trouvé ${aiResult.expenses.length} dépense(s)`);
            
            return {
              success: true,
              confidence: confidence || 100,
              extractedData: {
                montant: aiResult.expenses[0].montant,
                date: aiResult.expenses[0].date,
                description: aiResult.expenses[0].description,
                categorie: aiResult.expenses[0].categorie,
                compte: aiResult.expenses[0].compte,
                rawText: text
              },
              allExpenses: aiResult.expenses,
              isJalakoExport: true,
              rawText: text
            };
          }
        } catch (aiError) {
          console.warn('⚠️ Erreur parsing IA, fallback vers parsing manuel:', aiError.message);
          // Fallback vers le parsing manuel
        }
        
        // Fallback: parsing manuel amélioré
        const expenses = this.parseJalakoExportTable(text);
        console.log(`✅ ${expenses.length} dépense(s) trouvée(s) dans le tableau (parsing manuel)`);
        
        if (expenses.length > 0) {
          return {
            success: true,
            confidence: confidence || 100,
            extractedData: {
              montant: expenses[0].montant,
              date: expenses[0].date,
              description: expenses[0].description,
              categorie: expenses[0].categorie,
              compte: expenses[0].compte,
              rawText: text
            },
            allExpenses: expenses,
            isJalakoExport: true,
            rawText: text
          };
        }
      }

      // Pour les reçus uniques, essayer l'IA d'abord
      try {
        const aiResult = await this.parseWithAI(text, false);
        if (aiResult.montant || aiResult.date || aiResult.description) {
          console.log('✅ IA a extrait les données du reçu');
          return {
            success: true,
            confidence: confidence || 90,
            extractedData: {
              montant: aiResult.montant || null,
              date: aiResult.date || new Date().toISOString().split('T')[0],
              description: aiResult.description || null,
              rawText: text
            },
            isJalakoExport: false,
            rawText: text
          };
        }
      } catch (aiError) {
        console.warn('⚠️ Erreur parsing IA, fallback vers parsing manuel:', aiError.message);
      }

      // Fallback: Parser le texte normal (reçu unique)
      const parsed = this.parseReceiptText(text);
      
      console.log('✅ Données parsées (parsing manuel):', {
        montant: parsed.montant,
        date: parsed.date,
        description: parsed.description ? parsed.description.substring(0, 50) : null
      });

      return {
        success: true,
        confidence: confidence || 0,
        extractedData: {
          montant: parsed.montant || null,
          date: parsed.date || new Date().toISOString().split('T')[0],
          description: parsed.description || null,
          rawText: text
        },
        isJalakoExport: false,
        rawText: text
      };
    } catch (error) {
      console.error('❌ Erreur traitement reçu:', error);
      return {
        success: false,
        error: error.message,
        confidence: 0,
        extractedData: {
          montant: null,
          date: new Date().toISOString().split('T')[0],
          description: null,
          rawText: error.message || 'Erreur lors de l\'extraction du texte'
        },
        rawText: error.message || 'Erreur lors de l\'extraction du texte'
      };
    }
  }
}

module.exports = new OCRService();

