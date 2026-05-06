# Guide d'utilisation de l'OCR pour les dépenses

## Vue d'ensemble

Cette fonctionnalité permet d'extraire automatiquement les informations d'un reçu ou d'une facture en utilisant la reconnaissance optique de caractères (OCR) avec Tesseract.js. Vous pouvez scanner une image de reçu et créer automatiquement une dépense avec les informations extraites.

## Installation

Assurez-vous que Tesseract.js est installé :

```bash
npm install tesseract.js
```

## Endpoints disponibles

### 1. Scanner un reçu (extraction uniquement)

**POST** `/api/depenses/scan-receipt`

Extrait les informations d'un reçu sans créer de dépense. Utile pour prévisualiser les données avant de créer la dépense.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (form-data):**
- `image`: Fichier image (JPEG, JPG, PNG, GIF, WEBP, max 10MB)

**Réponse réussie (200):**
```json
{
  "success": true,
  "confidence": 85.5,
  "extractedData": {
    "montant": 25.50,
    "date": "2024-01-15",
    "description": "Supermarket ABC",
    "rawText": "..."
  },
  "rawText": "Texte brut extrait...",
  "imageUrl": "/uploads/receipt-1234567890-123456789.jpg"
}
```

**Réponse d'erreur (400/500):**
```json
{
  "error": "Message d'erreur",
  "details": "Détails supplémentaires"
}
```

### 2. Créer une dépense depuis un reçu

**POST** `/api/depenses/from-receipt`

Scanne un reçu et crée automatiquement une dépense avec les informations extraites.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (form-data):**
- `image`: Fichier image (requis)
- `id_compte`: ID du compte (optionnel, override les données OCR)
- `id_categorie_depense`: ID de la catégorie (optionnel)
- `montant`: Montant (optionnel, override le montant OCR)
- `date_depense`: Date (optionnel, override la date OCR)
- `description`: Description (optionnel, override la description OCR)
- `use_objectif`: Boolean (optionnel)
- `id_objectif`: ID de l'objectif (optionnel)

**Réponse réussie (200):**
```json
{
  "message": "Dépense créée depuis reçu",
  "success": true,
  "depense": {
    "id_depense": 123,
    "montant": 25.50,
    "date_depense": "2024-01-15",
    "description": "Supermarket ABC",
    ...
  },
  "thresholdChecked": true,
  "notified": false,
  "totalToday": 150.00,
  "thresholdValue": 200.00,
  "ocrData": {
    "confidence": 85.5,
    "extractedData": {
      "montant": 25.50,
      "date": "2024-01-15",
      "description": "Supermarket ABC"
    }
  }
}
```

**Réponse d'erreur si montant non trouvé (400):**
```json
{
  "error": "Impossible d'extraire le montant du reçu. Veuillez le saisir manuellement.",
  "extractedData": {
    "montant": null,
    "date": "2024-01-15",
    "description": "Supermarket ABC"
  },
  "rawText": "Texte brut extrait..."
}
```

## Exemples d'utilisation

### Exemple 1: Scanner un reçu avec cURL

```bash
curl -X POST http://localhost:3002/api/depenses/scan-receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/receipt.jpg"
```

### Exemple 2: Créer une dépense depuis un reçu avec JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('id_compte', '1');
formData.append('id_categorie_depense', '5');

const response = await fetch('http://localhost:3002/api/depenses/from-receipt', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log('Dépense créée:', result);
```

### Exemple 3: Scanner puis créer manuellement

```javascript
// 1. Scanner le reçu
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const scanResponse = await fetch('http://localhost:3002/api/depenses/scan-receipt', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const scanResult = await scanResponse.json();

// 2. Afficher les données extraites à l'utilisateur pour validation/modification
console.log('Données extraites:', scanResult.extractedData);

// 3. Créer la dépense avec les données modifiées si nécessaire
const createFormData = new FormData();
createFormData.append('image', fileInput.files[0]);
createFormData.append('montant', scanResult.extractedData.montant);
createFormData.append('date_depense', scanResult.extractedData.date);
createFormData.append('description', scanResult.extractedData.description);
createFormData.append('id_categorie_depense', selectedCategoryId);
createFormData.append('id_compte', selectedAccountId);

const createResponse = await fetch('http://localhost:3002/api/depenses/from-receipt', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: createFormData
});

const createResult = await createResponse.json();
```

## Fonctionnalités de l'OCR

### Extraction automatique

Le service OCR extrait automatiquement :

1. **Montant** : Recherche les montants dans différents formats :
   - `25.50 €`
   - `Total: 25,50`
   - `25.50 EUR`
   - `$25.50`
   - etc.

2. **Date** : Reconnaît les dates dans plusieurs formats :
   - `15/01/2024`
   - `2024-01-15`
   - `15-01-2024`
   - etc.

3. **Description** : Extrait le nom du commerçant ou les premiers mots significatifs du reçu.

### Langues supportées

L'OCR supporte le français et l'anglais (`fra+eng`). Pour ajouter d'autres langues, modifiez le fichier `services/ocrService.js` :

```javascript
const { data } = await Tesseract.recognize(imagePath, 'fra+eng+spa', {
  // ...
});
```

### Qualité de l'extraction

La qualité de l'extraction dépend de :
- La qualité de l'image (résolution, netteté)
- Le contraste du texte
- La mise en page du reçu
- La langue du texte

Le champ `confidence` dans la réponse indique le niveau de confiance de l'extraction (0-100).

## Limitations

1. **Taille maximale** : 10MB par image
2. **Formats supportés** : JPEG, JPG, PNG, GIF, WEBP
3. **Précision** : L'OCR peut parfois faire des erreurs, surtout avec :
   - Images de mauvaise qualité
   - Textes manuscrits
   - Reçus très stylisés
   - Textes en langues non supportées

## Recommandations

1. **Utilisez des images de bonne qualité** : Résolution minimale de 300 DPI recommandée
2. **Éclairage uniforme** : Évitez les ombres et reflets
3. **Image droite** : Assurez-vous que le reçu est bien orienté
4. **Vérifiez les données** : Toujours vérifier les informations extraites avant de créer la dépense
5. **Workflow recommandé** :
   - Scanner d'abord avec `/scan-receipt`
   - Vérifier/modifier les données extraites
   - Créer la dépense avec `/from-receipt` ou utiliser l'endpoint standard `/api/depenses`

## Dépannage

### L'OCR ne trouve pas le montant

- Vérifiez que l'image est claire et nette
- Assurez-vous que le montant est visible et bien contrasté
- Essayez de recadrer l'image pour ne garder que la partie pertinente
- Vérifiez le texte brut extrait (`rawText`) pour comprendre ce qui a été lu

### Les dates sont incorrectes

- Vérifiez le format de date dans le texte brut
- Le service essaie plusieurs formats mais peut se tromper
- Vous pouvez toujours override la date via le paramètre `date_depense`

### Performance lente

- Le traitement OCR peut prendre plusieurs secondes selon la taille de l'image
- Pour de meilleures performances, réduisez la taille de l'image avant l'upload
- Le traitement se fait de manière synchrone, envisagez d'ajouter un système de queue pour les gros volumes

## Support

Pour toute question ou problème, consultez la documentation de Tesseract.js : https://github.com/naptha/tesseract.js


