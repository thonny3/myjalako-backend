const mysql = require('mysql2');
const { promisify } = require('util');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'jalako'
});

const query = promisify(db.query.bind(db));

async function repairTable(tableName) {
    try {
        console.log(`\n🔧 Réparation de la table ${tableName}...\n`);
        
        // Vérifier l'état de la table avant réparation
        const checkBefore = await query(`CHECK TABLE ${tableName}`);
        console.log('📊 État de la table avant réparation:');
        checkBefore.forEach(result => {
            console.log(`   ${result.Msg_type.toUpperCase()}: ${result.Msg_text}`);
            if (result.Msg_type === 'warning' && result.Msg_text.includes('clients are using')) {
                console.log('   ⚠️  Note: Des connexions actives détectées. Cela est normal si le serveur est en cours d\'exécution.');
            }
        });
        
        // Réparer la table
        console.log('\n🔨 Réparation en cours...');
        const repairResults = await query(`REPAIR TABLE ${tableName}`);
        console.log('📋 Résultats de la réparation:');
        repairResults.forEach(result => {
            console.log(`   ${result.Msg_type.toUpperCase()}: ${result.Msg_text}`);
            if (result.Msg_text.includes('Wrong bytesec') || result.Msg_text.includes('Skipped')) {
                console.log('   ℹ️  Ce message indique que des erreurs de corruption ont été corrigées.');
            }
        });
        
        // Attendre un peu pour que la réparation se finalise
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Vérifier à nouveau l'état après réparation
        console.log('\n✅ Vérification après réparation...');
        const checkAfter = await query(`CHECK TABLE ${tableName}`);
        let isRepaired = false;
        
        checkAfter.forEach(result => {
            console.log(`   ${result.Msg_type.toUpperCase()}: ${result.Msg_text}`);
            if (result.Msg_type === 'status' && result.Msg_text === 'OK') {
                isRepaired = true;
            }
        });
        
        // Afficher le résultat final
        console.log('\n' + '='.repeat(50));
        if (isRepaired) {
            console.log(`✅ SUCCÈS: La table ${tableName} a été réparée avec succès!`);
            console.log('   Vous pouvez maintenant utiliser l\'application normalement.');
        } else {
            console.log(`⚠️  ATTENTION: La vérification finale n'a pas confirmé le succès.`);
            console.log('   Vérifiez les messages ci-dessus pour plus de détails.');
        }
        console.log('='.repeat(50) + '\n');
        
    } catch (error) {
        console.error(`\n❌ ERREUR lors de la réparation de ${tableName}:`, error.message);
        console.error('   Détails:', error);
        console.log('\n💡 Essayez de fermer toutes les connexions à la base de données et réessayez.');
    } finally {
        db.end();
    }
}

// Réparer la table Comptes
repairTable('Comptes');

