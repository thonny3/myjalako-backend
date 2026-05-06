const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/auth');
const multer = require('multer');

// Config multer pour upload images
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// Middleware pour parser JSON
router.use(express.json());

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.post('/forgot-password-otp', userController.forgotPasswordOtp);
router.post('/reset-password-otp', userController.resetPasswordWithOtp);

// Routes protégées
router.get('/verify', auth, userController.verify);
router.get('/search', auth, userController.searchUsers); // Recherche d'utilisateurs (autocomplétion)
router.get('/', auth, isAdmin, userController.getAllUsers);
router.get('/:id', auth, userController.getUser);
router.put('/:id', auth, isAdmin, upload.single('image'), userController.updateUser);
router.delete('/:id', auth, isAdmin, userController.deleteUser);

// Changer le mot de passe (utilisateur authentifié)
router.post('/change-password', auth, userController.changePassword);

module.exports = router;
