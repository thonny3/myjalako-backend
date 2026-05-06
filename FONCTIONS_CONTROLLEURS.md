# Liste des Fonctions par Contrôleur

## 1. userController.js
- `register` - Inscription d'un nouvel utilisateur
- `forgotPassword` - Demande de réinitialisation de mot de passe (lien)
- `resetPassword` - Réinitialisation du mot de passe avec token
- `forgotPasswordOtp` - Demande de réinitialisation de mot de passe (code OTP)
- `resetPasswordWithOtp` - Réinitialisation du mot de passe avec code OTP
- `login` - Connexion utilisateur
- `getAllUsers` - Récupérer tous les utilisateurs
- `getUser` - Récupérer un utilisateur par ID
- `updateUser` - Mettre à jour un utilisateur
- `deleteUser` - Supprimer un utilisateur
- `verify` - Vérifier le token JWT et retourner les infos utilisateur
- `changePassword` - Changer le mot de passe de l'utilisateur authentifié
- `searchUsers` - Rechercher des utilisateurs par email (autocomplétion)

## 2. abonnementController.js
- `getAll` - Récupérer tous les abonnements d'un utilisateur
- `add` - Ajouter un nouvel abonnement
- `update` - Mettre à jour un abonnement
- `delete` - Supprimer un abonnement
- `renew` - Renouveler un abonnement
- `setActive` - Activer/désactiver un abonnement

## 3. adminController.js
- `getStats` - Statistiques générales pour les administrateurs
- `getAllUsers` - Récupérer la liste complète des utilisateurs (admin)

## 4. aiController.js
- `insights` - Analyse des dépenses avec IA
- `predict` - Prédiction des dépenses du mois suivant
- `recommendations` - Recommandations budgétaires
- `chat` - Chat avec l'IA (Gemini) pour questions budgétaires

## 5. alertesController.js
- `list` - Lister toutes les alertes d'un utilisateur
- `listUnread` - Lister les alertes non lues
- `create` - Créer une nouvelle alerte
- `markAsRead` - Marquer une alerte comme lue
- `markAllAsRead` - Marquer toutes les alertes comme lues
- `remove` - Supprimer une alerte

## 6. alertThresholdsController.js
- `list` - Lister tous les seuils d'alerte d'un utilisateur
- `getOne` - Récupérer un seuil d'alerte par domaine
- `upsert` - Créer ou mettre à jour un seuil d'alerte
- `remove` - Supprimer un seuil d'alerte

## 7. budgetController.js
- `getAll` - Récupérer tous les budgets d'un utilisateur
- `add` - Ajouter un nouveau budget
- `update` - Mettre à jour un budget
- `delete` - Supprimer un budget

## 8. categoriesController.js
### Catégories de dépenses
- `allDepenses` - Récupérer toutes les catégories de dépenses
- `add` - Ajouter une catégorie de dépense
- `delete` - Supprimer une catégorie de dépense
- `update` - Mettre à jour une catégorie de dépense

### Catégories de revenus
- `allRevenues` - Récupérer toutes les catégories de revenus
- `addRevenues` - Ajouter une catégorie de revenu
- `deleteRevenues` - Supprimer une catégorie de revenu
- `updateRevenues` - Mettre à jour une catégorie de revenu

## 9. compteController.js
- `create` - Créer un nouveau compte
- `getAll` - Récupérer tous les comptes
- `getById` - Récupérer un compte par ID
- `getByUser` - Récupérer tous les comptes d'un utilisateur
- `update` - Mettre à jour un compte
- `delete` - Supprimer un compte
- `getMyAccounts` - Récupérer tous les comptes de l'utilisateur authentifié

## 10. comptesPartagesController.js
- `create` - Ajouter un partage de compte (propriétaire uniquement)
- `getByCompte` - Récupérer les utilisateurs ayant accès à un compte
- `getByUser` - Récupérer les comptes auxquels un utilisateur a accès
- `delete` - Supprimer un partage (propriétaire uniquement)
- `updateRole` - Modifier le rôle d'un utilisateur sur un compte partagé

## 11. ContributionsController.js
- `getAll` - Récupérer toutes les contributions d'un objectif
- `add` - Ajouter une contribution à un objectif

## 12. dashboardController.js
- `summary` - Résumé du tableau de bord (statistiques complètes)

## 13. depensesController.js
- `getAll` - Récupérer toutes les dépenses d'un utilisateur
- `add` - Ajouter une nouvelle dépense
- `update` - Mettre à jour une dépense
- `delete` - Supprimer une dépense

## 14. dettesController.js
- `list` - Lister toutes les dettes d'un utilisateur
- `create` - Créer une nouvelle dette
- `update` - Mettre à jour une dette
- `remove` - Supprimer une dette
- `listPayments` - Lister les remboursements d'une dette
- `addPayment` - Ajouter un remboursement à une dette

## 15. investissementsController.js
- `list` - Lister tous les investissements d'un utilisateur
- `create` - Créer un nouvel investissement
- `update` - Mettre à jour un investissement
- `remove` - Supprimer un investissement
- `listRevenus` - Lister les revenus d'un investissement
- `addRevenu` - Ajouter un revenu à un investissement
- `listDepenses` - Lister les dépenses d'un investissement
- `addDepense` - Ajouter une dépense à un investissement

## 16. objectifController.js
- `getAll` - Récupérer tous les objectifs d'un utilisateur
- `add` - Ajouter un nouvel objectif
- `update` - Mettre à jour un objectif
- `delete` - Supprimer un objectif

## 17. revenuesController.js
- `getAll` - Récupérer tous les revenus d'un utilisateur
- `add` - Ajouter un nouveau revenu
- `update` - Mettre à jour un revenu
- `delete` - Supprimer un revenu
- `getById` - Récupérer un revenu par ID

## 18. transactionController.js
- `getAll` - Récupérer toutes les transactions d'un utilisateur

## 19. transfertsController.js
- `compteVersObjectif` - Transférer de l'argent d'un compte vers un objectif
- `objectifVersCompte` - Transférer de l'argent d'un objectif vers un compte
- `compteVersCompte` - Transférer de l'argent entre deux comptes
- `historique` - Récupérer l'historique des transferts

---

**Total: 19 contrôleurs avec 100+ fonctions**





