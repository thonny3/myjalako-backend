const express = require('express')
const router = express.Router()
const AiController = require('../controllers/aiController')

router.get('/insights', AiController.insights)
router.get('/predict', AiController.predict)
router.get('/recommendations', AiController.recommendations)
router.post('/chat', AiController.chat)

module.exports = router


