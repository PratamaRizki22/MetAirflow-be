const express = require('express');
const router = express.Router();
const agreementsController = require('./agreements.controller');
const { auth } = require('../../middleware/auth');
const multer = require('multer');

// Configure multer for temp file upload
const upload = multer({ dest: 'uploads/' });

router.post('/extract', auth, upload.single('file'), agreementsController.extractText);
router.post('/analyze', auth, agreementsController.analyze);
router.post('/ask', auth, agreementsController.ask);

module.exports = router;
