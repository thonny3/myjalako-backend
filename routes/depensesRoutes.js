const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const DepensesController = require('../controllers/depensesController');

// Configuration multer pour upload d'images de reçus
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtrer les images et PDFs
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedImages = /jpeg|jpg|png|gif|webp/;
  const allowedPDFs = /pdf/;
  
  const isImage = allowedImages.test(ext) && allowedImages.test(file.mimetype);
  const isPDF = allowedPDFs.test(ext) || file.mimetype === 'application/pdf';

  if (isImage || isPDF) {
    return cb(null, true);
  } else {
    cb(new Error('Seules les images (JPEG, JPG, PNG, GIF, WEBP) et les PDFs sont autorisées'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max (augmenté pour les PDFs)
  fileFilter: fileFilter
});

// Routes existantes
router.get('/', DepensesController.getAll);
router.post('/', DepensesController.add);
router.put('/:id_depense', DepensesController.update);
router.delete('/:id_depense', DepensesController.delete);

// Routes OCR
router.post('/scan-receipt', upload.single('image'), DepensesController.scanReceipt);
router.post('/from-receipt', upload.single('image'), DepensesController.addFromReceipt);
router.post('/bulk-from-receipt', upload.single('image'), DepensesController.bulkCreateFromReceipt);

module.exports = router;
