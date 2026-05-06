const https = require('https')
const crypto = require('crypto')

const MAX_CONCURRENT = Math.max(1, Number(process.env.GEMINI_MAX_CONCURRENCY || 2))
const MAX_RETRIES = Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 2))
const RETRY_BASE_DELAY_MS = Math.max(200, Number(process.env.GEMINI_RETRY_DELAY_MS || 500))
const CACHE_TTL_MS = Math.max(0, Number(process.env.GEMINI_CACHE_TTL_MS || 30000))

let activeRequests = 0
const pendingQueue = []
const responseCache = new Map()

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && pendingQueue.length > 0) {
    const next = pendingQueue.shift()
    if (typeof next === 'function') next()
  }
}

function scheduleTask(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRequests++
      try {
        const result = await task()
        resolve(result)
      } catch (err) {
        reject(err)
      } finally {
        activeRequests--
        process.nextTick(drainQueue)
      }
    }
    pendingQueue.push(run)
    process.nextTick(drainQueue)
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetriableError(err) {
  const message = String(err?.message || err || '').toLowerCase()
  if (!message) return false
  return (
    message.includes('503') ||
    message.includes('429') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable') ||
    message.includes('overloaded')
  )
}

async function callWithRetry(fn) {
  let attempt = 0
  let delay = RETRY_BASE_DELAY_MS
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetriableError(err)) {
        throw err
      }
      await wait(delay)
      attempt++
      delay *= 2
    }
  }
}

function makeCacheKey(message, context) {
  if (CACHE_TTL_MS === 0) return null
  const hash = crypto.createHash('sha1')
  hash.update(String(message || ''))
  hash.update('::')
  hash.update(String(context || ''))
  return hash.digest('hex')
}

function getCachedResponse(key) {
  if (!key) return null
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }
  return entry.value
}

function setCachedResponse(key, value) {
  if (!key || CACHE_TTL_MS === 0) return
  responseCache.set(key, { value, timestamp: Date.now() })
}

function postJson(urlString, jsonBody) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString)
      const payload = Buffer.from(JSON.stringify(jsonBody))
      const req = https.request({
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length
        }
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          const status = res.statusCode || 500
          if (status < 200 || status >= 300) {
            return reject(new Error(`Erreur Gemini ${status}: ${data}`))
          }
          try {
            const json = JSON.parse(data || '{}')
            resolve(json)
          } catch (e) {
            reject(new Error(`Réponse non JSON de Gemini: ${String(e?.message || e)}`))
          }
        })
      })
      req.on('error', reject)
      req.write(payload)
      req.end()
    } catch (e) {
      reject(e)
    }
  })
}

function getJson(urlString) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString)
      const req = https.request({
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          const status = res.statusCode || 500
          if (status < 200 || status >= 300) {
            return reject(new Error(`HTTP ${status}: ${data}`))
          }
          try {
            const json = JSON.parse(data || '{}')
            resolve(json)
          } catch (e) {
            reject(new Error(`Réponse non JSON: ${String(e?.message || e)}`))
          }
        })
      })
      req.on('error', reject)
      req.end()
    } catch (e) {
      reject(e)
    }
  })
}

function sanitizeInput(str, maxLen) {
  if (!str) return ''
  const s = String(str)
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen)
}

