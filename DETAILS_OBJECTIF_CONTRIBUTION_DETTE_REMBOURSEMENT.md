# Détails des Fonctions : Objectif, Contribution, Dette et Remboursement

## 1. OBJECTIF (objectifController.js + objectifModel.js)

### Contrôleur (objectifController.js)

#### `getAll`
- **Description**: Récupérer tous les objectifs d'un utilisateur
- **Méthode**: GET
- **Authentification**: Requise (req.user.id_user)
- **Retour**: Liste des objectifs de l'utilisateur

#### `add`
- **Description**: Ajouter un nouvel objectif
- **Méthode**: POST
- **Authentification**: Requise
- **Paramètres requis**: 
  - `nom` (string)
  - `montant_objectif` (number)
  - `date_limite` (date)
  - `montant_actuel` (number, optionnel)
  - `statut` (string, optionnel)
  - `pourcentage` (number, optionnel)
  - `icone` (string, optionnel)
  - `couleur` (string, optionnel)
- **Retour**: Message de succès + ID de l'objectif créé

#### `update`
- **Description**: Mettre à jour un objectif
- **Méthode**: PUT/PATCH
- **Paramètres URL**: `id_objectif`
- **Paramètres body**: 
  - `nom`, `montant_objectif`, `date_limite`, `montant_actuel`, `icone`, `couleur`
- **Fonctionnalités**:
  - Recalcule automatiquement le `pourcentage`
  - Met à jour le `statut` selon les règles:
    - 'Atteint' si montant_actuel >= montant_objectif
    - 'Retard' si date_limite dépassée
    - 'En cours' sinon
- **Retour**: Message de succès

#### `delete`
- **Description**: Supprimer un objectif
- **Méthode**: DELETE
- **Paramètres URL**: `id_objectif`
- **Retour**: Message de succès

### Modèle (objectifModel.js)

#### `getAll(id_user, callback)`
- Récupère tous les objectifs d'un utilisateur
- Triés par ID décroissant

#### `add(data, callback)`
- Insère un nouvel objectif
- Champs: id_user, nom, montant_objectif, date_limite, montant_actuel, statut, pourcentage, icone, couleur

#### `update(id_objectif, data, callback)`
- Met à jour un objectif
- Recalcule automatiquement:
  - `pourcentage` = (montant_actuel / montant_objectif) * 100 (max 100)
  - `statut` selon les règles métier

#### `delete(id_objectif, callback)`
- Supprime un objectif

---

## 2. CONTRIBUTION (ContributionsController.js + Contributions.js)

### Contrôleur (ContributionsController.js)

#### `getAll`
- **Description**: Récupérer toutes les contributions d'un objectif
- **Méthode**: GET
- **Paramètres URL**: `id_objectif`
- **Retour**: Liste des contributions avec:
  - Informations de la contribution
  - Nom de l'objectif (objectif_nom)
  - Nom du compte (compte_nom)
- **Tri**: Par date de contribution décroissante

#### `add`
- **Description**: Ajouter une contribution à un objectif
- **Méthode**: POST
- **Authentification**: Requise
- **Paramètres requis**:
  - `id_objectif` (number)
  - `montant` (number)
  - `id_compte` (number, optionnel)
- **Fonctionnalités**:
  - Vérifie que le montant ne dépasse pas l'objectif
  - Met à jour automatiquement:
    - `montant_actuel` de l'objectif
    - `pourcentage` de l'objectif
    - `statut` de l'objectif
  - Débite le compte si `id_compte` est fourni
- **Retour**: Données de la contribution créée

### Modèle (Contributions.js)

#### `getAll(id_objectif, callback)`
- Récupère toutes les contributions d'un objectif
- Jointure avec Objectifs et Comptes pour récupérer les noms
- Tri par date décroissante

#### `add(data, callback)`
- **Logique métier**:
  1. Vérifie que l'objectif existe
  2. Vérifie que le nouveau montant_actuel ne dépasse pas montant_objectif
  3. Insère la contribution
  4. Met à jour l'objectif (montant_actuel, pourcentage, statut)
  5. Débite le compte si id_compte fourni
- **Gestion d'erreurs**: Retourne erreur 400 si montant dépasse l'objectif

---

## 3. DETTE (dettesController.js + dettesModel.js)

### Contrôleur (dettesController.js)

#### `list`
- **Description**: Lister toutes les dettes d'un utilisateur
- **Méthode**: GET
- **Authentification**: Requise (ou id_user en paramètre)
- **Fonctionnalités**:
  - Enrichit automatiquement le statut:
    - 'terminé' si montant_restant <= 0
    - 'en retard' si date_fin_prevue < aujourd'hui
    - Sinon conserve le statut existant
- **Retour**: Liste des dettes avec statut enrichi

#### `create`
- **Description**: Créer une nouvelle dette
- **Méthode**: POST
- **Authentification**: Requise
- **Paramètres requis**:
  - `nom` (string)
  - `montant_initial` (number)
- **Paramètres optionnels**:
  - `montant_restant` (number, par défaut = montant_initial)
  - `taux_interet` (number, par défaut = 0)
  - `date_debut` (date)
  - `date_fin_prevue` (date)
  - `paiement_mensuel` (number, par défaut = 0)
  - `creancier` (string)
  - `sens` ('moi' ou 'autre', par défaut = 'autre')
  - `statut` (string, par défaut = 'en cours')
  - `type` (string, par défaut = 'personne')
  - `id_compte` (number)
