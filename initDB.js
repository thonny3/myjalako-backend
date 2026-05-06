const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

db.connect(err => {
    if (err) throw err;
    console.log('Connecté à MySQL');

    db.query('CREATE DATABASE IF NOT EXISTS jalako', (err) => {
        if (err) throw err;
        console.log('Base jalako créée ou déjà existante');

        const dbBudget = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'jalako'
        });

        dbBudget.connect(async (err) => {
            if (err) throw err;
            console.log('Connecté à jalako');

            // ---------- TABLES ----------
            const createUsersTable = `
            CREATE TABLE IF NOT EXISTS Users (
                id_user INT PRIMARY KEY AUTO_INCREMENT,
                nom VARCHAR(100),
                prenom VARCHAR(100),
                email VARCHAR(255) UNIQUE,
                mot_de_passe TEXT,
                devise VARCHAR(10) DEFAULT 'MGA',
                image VARCHAR(255),
                role ENUM('admin','user') DEFAULT 'user',
                actif BOOLEAN DEFAULT TRUE,
                date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
            )`;

            const createComptesTable = `
            CREATE TABLE IF NOT EXISTS Comptes (
                id_compte INT PRIMARY KEY AUTO_INCREMENT,
                id_user INT,
                nom VARCHAR(100),
                solde DECIMAL(10,2) DEFAULT 0.00,
                type VARCHAR(50),
                FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;

            const createComptesPartagesTable = `
            CREATE TABLE IF NOT EXISTS Comptes_partages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                id_compte INT,
                id_user INT,
                role VARCHAR(20),
                FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte) ON DELETE CASCADE,
                FOREIGN KEY (id_user) REFERENCES Users(id_user) ON DELETE CASCADE
            )`;

            const createCategoriesRevenusTable = `
            CREATE TABLE IF NOT EXISTS categories_revenus (
              id INT PRIMARY KEY AUTO_INCREMENT,
              nom VARCHAR(100)
            )`;

            const createRevenusTable = `
            CREATE TABLE IF NOT EXISTS Revenus (
              id_revenu INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT,
              montant DECIMAL(10,2),
              date_revenu DATE,
              source TEXT,
              id_categorie_revenu INT,
              id_compte INT,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_categorie_revenu) REFERENCES categories_revenus(id),
              FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createCategoriesDepensesTable = `
            CREATE TABLE IF NOT EXISTS categories_depenses (
              id INT PRIMARY KEY AUTO_INCREMENT,
              nom VARCHAR(100)
            )`;

            const createDepensesTable = `
            CREATE TABLE IF NOT EXISTS Depenses (
              id_depense INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT,
              montant DECIMAL(10,2),
              date_depense DATE,
              description TEXT,
              id_categorie_depense INT,
              id_compte INT,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_categorie_depense) REFERENCES categories_depenses(id),
              FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createBudgetsTable = `
            CREATE TABLE IF NOT EXISTS Budgets (
              id_budget INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT,
              id_categorie_depense INT,
              mois VARCHAR(20),
              montant_max DECIMAL(10,2),
              montant_restant DECIMAL(10,2),
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_categorie_depense) REFERENCES categories_depenses(id)
            )`;

            const createObjectifsTable = `
            CREATE TABLE IF NOT EXISTS Objectifs (
              id_objectif INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT,
              nom VARCHAR(100),
              montant_objectif DECIMAL(10,2),
              date_limite DATE,
              montant_actuel DECIMAL(10,2),
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;

            const createAbonnementsTable = `
            CREATE TABLE IF NOT EXISTS Abonnements (
              id_abonnement INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT,
              nom VARCHAR(100),
              montant DECIMAL(10,2),
              fréquence VARCHAR(20),
              prochaine_echeance DATE,
              rappel BOOLEAN,
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;
            const createAlertesTable = `
            CREATE TABLE IF NOT EXISTS Alertes (
              id_alerte INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT NOT NULL,
              type_alerte ENUM('budget_depasse','solde_faible','echeance_abonnement','objectif_atteint','transaction_inhabituelle') NOT NULL,
              message TEXT,
              date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
              date_declenchement DATETIME NULL,
              lue BOOLEAN DEFAULT FALSE,
              parametres_specifiques JSON NULL,
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;
            const createAlertThresholdsTable = `
            CREATE TABLE IF NOT EXISTS AlertThresholds (
              id INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT NOT NULL,
              domain ENUM('solde','comptes','depenses','budget','objectifs') NOT NULL,
              value DECIMAL(12,2) NOT NULL,
              info TEXT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uniq_user_domain (id_user, domain),
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;
            const createContributionsTable = `
CREATE TABLE IF NOT EXISTS Contributions (
  id_contribution INT PRIMARY KEY AUTO_INCREMENT,
  id_objectif INT NOT NULL,
  id_user INT NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  date_contribution DATE NOT NULL,
  id_compte INT,
  FOREIGN KEY (id_objectif) REFERENCES Objectifs(id_objectif),
  FOREIGN KEY (id_user) REFERENCES Users(id_user),
  FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
)`;

            const createDettesTable = `
            CREATE TABLE IF NOT EXISTS Dettes (
              id_dette INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT NOT NULL,
              nom VARCHAR(200) NOT NULL,
              montant_initial DECIMAL(12,2) NOT NULL,
              montant_restant DECIMAL(12,2) NOT NULL,
              taux_interet DECIMAL(5,2) DEFAULT 0,
              date_debut DATE NOT NULL,
              date_fin_prevue DATE,
              paiement_mensuel DECIMAL(12,2) DEFAULT 0,
              creancier VARCHAR(200),
              sens VARCHAR(10) DEFAULT 'autre',
              statut VARCHAR(50) DEFAULT 'en cours',
              type VARCHAR(50) DEFAULT 'personne',
              id_compte INT,
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
              , FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createRemboursementsTable = `
            CREATE TABLE IF NOT EXISTS Remboursements (
              id_remboursement INT PRIMARY KEY AUTO_INCREMENT,
              id_dette INT NOT NULL,
              id_user INT NOT NULL,
              montant DECIMAL(12,2) NOT NULL,
              date_paiement DATE NOT NULL,
              id_compte INT,
              FOREIGN KEY (id_dette) REFERENCES Dettes(id_dette) ON DELETE CASCADE,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createInvestissementsTable = `
            CREATE TABLE IF NOT EXISTS Investissements (
              id_investissement INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT NOT NULL,
              nom VARCHAR(200) NOT NULL,
              type VARCHAR(50) DEFAULT 'immobilier',
              projet VARCHAR(255),
              date_achat DATE NOT NULL,
              montant_investi DECIMAL(12,2) NOT NULL,
              valeur_actuelle DECIMAL(12,2) DEFAULT NULL,
              duree_mois INT DEFAULT NULL,
              taux_prevu DECIMAL(6,2) DEFAULT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (id_user) REFERENCES Users(id_user)
            )`;

            const createInvestRevenusTable = `
            CREATE TABLE IF NOT EXISTS Investissements_Revenus (
              id INT PRIMARY KEY AUTO_INCREMENT,
              id_investissement INT NOT NULL,
              id_user INT NOT NULL,
              montant DECIMAL(12,2) NOT NULL,
              date_revenu DATE NOT NULL,
              type VARCHAR(50),
              note TEXT,
              id_compte INT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (id_investissement) REFERENCES Investissements(id_investissement) ON DELETE CASCADE,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createInvestDepensesTable = `
            CREATE TABLE IF NOT EXISTS Investissements_Depenses (
              id INT PRIMARY KEY AUTO_INCREMENT,
              id_investissement INT NOT NULL,
              id_user INT NOT NULL,
              montant DECIMAL(12,2) NOT NULL,
              date_depense DATE NOT NULL,
              type VARCHAR(50),
              note TEXT,
              id_compte INT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (id_investissement) REFERENCES Investissements(id_investissement) ON DELETE CASCADE,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              FOREIGN KEY (id_compte) REFERENCES Comptes(id_compte)
            )`;

            const createPasswordResetsTable = `
            CREATE TABLE IF NOT EXISTS PasswordResets (
              id INT PRIMARY KEY AUTO_INCREMENT,
              id_user INT NOT NULL,
              token VARCHAR(255) NOT NULL,
              expires_at DATETIME NOT NULL,
              used BOOLEAN DEFAULT FALSE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (id_user) REFERENCES Users(id_user),
              UNIQUE KEY uniq_token (token)
            )`;

            // ---------- CRÉATION DES TABLES ET INSERTIONS ----------
            dbBudget.query(createUsersTable, (err) => {
                if (err) throw err;
                console.log('Table Users OK');

                dbBudget.query(createComptesTable, (err) => {
                    if (err) throw err;
                    console.log('Table Comptes OK');

                    dbBudget.query(createComptesPartagesTable, (err) => {
                        if (err) throw err;
                        console.log('Table Comptes_partages OK');

                        dbBudget.query(createCategoriesRevenusTable, (err) => {
                            if (err) throw err;
                            console.log('Table categories_revenus OK');

                            const insertCategoriesRevenus = `
                            INSERT INTO categories_revenus (nom) VALUES
                            ('Salaire'),
                            ('Prime'),
                            ('Freelance / Mission'),
                            ('Investissements'),
                            ('Dividendes'),
                            ('Ventes / Revente'),
                            ('Cadeaux / Héritage'),
                            ('Autres revenus')
                            `;
                            dbBudget.query(insertCategoriesRevenus, (err) => {
                                if (err) console.log("Catégories revenus déjà insérées ou erreur :", err.message);
                                else console.log("Catégories de revenus insérées");

                                dbBudget.query(createRevenusTable, (err) => {
                                    if (err) throw err;
                                    console.log('Table Revenus OK');

                                    dbBudget.query(createCategoriesDepensesTable, (err) => {
                                        if (err) throw err;
                                        console.log('Table categories_depenses OK');

                                        const insertCategoriesDepenses = `
                                        INSERT INTO categories_depenses (nom) VALUES
                                        ('Logement'),
                                        ('Transport'),
                                        ('Alimentation'),
                                        ('Santé'),
                                        ('Éducation'),
                                        ('Divertissement'),
                                        ('Voyages'),
                                        ('Autres')
                                        `;
                                        dbBudget.query(insertCategoriesDepenses, (err) => {
                                            if (err) console.log("Catégories dépenses déjà insérées ou erreur :", err.message);
                                            else console.log("Catégories de dépenses insérées");

                                            dbBudget.query(createDepensesTable, (err) => {
                                                if (err) throw err;
                                                console.log('Table Depenses OK');

                                                dbBudget.query(createBudgetsTable, (err) => {
                                                    if (err) throw err;
                                                    console.log('Table Budgets OK');

                                                    dbBudget.query(createObjectifsTable, (err) => {
                                                        if (err) throw err;
                                                        console.log('Table Objectifs OK');

                                                        dbBudget.query(createAbonnementsTable, async (err) => {
                                                            if (err) throw err;
                                                            console.log('Table Abonnements OK');

                                                            dbBudget.query(createAlertesTable, async (err) => {
                                                                if (err) throw err;
                                                                console.log('Table Alertes OK');
                                                                dbBudget.query(createAlertThresholdsTable, (err) => {
                                                                    if (err) throw err;
                                                                    console.log('Table AlertThresholds OK');

                                                                    dbBudget.query(createDettesTable, (err) => {
                                                                        if (err) throw err;
                                                                        console.log('Table Dettes OK');

                                                                        const alterDettesAddSens = "ALTER TABLE Dettes ADD COLUMN IF NOT EXISTS sens VARCHAR(10) DEFAULT 'autre' AFTER creancier";
                                                                        dbBudget.query(alterDettesAddSens, (_err) => {
                                                                            // ignore if not supported

                                                                            dbBudget.query(createRemboursementsTable, (err) => {
                                                                            if (err) throw err;
                                                                            console.log('Table Remboursements OK');

                                                                            dbBudget.query(createInvestissementsTable, (err) => {
                                                                                if (err) throw err;
                                                                                console.log('Table Investissements OK');

                                                                                dbBudget.query(createInvestRevenusTable, (err) => {
                                                                                    if (err) throw err;
                                                                                    console.log('Table Investissements_Revenus OK');

                                                                                    dbBudget.query(createInvestDepensesTable, (err) => {
                                                                                        if (err) throw err;
                                                                                        console.log('Table Investissements_Depenses OK');
                                                                                        dbBudget.query(createPasswordResetsTable, (err) => {
                                                                                            if (err) throw err;
                                                                                            console.log('Table PasswordResets OK');

                                                                                            // ---------- CRÉATION COMPTE ADMIN ----------
                                                                                            const email = "admin@jalako.com";
                                                                                            const plainPassword = "admin123";
                                                                                            const hashedPassword = bcrypt.hashSync(plainPassword, 10);

                                                                                            const insertAdmin = `
                                                            INSERT INTO Users (nom, prenom, email, mot_de_passe, role, devise)
                                                            VALUES ('Admin', 'User', ?, ?, 'admin', 'MGA')
                                                            ON DUPLICATE KEY UPDATE email=email`;

                                                                                            dbBudget.query(insertAdmin, [email, hashedPassword], (err) => {
                                                                                                if (err) throw err;
                                                                                                console.log("Compte admin ajouté");

                                                                                                dbBudget.query(`SELECT id_user FROM Users WHERE email = ? LIMIT 1`, [email], (err, rows) => {
                                                                                                    if (err) throw err;
                                                                                                    const adminId = rows[0].id_user;

                                                                                                    const insertCompte = `
                                                                    INSERT INTO Comptes (id_user, nom, solde, type)
                                                                    VALUES (?, 'Compte principal', 0.00, 'courant')
                                                                    ON DUPLICATE KEY UPDATE id_user=id_user`;

                                                                                                    dbBudget.query(insertCompte, [adminId], (err, result) => {
                                                                                                        if (err) throw err;
                                                                                                        console.log("Compte admin par défaut créé");

                                                                                                        const compteId = result.insertId || 1;

                                                                                                        const insertPartage = `
                                                                        INSERT INTO Comptes_partages (id_compte, id_user, role)
                                                                        VALUES (?, ?, 'owner')
                                                                        ON DUPLICATE KEY UPDATE role=role`;

                                                                                                        dbBudget.query(insertPartage, [compteId, adminId], (err) => {
                                                                                                            if (err) throw err;
                                                                                                            console.log("Admin ajouté dans Comptes_partages (owner)");
                                                                                                            process.exit();
                                                                                                        });
                                                                                                    });
                                                                                                });
                                                                                            });
                                                                                        });
                                                                                    });
                                                                                });
                                                                            });
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                    dbBudget.query(createContributionsTable, (err) => {
                                                        if (err) throw err;
                                                        console.log('Table Contributions OK');
                                                    });

                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
});
