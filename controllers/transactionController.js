const Transactions = require('../models/transactionModel')

const TransactionController = {
    // Récupérer toutes les transactions d'un utilisateur
    getAll: (req, res) => {
        const id_user = req.user?.id_user;
        if (!id_user) return res.status(401).json({ message: "Non autorisé" });
    const filterUserId = req.query?.id_user ? Number(req.query.id_user) : null
    Transactions.getAllTransaction(id_user, filterUserId, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }       
};
module.exports = TransactionController;