- **Fonctionnalités**:
  - Calcule automatiquement montant_restant avec intérêts si taux_interet > 0
  - Met à jour le solde du compte selon le sens:
    - 'moi': sortie (solde - montant)
    - 'autre': entrée (solde + montant)
- **Retour**: ID de la dette créée

#### `update`
- **Description**: Mettre à jour une dette
- **Méthode**: PUT/PATCH
- **Paramètres URL**: `id_dette`
- **Paramètres body**: Tous les champs de la dette (optionnels)
- **Retour**: Succès

#### `remove`
- **Description**: Supprimer une dette
- **Méthode**: DELETE
- **Paramètres URL**: `id_dette`
- **Retour**: Succès

#### `listPayments`
- **Description**: Lister les remboursements d'une dette (ou toutes les dettes)
- **Méthode**: GET
- **Paramètres URL**: `id_dette` (optionnel)
- **Authentification**: Requise
- **Retour**: Liste des remboursements

#### `addPayment`
- **Description**: Ajouter un remboursement à une dette
- **Méthode**: POST
- **Authentification**: Requise
- **Paramètres requis**:
  - `id_dette` (number)
  - `montant` (number, doit être > 0)
  - `date_paiement` (date)
  - `id_compte` (number)
- **Fonctionnalités**:
  1. Vérifie que la dette existe
  2. Vérifie que montant <= montant_restant
  3. Vérifie le solde du compte (pour sens='autre')
  4. Crée le remboursement
  5. Met à jour la dette:
     - Diminue montant_restant
     - Met statut à 'terminé' si montant_restant <= 0
  6. Met à jour le compte selon le sens:
     - 'moi': crédit (solde + montant)
     - 'autre': débit (solde - montant)
- **Retour**: ID du remboursement créé

### Modèle (dettesModel.js)

#### `getAllByUser(id_user, callback)`
- Récupère toutes les dettes d'un utilisateur
- Tri par date_debut décroissante

#### `create(data, callback)`
- Insère une nouvelle dette
- Champs: id_user, nom, montant_initial, montant_restant, taux_interet, date_debut, date_fin_prevue, paiement_mensuel, creancier, sens, statut, type, id_compte

#### `update(id_dette, data, callback)`
- Met à jour une dette
- Gère conditionnellement montant_restant (seulement si fourni)

#### `delete(id_dette, id_user, callback)`
- Supprime une dette (avec vérification id_user)

---

## 4. REMBOURSEMENT (remboursementsModel.js)

### Modèle (remboursementsModel.js)

#### `getByDette(id_user, id_dette, callback)`
- **Description**: Récupérer les remboursements
- **Paramètres**:
  - `id_user` (requis)
  - `id_dette` (optionnel, null pour tous les remboursements)
- **Fonctionnalités**:
  - Si id_dette est null, retourne tous les remboursements de l'utilisateur
  - Sinon, retourne uniquement les remboursements de cette dette
- **Tri**: Par date_paiement décroissante

#### `create(data, callback)`
- **Description**: Créer un nouveau remboursement
- **Paramètres requis**:
  - `id_dette` (number)
  - `id_user` (number)
  - `montant` (number)
  - `date_paiement` (date)
  - `id_compte` (number, optionnel)
- **Retour**: Résultat de l'insertion

---

## Relations et Flux

### Flux Objectif → Contribution
1. Utilisateur crée un objectif avec `montant_objectif`
2. Utilisateur ajoute des contributions via `ContributionsController.add`
3. Chaque contribution:
   - Vérifie que le total ne dépasse pas l'objectif
   - Met à jour `montant_actuel` de l'objectif
   - Recalcule `pourcentage` et `statut` de l'objectif
   - Débite le compte si fourni

### Flux Dette → Remboursement
1. Utilisateur crée une dette avec `montant_initial` et `sens`
2. Le système met à jour le compte selon le sens:
   - 'moi': sortie (dette que je dois)
   - 'autre': entrée (dette qu'on me doit)
3. Utilisateur ajoute des remboursements via `DettesController.addPayment`
4. Chaque remboursement:
   - Vérifie que montant <= montant_restant
   - Crée l'enregistrement de remboursement
   - Diminue montant_restant de la dette
   - Met à jour le compte (inverse du sens initial)
   - Met statut à 'terminé' si montant_restant <= 0

---

## Statuts et Calculs Automatiques

### Objectif
- **Statut calculé automatiquement**:
  - 'Atteint': montant_actuel >= montant_objectif
  - 'Retard': date_limite < aujourd'hui
  - 'En cours': sinon
- **Pourcentage**: (montant_actuel / montant_objectif) * 100 (max 100)

### Dette
- **Statut enrichi automatiquement**:
  - 'terminé': montant_restant <= 0
  - 'en retard': date_fin_prevue < aujourd'hui
  - Sinon: statut stocké en base

---

## Notes Importantes

1. **Contributions**: Le modèle vérifie que le montant total ne dépasse jamais l'objectif
2. **Dettes**: Le sens détermine si c'est une dette que je dois ('moi') ou qu'on me doit ('autre')
3. **Remboursements**: Le système vérifie le solde du compte avant de créer un remboursement pour sens='autre'
4. **Calculs automatiques**: Les pourcentages et statuts sont recalculés automatiquement lors des mises à jour





