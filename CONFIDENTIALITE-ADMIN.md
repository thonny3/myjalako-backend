# Confidentialité Admin - Restrictions sur le Partage de Comptes

## Vue d'ensemble

Pour garantir la confidentialité des données utilisateurs, le compte administrateur (`admin@jalako.com`) ne peut pas :
- Partager des comptes utilisateurs
- Être ajouté comme utilisateur partagé
- Accéder aux comptes partagés des utilisateurs

## Modifications apportées

### 1. Middleware d'authentification (`middlewares/auth.js`)

Ajout d'un nouveau middleware `preventAdminShare` pour empêcher l'admin d'accéder aux fonctionnalités de partage de comptes.

```javascript
const preventAdminShare = (req, res, next) => {
    // Vérifie que l'utilisateur n'est pas admin
    // Retourne 403 si l'utilisateur est admin
}
```

### 2. Contrôleur des comptes partagés (`controllers/comptesPartagesController.js`)

#### Fonction `create` (Créer un partage)
- ✅ Vérifie que l'utilisateur actuel n'est pas admin
- ✅ Empêche l'ajout d'un admin comme utilisateur partagé
- ✅ Vérifie que seul le propriétaire peut partager son compte

#### Fonction `getByCompte` (Récupérer les utilisateurs d'un compte)
- ✅ Empêche l'admin d'accéder aux informations de partage
- ✅ Vérifie que l'utilisateur a accès au compte (propriétaire ou partagé)

#### Fonction `getByUser` (Récupérer les comptes partagés d'un utilisateur)
- ✅ Empêche l'admin d'accéder aux comptes partagés
- ✅ Un utilisateur ne peut voir que ses propres comptes partagés

#### Fonction `delete` (Supprimer un partage)
- ✅ Empêche l'admin de supprimer des partages

#### Fonction `updateRole` (Modifier le rôle)
- ✅ Empêche l'admin de modifier les rôles des partages

## Messages d'erreur

Toutes les tentatives d'accès admin aux fonctionnalités de partage retournent :
```json
{
  "message": "Les administrateurs ne peuvent pas [action] pour des raisons de confidentialité"
}
```

## Sécurité

### Protection des données utilisateurs
- L'admin ne peut pas voir les relations de partage entre utilisateurs
- L'admin ne peut pas accéder aux comptes partagés
- L'admin ne peut pas être ajouté comme utilisateur partagé

### Vérifications en place
1. Vérification du rôle admin à chaque requête
2. Vérification de la propriété du compte avant partage
3. Vérification que l'utilisateur cible n'est pas admin
4. Vérification des permissions d'accès pour la consultation

## Cas d'usage

### ✅ Autorisé
- Un utilisateur normal partage son compte avec un autre utilisateur normal
- Un utilisateur normal consulte ses comptes partagés
- Un utilisateur normal gère les partages de ses propres comptes

### ❌ Interdit
- L'admin tente de partager un compte utilisateur
- L'admin tente d'accéder aux comptes partagés d'un utilisateur
- Un utilisateur tente de partager son compte avec l'admin
- L'admin tente de modifier/supprimer des partages

## Date de mise en place

Novembre 2025

## Notes

Cette restriction garantit que les données financières des utilisateurs restent privées et que l'administrateur ne peut pas accéder aux comptes partagés entre utilisateurs, respectant ainsi les principes de confidentialité et de protection des données.




