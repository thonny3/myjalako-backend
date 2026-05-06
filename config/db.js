const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'jalako'
});

db.connect(err => {
    if(err) console.log('Erreur connexion MySQL :', err);
    else console.log('Connecté à la base jalako');
});

module.exports = db;
