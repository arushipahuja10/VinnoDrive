// backend/src/routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const apiLimiter = require('../middleware/rateLimitMiddleware'); // <--- NEW
const { authenticateToken } = require('../middleware/authMiddleware');
const { 
  uploadFile, getUserFiles, getAllPublicFiles, downloadFile, previewFile, 
  togglePublic, deleteFile, restoreFile, getStorageStats, createFolder, // <--- NEW
  moveFile, downloadFolder // <--- NEW IMPORTS
} = require('../controllers/fileController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Apply Rate Limit to all routes
router.use(apiLimiter);

router.post('/upload', authenticateToken, upload.single('file'), uploadFile);
router.post('/folders', authenticateToken, createFolder); // <--- NEW Route
router.get('/files', authenticateToken, getUserFiles);
router.get('/files/public', authenticateToken, getAllPublicFiles);
router.get('/stats', authenticateToken, getStorageStats);

router.get('/files/:id/download', authenticateToken, downloadFile);
router.get('/files/:id/preview', authenticateToken, previewFile);
router.put('/files/:id/move', authenticateToken, moveFile); // <--- Drag & Drop Route
router.get('/folders/:id/download', authenticateToken, downloadFolder); // <--- Zip Download Route
router.get('/shared/:id', downloadFile); 

router.put('/files/:id/share', authenticateToken, togglePublic);
router.put('/files/:id/restore', authenticateToken, restoreFile);
router.delete('/files/:id', authenticateToken, deleteFile);

module.exports = router;