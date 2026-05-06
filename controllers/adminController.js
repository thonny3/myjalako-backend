const db = require('../config/db');

const AdminController = {
  // Statistiques générales pour les administrateurs
  getStats: async (req, res) => {
    try {
      const id_user = req.user?.id_user;
      if (!id_user) return res.status(401).json({ message: 'Non autorisé' });

      // Vérifier que l'utilisateur est admin
      const userRoleQuery = 'SELECT role FROM Users WHERE id_user = ?';
      const userRole = await new Promise((resolve, reject) => {
        db.query(userRoleQuery, [id_user], (err, rows) => {
          if (err) return reject(err);
          resolve(rows?.[0]?.role);
        });
      });

      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
      }

      // Requêtes pour les statistiques admin
      const queries = {
        // Statistiques utilisateurs
        totalUsers: 'SELECT COUNT(*) AS count FROM Users',
        activeUsers: 'SELECT COUNT(*) AS count FROM Users WHERE actif = 1',
        inactiveUsers: 'SELECT COUNT(*) AS count FROM Users WHERE actif = 0',
        usersByRole: 'SELECT role, COUNT(*) AS count FROM Users GROUP BY role',
        
        // Statistiques catégories
        totalCategoriesDepenses: 'SELECT COUNT(*) AS count FROM categories_depenses',
        totalCategoriesRevenus: 'SELECT COUNT(*) AS count FROM categories_revenus',
        
        // Utilisateurs récents (5 derniers)
        recentUsers: `
          SELECT id_user, nom, prenom, email, role, actif, date_creation 
          FROM Users 
          ORDER BY date_creation DESC 
          LIMIT 5
        `,
        
        // Statistiques globales de la plateforme
        totalRevenus: 'SELECT COALESCE(SUM(montant), 0) AS total FROM Revenus',
        totalDepenses: 'SELECT COALESCE(SUM(montant), 0) AS total FROM Depenses',
        totalComptes: 'SELECT COUNT(*) AS count FROM Comptes',
        totalObjectifs: 'SELECT COUNT(*) AS count FROM Objectifs'
      };

      const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

      // Exécuter toutes les requêtes en parallèle
      const [
        totalUsersRows,
        activeUsersRows,
        inactiveUsersRows,
        usersByRoleRows,
        totalCategoriesDepensesRows,
        totalCategoriesRevenusRows,
        recentUsersRows,
        totalRevenusRows,
        totalDepensesRows,
        totalComptesRows,
        totalObjectifsRows
      ] = await Promise.all([
        run(queries.totalUsers),
        run(queries.activeUsers),
        run(queries.inactiveUsers),
        run(queries.usersByRole),
        run(queries.totalCategoriesDepenses),
        run(queries.totalCategoriesRevenus),
        run(queries.recentUsers),
        run(queries.totalRevenus),
        run(queries.totalDepenses),
        run(queries.totalComptes),
        run(queries.totalObjectifs)
      ]);

      // Traitement des données
      const totalUsers = Number(totalUsersRows?.[0]?.count || 0);
      const activeUsers = Number(activeUsersRows?.[0]?.count || 0);
      const inactiveUsers = Number(inactiveUsersRows?.[0]?.count || 0);
      const totalCategoriesDepenses = Number(totalCategoriesDepensesRows?.[0]?.count || 0);
      const totalCategoriesRevenus = Number(totalCategoriesRevenusRows?.[0]?.count || 0);
      const totalCategories = totalCategoriesDepenses + totalCategoriesRevenus;

      // Traitement des utilisateurs par rôle
      const usersByRole = {};
      if (Array.isArray(usersByRoleRows)) {
        usersByRoleRows.forEach(row => {
          usersByRole[row.role || 'user'] = Number(row.count || 0);
        });
      }

      // Traitement des utilisateurs récents
      const recentUsers = Array.isArray(recentUsersRows) 
        ? recentUsersRows.map(user => ({
            id_user: user.id_user,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role,
            actif: user.actif,
            date_creation: user.date_creation
          }))
        : [];

      // Statistiques globales
      const totalRevenus = Number(totalRevenusRows?.[0]?.total || 0);
      const totalDepenses = Number(totalDepensesRows?.[0]?.total || 0);
      const totalComptes = Number(totalComptesRows?.[0]?.count || 0);
      const totalObjectifs = Number(totalObjectifsRows?.[0]?.count || 0);

      const payload = {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalCategoriesDepenses,
        totalCategoriesRevenus,
        totalCategories,
        usersByRole,
        recentUsers,
        // Statistiques globales supplémentaires
        totalRevenus,
        totalDepenses,
        totalComptes,
        totalObjectifs,
        // Calculs dérivés
        userActivationRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        platformBalance: totalRevenus - totalDepenses
      };

      res.json(payload);
    } catch (error) {
      console.error('Erreur dans getStats:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des statistiques admin', 
        error: error.message 
      });
    }
  },

  // Récupérer la liste complète des utilisateurs (pour l'admin)
  getAllUsers: async (req, res) => {
    try {
      const id_user = req.user?.id_user;
      if (!id_user) return res.status(401).json({ message: 'Non autorisé' });

      // Vérifier que l'utilisateur est admin
      const userRoleQuery = 'SELECT role FROM Users WHERE id_user = ?';
      const userRole = await new Promise((resolve, reject) => {
        db.query(userRoleQuery, [id_user], (err, rows) => {
          if (err) return reject(err);
          resolve(rows?.[0]?.role);
        });
      });

      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
      }

      const query = `
        SELECT 
          id_user, 
          nom, 
          prenom, 
          email, 
          role, 
          actif, 
          date_creation,
          devise
        FROM Users 
        ORDER BY date_creation DESC
      `;

      db.query(query, [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des utilisateurs:', err);
          return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json(rows || []);
      });
    } catch (error) {
      console.error('Erreur dans getAllUsers:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des utilisateurs', 
        error: error.message 
      });
    }
  }
};

module.exports = AdminController;
