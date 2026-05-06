const db = require('../config/db')
const Abonnements = require('../models/abonnementModel')

const DAY_IN_MS = 24 * 60 * 60 * 1000
const MAX_CATCHUP_CYCLES = 12

const fetchAutoRenewCandidates = () => {
  return new Promise((resolve) => {
    const sql = `
      SELECT id_abonnement, id_user, id_compte, prochaine_echeance
      FROM Abonnements
      WHERE (auto_renouvellement = 1 OR auto_renouvellement = TRUE)
        AND (actif IS NULL OR actif = 1)
        AND prochaine_echeance <= CURDATE()
    `
    db.query(sql, [], (err, rows) => {
      if (err) {
        console.error('[autoRenew] Failed to fetch candidates:', err.message || err)
        return resolve([])
      }
      resolve(Array.isArray(rows) ? rows : [])
    })
  })
}

const renewOneCycle = (candidate) => {
  return new Promise((resolve) => {
    Abonnements.renew(
      candidate.id_user,
      { id_abonnement: candidate.id_abonnement, id_compte: candidate.id_compte },
      (err, result) => {
        if (err) {
          console.warn(
            `[autoRenew] Renew failed for abonnement ${candidate.id_abonnement}:`,
            err.message || err
          )
          return resolve({ success: false, error: err })
        }
        resolve({ success: true, prochaine_echeance: result?.prochaine_echeance })
      }
    )
  })
}

const renewUntilCaughtUp = async (candidate) => {
  const today = new Date()
  let nextDue = new Date(candidate.prochaine_echeance)
  let cycles = 0

  while (!Number.isNaN(nextDue.getTime()) && nextDue <= today && cycles < MAX_CATCHUP_CYCLES) {
    const result = await renewOneCycle(candidate)
    if (!result.success) return result
    cycles += 1

    if (result.prochaine_echeance) {
      nextDue = new Date(result.prochaine_echeance)
      candidate.prochaine_echeance = result.prochaine_echeance
    } else {
      nextDue.setMonth(nextDue.getMonth() + 1)
      candidate.prochaine_echeance = nextDue.toISOString().slice(0, 10)
    }
  }

  return { success: true, cycles }
}

const runAutoRenewals = async () => {
  const candidates = await fetchAutoRenewCandidates()
  if (!candidates.length) return { processed: 0, renewed: 0 }

  let renewed = 0
  for (const candidate of candidates) {
    if (!candidate.id_compte) {
      console.warn(
        `[autoRenew] Skipping abonnement ${candidate.id_abonnement}: no account linked`
      )
      continue
    }

    const result = await renewUntilCaughtUp(candidate)
    if (result.success) renewed += 1
  }

  console.log(`[autoRenew] Cycle finished. Processed=${candidates.length} Renewed=${renewed}`)
  return { processed: candidates.length, renewed }
}

const scheduleAutoRenewals = (options = {}) => {
  const intervalMs = options.intervalMs || DAY_IN_MS

  const execute = () => {
    runAutoRenewals().catch((err) => {
      console.error('[autoRenew] Unexpected error during cycle:', err)
    })
  }

  // run once at startup (after small delay to ensure DB ready)
  setTimeout(execute, options.initialDelayMs || 10_000)
  setInterval(execute, intervalMs)
}

module.exports = {
  runAutoRenewals,
  scheduleAutoRenewals
}


