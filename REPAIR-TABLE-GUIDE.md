# Guide de Réparation de Table Corrompue

## Problème
L'erreur `ER_CRASHED_ON_USAGE` (errno 1194) indique que la table MySQL est corrompue et doit être réparée.

## Solution 1 : Utiliser le script automatique (Recommandé)

```bash
cd backend
node repair-table.js
```

Ce script va :
1. Vérifier l'état de la table `Comptes`
2. Réparer la table automatiquement
3. Vérifier que la réparation a réussi

## Solution 2 : Réparation manuelle via MySQL

### Option A : Via ligne de commande MySQL

```bash
mysql -u root -p jalako
```

Puis exécutez :
```sql
REPAIR TABLE Comptes;
```

### Option B : Via phpMyAdmin ou autre outil

1. Connectez-vous à votre base de données
2. Sélectionnez la base `jalako`
3. Exécutez la requête SQL :
```sql
REPAIR TABLE Comptes;
```

## Vérification

Après la réparation, vérifiez l'état de la table :

```sql
CHECK TABLE Comptes;
```

Vous devriez voir un message indiquant que la table est OK.

## Prévention

Pour éviter que cela se reproduise :
- Assurez-vous que MySQL/MariaDB est correctement arrêté (pas de crash)
- Vérifiez l'espace disque disponible
- Surveillez les logs MySQL pour détecter les problèmes tôt
- Effectuez des sauvegardes régulières

## Si la réparation échoue

Si `REPAIR TABLE` ne fonctionne pas, vous pouvez essayer :

```sql
-- Option 1 : Réparation avec option QUICK
REPAIR TABLE Comptes QUICK;

-- Option 2 : Réparation avec option EXTENDED
REPAIR TABLE Comptes EXTENDED;

-- Option 3 : Vérifier et optimiser
CHECK TABLE Comptes;
OPTIMIZE TABLE Comptes;
```

Si rien ne fonctionne, vous devrez peut-être restaurer depuis une sauvegarde.

