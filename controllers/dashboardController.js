const db = require('../config/db');

const DashboardController = {
  summary: async (req, res) => {
    try {
      const id_user = req.user?.id_user;
      if (!id_user) return res.status(401).json({ message: 'Non autorisé' });

      // Parallel queries for better latency
      const queries = {
        totalBalance: `SELECT COALESCE(SUM(solde),0) AS total FROM Comptes WHERE id_user = ?`,
        monthlyIncome: `SELECT COALESCE(SUM(montant),0) AS total FROM Revenus WHERE id_user = ? AND DATE_FORMAT(date_revenu,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')`,
        monthlyExpenses: `SELECT COALESCE(SUM(montant),0) AS total FROM Depenses WHERE id_user = ? AND DATE_FORMAT(date_depense,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')`,
        goalsAchieved: `SELECT COUNT(*) AS count FROM Objectifs WHERE id_user = ? AND montant_actuel >= montant_objectif`,
        revenueVsExpensesMonthly: `
          SELECT ym, 
                 SUM(CASE WHEN type='revenue' THEN total ELSE 0 END) AS revenue,
                 SUM(CASE WHEN type='expense' THEN total ELSE 0 END) AS expenses
          FROM (
            SELECT DATE_FORMAT(date_revenu,'%Y-%m') AS ym, SUM(montant) AS total, 'revenue' AS type
            FROM Revenus WHERE id_user = ?
            GROUP BY DATE_FORMAT(date_revenu,'%Y-%m')
            UNION ALL
            SELECT DATE_FORMAT(date_depense,'%Y-%m') AS ym, SUM(montant) AS total, 'expense' AS type
            FROM Depenses WHERE id_user = ?
            GROUP BY DATE_FORMAT(date_depense,'%Y-%m')
          ) t
          GROUP BY ym
          ORDER BY ym ASC
        `,
        topExpenseCategories: `
          SELECT c.nom AS name, COALESCE(SUM(d.montant),0) AS value
          FROM Depenses d
          LEFT JOIN categories_depenses c ON c.id = d.id_categorie_depense
          WHERE d.id_user = ? AND DATE_FORMAT(d.date_depense,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
          GROUP BY c.nom
          ORDER BY value DESC
          LIMIT 6
        `,
        recentTransactions: `
          SELECT 'income' AS kind, r.source AS label, r.montant AS amount, r.date_revenu AS date
          FROM Revenus r WHERE r.id_user = ?
          UNION ALL
          SELECT 'expense' AS kind, d.description AS label, d.montant AS amount, d.date_depense AS date
          FROM Depenses d WHERE d.id_user = ?
          ORDER BY date DESC
          LIMIT 10
        `,
        debtSnapshot: `
          SELECT 
            COUNT(*) AS totalDettes,
            SUM(CASE WHEN statut = 'terminé' THEN 1 ELSE 0 END) AS dettesTerminees,
            SUM(CASE WHEN statut = 'en retard' THEN 1 ELSE 0 END) AS dettesEnRetard,
            SUM(CASE WHEN (statut NOT IN ('terminé') OR statut IS NULL) THEN 1 ELSE 0 END) AS dettesActives,
            COALESCE(SUM(montant_initial),0) AS montantInitialTotal,
            COALESCE(SUM(montant_restant),0) AS montantRestantTotal
          FROM Dettes
          WHERE id_user = ?
        `,
        subscriptionSnapshot: `
          SELECT 
            COUNT(*) AS totalAbonnements,
            SUM(CASE WHEN (actif IS NULL OR actif = 1) THEN 1 ELSE 0 END) AS abonnementsActifs,
            SUM(CASE WHEN actif = 0 THEN 1 ELSE 0 END) AS abonnementsInactifs,
            COALESCE(SUM(CASE WHEN (actif IS NULL OR actif = 1) THEN montant ELSE 0 END),0) AS coutMensuelActif
          FROM Abonnements
          WHERE id_user = ?
        `,
        subscriptionByFrequency: `
          SELECT 
            LOWER(COALESCE(\`fréquence\`, frequence, 'mensuel')) AS freq,
            COALESCE(SUM(montant),0) AS total
          FROM Abonnements
          WHERE id_user = ? AND (actif IS NULL OR actif = 1)
          GROUP BY freq
        `,
        budgetUsage: `
          SELECT 
            b.id_budget,
            COALESCE(c.nom, 'Sans catégorie') AS categorie,
            LEFT(b.mois, 7) AS mois,
            COALESCE(b.montant_max,0) AS montant_max,
            COALESCE(b.montant_restant,0) AS montant_restant,
            (
              SELECT COALESCE(SUM(d.montant),0)
              FROM Depenses d
              WHERE d.id_user = b.id_user
                AND d.id_categorie_depense = b.id_categorie_depense
                AND DATE_FORMAT(d.date_depense,'%Y-%m') = LEFT(b.mois,7)
            ) AS montant_depense
          FROM Budgets b
          LEFT JOIN categories_depenses c ON c.id = b.id_categorie_depense
          WHERE b.id_user = ?
          ORDER BY b.mois DESC, b.id_budget DESC
          LIMIT 4
        `
      };

      const run = (sql, params) => new Promise((resolve) => {
        db.query(sql, params, (err, rows) => {
          if (err) return resolve({ error: err.message || String(err) });
          resolve(rows);
        });
      });

      const [
        totalBalanceRows,
        monthlyIncomeRows,
        monthlyExpensesRows,
        goalsAchievedRows,
        rveRows,
        topCatsRows,
        recentTxRows,
        debtSnapshotRows,
        subscriptionSnapshotRows,
        subscriptionFrequencyRows,
        budgetUsageRows
      ] = await Promise.all([
        run(queries.totalBalance, [id_user]),
        run(queries.monthlyIncome, [id_user]),
        run(queries.monthlyExpenses, [id_user]),
        run(queries.goalsAchieved, [id_user]),
        run(queries.revenueVsExpensesMonthly, [id_user, id_user]),
        run(queries.topExpenseCategories, [id_user]),
        run(queries.recentTransactions, [id_user, id_user]),
        run(queries.debtSnapshot, [id_user]),
        run(queries.subscriptionSnapshot, [id_user]),
        run(queries.subscriptionByFrequency, [id_user]),
        run(queries.budgetUsage, [id_user])
      ]);

      const safeNum = (rows, key) => {
        const n = Number(rows?.[0]?.[key] || 0);
        return Number.isFinite(n) ? n : 0;
        };

      const revenueData = Array.isArray(rveRows)
        ? rveRows.map(r => ({ month: r.ym, revenue: Number(r.revenue || 0), expenses: Number(r.expenses || 0) }))
        : [];

      const expenseCategories = Array.isArray(topCatsRows)
        ? topCatsRows.map((r, idx) => ({ name: r.name || 'Autres', value: Number(r.value || 0), color: ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'][idx % 6] }))
        : [];

      const recentTransactions = Array.isArray(recentTxRows)
        ? recentTxRows.map(r => ({ type: r.kind === 'income' ? 'income' : 'expense', name: r.label || '', amount: Number(r.amount || 0), date: r.date }))
        : [];

      const debtRaw = debtSnapshotRows?.[0] || {};
      const debtOverview = {
        total: Number(debtRaw.totalDettes || 0),
        active: Number(debtRaw.dettesActives || 0),
        overdue: Number(debtRaw.dettesEnRetard || 0),
        completed: Number(debtRaw.dettesTerminees || 0),
        initialTotal: Number(debtRaw.montantInitialTotal || 0),
        remainingTotal: Number(debtRaw.montantRestantTotal || 0)
      };

      const subRaw = subscriptionSnapshotRows?.[0] || {};
      const subscriptionOverview = {
        total: Number(subRaw.totalAbonnements || 0),
        active: Number(subRaw.abonnementsActifs || 0),
        inactive: Number(subRaw.abonnementsInactifs || 0),
        activeMonthlyCost: Number(subRaw.coutMensuelActif || 0)
      };

      const subscriptionFrequency = Array.isArray(subscriptionFrequencyRows)
        ? subscriptionFrequencyRows.map((row) => ({
            name: row?.freq || 'mensuel',
            value: Number(row?.total || 0)
          }))
        : [];

      const budgetOverview = Array.isArray(budgetUsageRows)
        ? budgetUsageRows.map((row) => {
            const max = Number(row?.montant_max || 0);
            const spent = Number(row?.montant_depense || 0);
            const remaining = Math.max(max - spent, 0);
            const percent = max > 0 ? Math.min(100, (spent / max) * 100) : 0;
            return {
              id: row?.id_budget,
              category: row?.categorie || 'Budget',
              month: row?.mois || '',
              limit: max,
              spent,
              remaining,
              percent
            };
          })
        : [];

      const payload = {
        totalBalance: safeNum(totalBalanceRows, 'total'),
        monthlyIncome: safeNum(monthlyIncomeRows, 'total'),
        monthlyExpenses: safeNum(monthlyExpensesRows, 'total'),
        goalsAchieved: Number(goalsAchievedRows?.[0]?.count || 0),
        revenueData,
        expenseCategories,
        recentTransactions,
        debtOverview,
        subscriptionOverview,
        subscriptionFrequency,
        budgetOverview
      };

      res.json(payload);
    } catch (e) {
      res.status(500).json({ message: 'Erreur résumé tableau de bord', error: String(e?.message || e) });
    }
  }
};

module.exports = DashboardController;


