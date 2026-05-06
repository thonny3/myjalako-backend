const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

async function testRegister() {
  console.log('🧪 Test de l\'endpoint d\'inscription...\n');

  try {
    // Test 1: Ping du serveur
    console.log('1. Test de connectivité...');
    const pingResponse = await axios.get(`${API_BASE_URL}/ping`);
    console.log('✅ Serveur accessible:', pingResponse.data.message);

    // Test 2: Inscription avec des données valides
    console.log('\n2. Test d\'inscription avec des données valides...');
    const registerData = {
      nom: 'User',
      prenom: 'Test',
      email: 'test@example.com',
      password: 'password123',
      currency: 'EUR'
    };

    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, registerData);
      console.log('✅ Inscription réussie:', registerResponse.data.message);
      console.log('   Utilisateur créé:', registerResponse.data.user);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️  Email déjà utilisé (normal si test précédent réussi)');
      } else {
        throw error;
      }
    }

    // Test 3: Test avec des données invalides
    console.log('\n3. Test avec des données invalides...');
    const invalidData = {
      nom: '',
      prenom: '',
      email: 'invalid-email',
      password: '123',
      currency: ''
    };

    try {
      await axios.post(`${API_BASE_URL}/auth/register`, invalidData);
      console.log('❌ Erreur: L\'inscription aurait dû échouer');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Validation fonctionne:', error.response.data.message);
      } else {
        console.log('❌ Erreur inattendue:', error.response?.data);
      }
    }

    // Test 4: Test de connexion
    console.log('\n4. Test de connexion...');
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData);
      console.log('✅ Connexion réussie:', loginResponse.data.message);
      console.log('   Token reçu:', loginResponse.data.token ? 'Oui' : 'Non');
    } catch (error) {
      console.log('❌ Erreur de connexion:', error.response?.data);
    }

    console.log('\n🎉 Tests terminés!');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Assurez-vous que le serveur backend est démarré sur le port 3001');
    }
  }
}

// Exécuter les tests
testRegister();
