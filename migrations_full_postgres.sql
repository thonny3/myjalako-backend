BEGIN;

-- =========================
-- Core users/auth tables
-- =========================

CREATE TABLE IF NOT EXISTS users (
    id_user BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    mot_de_passe TEXT,
    devise VARCHAR(10) DEFAULT 'MGA',
    image VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    actif BOOLEAN DEFAULT TRUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS passwordresets (
    id BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Accounts/sharing tables
-- =========================

CREATE TABLE IF NOT EXISTS comptes (
    id_compte BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    nom VARCHAR(100),
    solde NUMERIC(12,2) DEFAULT 0.00,
    type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS comptes_partages (
    id BIGSERIAL PRIMARY KEY,
    id_compte BIGINT NOT NULL REFERENCES comptes(id_compte) ON DELETE CASCADE,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    role VARCHAR(20),
    UNIQUE (id_compte, id_user)
);

-- =========================
-- Categories tables
-- =========================

CREATE TABLE IF NOT EXISTS categories_revenus (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS categories_depenses (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100)
);

-- =========================
-- Revenues/expenses/budgets
-- =========================

CREATE TABLE IF NOT EXISTS revenus (
    id_revenu BIGSERIAL PRIMARY KEY,
    id_user BIGINT REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2),
    date_revenu DATE,
    source TEXT,
    id_categorie_revenu BIGINT REFERENCES categories_revenus(id),
    id_compte BIGINT REFERENCES comptes(id_compte)
);

CREATE TABLE IF NOT EXISTS depenses (
    id_depense BIGSERIAL PRIMARY KEY,
    id_user BIGINT REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2),
    date_depense DATE,
    description TEXT,
    id_categorie_depense BIGINT REFERENCES categories_depenses(id),
    id_compte BIGINT REFERENCES comptes(id_compte)
);

CREATE TABLE IF NOT EXISTS budgets (
    id_budget BIGSERIAL PRIMARY KEY,
    id_user BIGINT REFERENCES users(id_user) ON DELETE CASCADE,
    id_categorie_depense BIGINT REFERENCES categories_depenses(id),
    mois VARCHAR(20),
    montant_max NUMERIC(12,2),
    montant_restant NUMERIC(12,2)
);

-- =========================
-- Goals/contributions/transfers
-- =========================

CREATE TABLE IF NOT EXISTS objectifs (
    id_objectif BIGSERIAL PRIMARY KEY,
    id_user BIGINT REFERENCES users(id_user) ON DELETE CASCADE,
    nom VARCHAR(100),
    montant_objectif NUMERIC(12,2),
    date_limite DATE,
    montant_actuel NUMERIC(12,2) DEFAULT 0,
    statut VARCHAR(50) DEFAULT 'en cours',
    pourcentage NUMERIC(5,2) DEFAULT 0,
    icone VARCHAR(100),
    couleur VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS contributions (
    id_contribution BIGSERIAL PRIMARY KEY,
    id_objectif BIGINT NOT NULL REFERENCES objectifs(id_objectif) ON DELETE CASCADE,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2) NOT NULL,
    date_contribution DATE NOT NULL,
    id_compte BIGINT REFERENCES comptes(id_compte)
);

CREATE TABLE IF NOT EXISTS transfertshistorique (
    id BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    id_compte_source BIGINT REFERENCES comptes(id_compte),
    id_compte_cible BIGINT REFERENCES comptes(id_compte),
    id_objectif_source BIGINT REFERENCES objectifs(id_objectif),
    id_objectif_cible BIGINT REFERENCES objectifs(id_objectif),
    montant NUMERIC(12,2) NOT NULL,
    date_transfert TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Subscriptions/alerts
-- =========================

CREATE TABLE IF NOT EXISTS abonnements (
    id_abonnement BIGSERIAL PRIMARY KEY,
    id_user BIGINT REFERENCES users(id_user) ON DELETE CASCADE,
    nom VARCHAR(100),
    montant NUMERIC(12,2),
    frequence VARCHAR(20),
    prochaine_echeance DATE,
    rappel BOOLEAN DEFAULT FALSE,
    actif BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS alertes (
    id_alerte BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    type_alerte VARCHAR(60) NOT NULL,
    message TEXT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_declenchement TIMESTAMP,
    lue BOOLEAN DEFAULT FALSE,
    parametres_specifiques JSONB
);

CREATE TABLE IF NOT EXISTS alertthresholds (
    id BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    domain VARCHAR(30) NOT NULL,
    value NUMERIC(12,2) NOT NULL,
    info TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_user, domain)
);

-- =========================
-- Debts/investments
-- =========================

CREATE TABLE IF NOT EXISTS dettes (
    id_dette BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    nom VARCHAR(200) NOT NULL,
    montant_initial NUMERIC(12,2) NOT NULL,
    montant_restant NUMERIC(12,2) NOT NULL,
    taux_interet NUMERIC(6,2) DEFAULT 0,
    date_debut DATE NOT NULL,
    date_fin_prevue DATE,
    paiement_mensuel NUMERIC(12,2) DEFAULT 0,
    creancier VARCHAR(200),
    sens VARCHAR(10) DEFAULT 'autre',
    statut VARCHAR(50) DEFAULT 'en cours',
    type VARCHAR(50) DEFAULT 'personne',
    id_compte BIGINT REFERENCES comptes(id_compte)
);

CREATE TABLE IF NOT EXISTS remboursements (
    id_remboursement BIGSERIAL PRIMARY KEY,
    id_dette BIGINT NOT NULL REFERENCES dettes(id_dette) ON DELETE CASCADE,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2) NOT NULL,
    date_paiement DATE NOT NULL,
    id_compte BIGINT REFERENCES comptes(id_compte)
);

CREATE TABLE IF NOT EXISTS investissements (
    id_investissement BIGSERIAL PRIMARY KEY,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    nom VARCHAR(200) NOT NULL,
    type VARCHAR(50) DEFAULT 'immobilier',
    projet VARCHAR(255),
    date_achat DATE NOT NULL,
    montant_investi NUMERIC(12,2) NOT NULL,
    valeur_actuelle NUMERIC(12,2),
    duree_mois INT,
    taux_prevu NUMERIC(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS investissements_revenus (
    id BIGSERIAL PRIMARY KEY,
    id_investissement BIGINT NOT NULL REFERENCES investissements(id_investissement) ON DELETE CASCADE,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2) NOT NULL,
    date_revenu DATE NOT NULL,
    type VARCHAR(50),
    note TEXT,
    id_compte BIGINT REFERENCES comptes(id_compte),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS investissements_depenses (
    id BIGSERIAL PRIMARY KEY,
    id_investissement BIGINT NOT NULL REFERENCES investissements(id_investissement) ON DELETE CASCADE,
    id_user BIGINT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    montant NUMERIC(12,2) NOT NULL,
    date_depense DATE NOT NULL,
    type VARCHAR(50),
    note TEXT,
    id_compte BIGINT REFERENCES comptes(id_compte),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Useful indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_comptes_user ON comptes(id_user);
CREATE INDEX IF NOT EXISTS idx_revenus_user_date ON revenus(id_user, date_revenu);
CREATE INDEX IF NOT EXISTS idx_depenses_user_date ON depenses(id_user, date_depense);
CREATE INDEX IF NOT EXISTS idx_objectifs_user ON objectifs(id_user);
CREATE INDEX IF NOT EXISTS idx_abonnements_user ON abonnements(id_user);
CREATE INDEX IF NOT EXISTS idx_alertes_user_lue ON alertes(id_user, lue);
CREATE INDEX IF NOT EXISTS idx_dettes_user ON dettes(id_user);
CREATE INDEX IF NOT EXISTS idx_passwordresets_token ON passwordresets(token);

-- =========================
-- Default categories seed
-- =========================

INSERT INTO categories_revenus (nom)
VALUES
  ('Salaire'),
  ('Prime'),
  ('Freelance / Mission'),
  ('Investissements'),
  ('Dividendes'),
  ('Ventes / Revente'),
  ('Cadeaux / Héritage'),
  ('Autres revenus')
ON CONFLICT DO NOTHING;

INSERT INTO categories_depenses (nom)
VALUES
  ('Logement'),
  ('Transport'),
  ('Alimentation'),
  ('Santé'),
  ('Éducation'),
  ('Divertissement'),
  ('Voyages'),
  ('Autres')
ON CONFLICT DO NOTHING;

COMMIT;

