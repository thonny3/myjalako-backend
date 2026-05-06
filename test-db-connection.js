// Script de test de connexion à la base de données
const db = require('./config/db');

console.log('🔍 Test de connexion à la base de données...');

// Test 1: Vérifier la connexion
db.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err);
    process.exit(1);
  } else {
    console.log('✅ Connexion à la base de données réussie');
    
    // Test 2: Vérifier les tables
    const tables = [
      'Users',
      'Comptes', 
      'Categories',
      'Depenses',
      'Revenus',
      'Transactions',
      'Budgets',
      'Objectifs'
    ];
    
    let completedTests = 0;
    
    tables.forEach((table) => {
      const query = `SHOW TABLES LIKE '${table}'`;
      db.query(query, (err, results) => {
        if (err) {
          console.error(`❌ Erreur lors de la vérification de la table ${table}:`, err);
        } else if (results.length > 0) {
          console.log(`✅ Table ${table} existe`);
        } else {
          console.log(`⚠️ Table ${table} n'existe pas`);
        }
        
        completedTests++;
        if (completedTests === tables.length) {
          // Test 3: Vérifier les utilisateurs
          console.log('\n🔍 Test des utilisateurs...');
          db.query('SELECT COUNT(*) as count FROM Users', (err, results) => {
            if (err) {
              console.error('❌ Erreur lors du comptage des utilisateurs:', err);
            } else {
              console.log(`✅ Nombre d'utilisateurs: ${results[0].count}`);
            }
            
            // Test 4: Vérifier un utilisateur de test
            console.log('\n🔍 Test de récupération d\'utilisateur...');
            db.query('SELECT * FROM Users LIMIT 1', (err, results) => {
              if (err) {
                console.error('❌ Erreur lors de la récupération des utilisateurs:', err);
              } else if (results.length > 0) {
                console.log('✅ Utilisateur trouvé:', {
                  id: results[0].id_user,
                  nom: results[0].nom,
                  email: results[0].email,
                  actif: results[0].actif
                });
              } else {
                console.log('⚠️ Aucun utilisateur trouvé dans la base de données');
              }
              
              console.log('\n🏁 Tests de base de données terminés');
              db.end();
            });
          });
        }
      });
    });
  }
});