function buildRequestBody(message, context, overrides) {
  // Limit prompt size to avoid token limits
  const safeMessage = sanitizeInput(message, 1000)
  const safeContext = sanitizeInput(context, 4000) // Augmenté pour plus de contexte budgétaire
  const systemText = `Tu es l'assistant IA de l'application MyJalako, spécialisé dans la gestion de budget personnel.

TES CAPACITÉS:
- Analyser les budgets et dépenses de l'utilisateur
- Détecter les budgets dépassés ou en alerte
- Analyser les tendances budgétaires par catégorie
- Donner des conseils personnalisés basés sur les données réelles
- Expliquer l'évolution des dépenses dans le temps
- Suggérer des ajustements budgétaires

RÈGLES IMPORTANTES:
- Réponds toujours en français, de manière claire et professionnelle
- Utilise uniquement les données fournies dans le contexte - ne jamais inventer de données
- Si une information n'est pas disponible, dis-le clairement
- COMPORTEMENT CONVERSATIONNEL (CRITIQUE):
  * NE DONNE PAS de résumé automatique ou d'aperçu complet au début de la conversation
  * Réponds UNIQUEMENT à la question ou à la demande spécifique de l'utilisateur
  * Ne partage les données détaillées (budgets, dépenses, alertes) QUE si l'utilisateur les demande explicitement
  * Pour une simple salutation ou "bonjour", réponds simplement et demande comment tu peux aider
  * Sois concis et direct, ne surcharge pas l'utilisateur d'informations non demandées
- FORMATAGE DES MONTANTS (CRITIQUE):
  * TOUJOURS inclure la devise avec chaque montant mentionné
  * Format: "XXX.XX [DEVISE]" (exemple: "150.50 EUR", "250.75 USD", "1000.00 XAF")
  * La devise de l'utilisateur est fournie dans les données ("devise_utilisateur")
  * Ne JAMAIS mentionner un montant sans sa devise
- Pour les questions sur les budgets:
  * Analyse les données dans "budgets_analysis" qui contient résumés, alertes, tendances
  * Mentionne les budgets dépassés (statut: "depasse") ou en alerte (statut: "alerte") SEULEMENT si l'utilisateur demande
  * Utilise les tendances pour expliquer l'évolution
  * Fournis des conseils concrets basés sur les données réelles
  * Inclus toujours la devise avec tous les montants de budget
- Sois précis avec les montants et pourcentages
- Propose des actions concrètes lorsque c'est pertinent
- Formate tes réponses de manière claire et lisible:
  * Utilise des listes à puces (- ou •) pour les points importants
  * Sépare les paragraphes pour améliorer la lisibilité
  * Met en évidence les montants importants avec la devise
  * Utilise des retours à la ligne pour aérer le texte`

  const userParts = []
  if (safeContext && String(safeContext).trim().length > 0) {
    userParts.push({ text: `CONTEXTE UTILISATEUR (données de l'application):\n${safeContext}` })
  }
  userParts.push({ text: `QUESTION DE L'UTILISATEUR:\n${safeMessage}` })

  return {
    systemInstruction: { role: 'system', parts: [{ text: systemText }] },
    contents: [
      {
        role: 'user',
        parts: userParts
      }
    ],
    generationConfig: Object.assign({
      temperature: 0.3, // Réduit pour plus de précision sur les données budgétaires
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 2048 // Augmenté pour permettre des réponses plus détaillées
    }, overrides || {})
  }
}

