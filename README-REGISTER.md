# Guide de Test - Fonctionnalité d'Inscription

## 🚀 Démarrage Rapide

### 1. Démarrer le Backend
```bash
cd backend
npm install
node index.js
```
Le serveur sera accessible sur `http://localhost:3001`

### 2. Démarrer le Frontend
```bash
cd ../suivi_buget_perso
npm install
npm run dev
```
Le frontend sera accessible sur `http://localhost:3000`

### 3. Tester l'API Backend
```bash
cd backend
node test-register.js
```

## 📋 Endpoints Disponibles

### Inscription
- **POST** `/api/auth/register`
- **Body**: `{ nom, prenom, email, password, currency }`
- **Response**: `{ message, user: { id_user, nom, prenom, email, devise } }`

### Connexion
- **POST** `/api/auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ message, token, user: {...} }`

### Test de Connectivité
- **GET** `/api/ping`
- **Response**: `{ status: 'pong', message: 'Server is responding' }`

## 🔧 Fonctionnalités Implémentées

### Backend
- ✅ Validation des champs requis
- ✅ Validation du format email
- ✅ Validation de la longueur du mot de passe
- ✅ Vérification d'unicité de l'email
- ✅ Hachage sécurisé des mots de passe (bcrypt)
- ✅ Gestion des erreurs détaillées
- ✅ Support CORS pour le frontend
- ✅ Division automatique du nom complet en nom/prénom

### Frontend
- ✅ Interface utilisateur moderne et responsive
- ✅ Validation côté client
- ✅ Indicateur de connexion serveur
- ✅ Gestion des erreurs serveur
- ✅ Intégration avec le service API
- ✅ Redirection automatique après inscription

## 🧪 Tests

### Test Manuel
1. Ouvrir `http://localhost:3000/register`
2. Remplir le formulaire avec des données valides
3. Vérifier que l'inscription fonctionne
4. Tester avec des données invalides

### Test Automatique
```bash
node test-register.js
```

## 🐛 Dépannage

### Erreur "Serveur non accessible"
- Vérifier que le backend est démarré sur le port 3001
- Vérifier les logs du serveur pour des erreurs

### Erreur CORS
- Le serveur est configuré avec `origin: '*'` pour accepter toutes les origines

### Erreur de base de données
- Vérifier que MySQL est démarré
- Vérifier la configuration dans `config/db.js`

## 📝 Structure des Données

### Table Users
```sql
CREATE TABLE Users (
  id_user INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(100),
  prenom VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  mot_de_passe VARCHAR(255),
  devise VARCHAR(10),
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Format des Données Frontend → Backend
```javascript
// Frontend envoie
{
  nom: "Dupont",
  prenom: "Jean",
  email: "jean@example.com", 
  password: "motdepasse123",
  currency: "EUR"
}

// Backend reçoit directement
{
  nom: "Dupont",
  prenom: "Jean", 
  email: "jean@example.com",
  mot_de_passe: "hash_bcrypt",
  devise: "EUR"
}
```