async function executeGeminiCall(message, context) {
  if (!message || !String(message).trim()) {
    throw new Error('Message requis')
  }

  const apiKey = process.env.GEMINI_API_KEY
  const envUrl = process.env.GEMINI_API_URL
  const baseModel = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim()
  const candidates = []
  // 1) If explicit URL provided, ONLY try it
  if (envUrl && envUrl.includes('/models/')) {
    candidates.push(envUrl)
  } else {
    // 2) If a model is provided, try only that model (+ -latest) across v1beta then v1
    const models = new Set([
      baseModel,
      baseModel.endsWith('-latest') ? baseModel : `${baseModel}-latest`
    ])
    for (const m of models) candidates.push(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)
    for (const m of models) candidates.push(`https://generativelanguage.googleapis.com/v1/models/${m}:generateContent`)
  }

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY manquant dans les variables d\'environnement')
  }

  let body = buildRequestBody(message, context)
  let lastErr = null
  let usedUrl = ''
  let data
  const tried = []
  for (const endpoint of candidates) {
    const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`
    try {
      data = await callWithRetry(() => postJson(url, body))
      usedUrl = endpoint
      break
    } catch (e) {
      lastErr = e
      tried.push(endpoint)
      // continue trying next candidate on 404 or not supported
      const msg = String(e?.message || e)
      const retriable = msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported')
      if (!retriable) break
    }
  }
  if (!data) {
    // As a fallback, list available models and pick one that supports generateContent
    const listCandidates = [
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`
    ]
    let models = []
    for (const listUrl of listCandidates) {
      try {
        const resp = await getJson(listUrl)
        if (Array.isArray(resp?.models)) {
          models = resp.models
          break
        }
      } catch (_e) {}
    }
    if (models.length > 0) {
      // Prefer flash, then pro, ensure supports generateContent
      const supportsGen = (m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')
      const preferred = models
        .filter(supportsGen)
        .sort((a, b) => {
          const an = String(a.name || '')
          const bn = String(b.name || '')
          const ascore = an.includes('flash') ? 0 : an.includes('pro') ? 1 : 2
          const bscore = bn.includes('flash') ? 0 : bn.includes('pro') ? 1 : 2
          return ascore - bscore
        })[0]
      if (preferred?.name) {
        const endpoint = preferred.name.replace(/^models\//, '')
        const pick = preferred.name.includes('/v1/') ? 'v1' : 'v1beta'
        const finalUrl = `https://generativelanguage.googleapis.com/${pick}/models/${endpoint}:generateContent?key=${encodeURIComponent(apiKey)}`
        try {
          data = await callWithRetry(() => postJson(finalUrl, body))
          usedUrl = preferred.name
        } catch (e) {
          lastErr = e
        }
      }
    }
    if (!data) {
      const err = new Error(`${lastErr?.message || 'Appel Gemini impossible'} | tried: ${tried.join(', ')}`)
      throw err
    }
  }
  // Extract text (robust)
  let text = ''
  try {
    const parts = data?.candidates?.[0]?.content?.parts
    if (Array.isArray(parts) && parts.length > 0) {
      text = parts.map((p) => (p?.text || '')).filter(Boolean).join('\n').trim()
    }
    if (!text && typeof data?.candidates?.[0]?.content?.text === 'string') {
      text = data.candidates[0].content.text.trim()
    }
    if (!text && typeof data?.candidates?.[0]?.text === 'string') {
      text = data.candidates[0].text.trim()
    }
  } catch (_e) {}

  // Retry on MAX_TOKENS with adjusted config
  const finishOrBlock = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason
  if (!text && finishOrBlock === 'MAX_TOKENS') {
    try {
      const smaller = buildRequestBody(message, context, { maxOutputTokens: 2048, temperature: 0.3 })
      // Try again on the last successful or first candidate endpoint
      const endpointToUse = usedUrl || (Array.isArray(tried) && tried.length > 0 ? tried[0] : '')
      const url = `${endpointToUse}?key=${encodeURIComponent(apiKey)}`
      const again = endpointToUse ? await callWithRetry(() => postJson(url, smaller)) : null
      if (again) {
        const parts2 = again?.candidates?.[0]?.content?.parts
        if (Array.isArray(parts2) && parts2.length > 0) {
          text = parts2.map((p) => (p?.text || '')).filter(Boolean).join('\n').trim()
        }
        if (!text && typeof again?.candidates?.[0]?.text === 'string') {
          text = again.candidates[0].text.trim()
        }
      }
    } catch (_e2) {}
  }

  if (!text) {
    const block = finishOrBlock || 'no_text'
    return { text: '', raw: data, model: baseModel, apiUrl: usedUrl, meta: { blockReason: block } }
  }
  return { text, raw: data, model: baseModel, apiUrl: usedUrl }
}

async function chatWithGemini(message, context) {
  const cacheKey = makeCacheKey(message, context)
  const cached = getCachedResponse(cacheKey)
  if (cached) {
    return Object.assign({}, cached, { meta: Object.assign({}, cached.meta, { fromCache: true }) })
  }
  const result = await scheduleTask(() => executeGeminiCall(message, context))
  if (result?.text) {
    setCachedResponse(cacheKey, result)
  }
  return result
}

module.exports = { chatWithGemini }


