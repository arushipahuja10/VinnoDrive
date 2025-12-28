// backend/src/controllers/fileController.js
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { processUpload } = require('../services/fileService');
const archiver = require('archiver'); // <--- NEW DEPENDENCY

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const STORAGE_QUOTA = 10 * 1024 * 1024; // 10 MB Quota

// --- FOLDER LOGIC ---

const createFolder = async (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Folder name required" });
    try {
        const folder = await prisma.folder.create({
            data: { name, ownerId: req.user.id, parentId: parentId || null }
        });
        res.json(folder);
    } catch (e) { res.status(500).json({ error: "Failed to create folder" }); }
};

// NEW: Move File (Drag & Drop)
const moveFile = async (req, res) => {
    const { folderId } = req.body; // Can be null (root) or a UUID
    try {
        await prisma.logicalFile.update({
            where: { id: req.params.id },
            data: { folderId: folderId || null }
        });
        res.json({ message: "File moved" });
    } catch (e) { res.status(500).json({ error: "Move failed" }); }
};

// NEW: Download Folder as ZIP
const downloadFolder = async (req, res) => {
    const folderId = req.params.id;
    
    // 1. Get Folder Info
    const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { files: { include: { physicalFile: true } } } // Simple 1-level depth for MVP
    });

    if (!folder || folder.ownerId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    // 2. Setup Zip Stream
    res.attachment(`${folder.name}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    // 3. Add Files to Zip
    folder.files.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file.physicalFile.path);
        if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: file.filename });
        }
    });

    // 4. Finalize
    await archive.finalize();
};

// --- FILE LOGIC ---
// --- FILE LOGIC ---

const getUserFiles = async (req, res) => {
    const isTrash = req.query.trash === 'true';
    const currentFolderId = req.query.folderId === 'null' ? null : req.query.folderId;

    // 1. Fetch Folders
    let folders = [];
    if (!isTrash) {
        folders = await prisma.folder.findMany({
            where: { ownerId: req.user.id, parentId: currentFolderId || null },
            orderBy: { createdAt: 'desc' }
        });
    }

    // 2. Fetch Files
    const files = await prisma.logicalFile.findMany({
        where: { 
            ownerId: req.user.id,
            deletedAt: isTrash ? { not: null } : null,
            folderId: isTrash ? undefined : (currentFolderId || null)
        },
        include: { physicalFile: true },
        orderBy: { createdAt: 'desc' }
    });

    // 3. Map Files (Org/Ref Logic)
    const mappedFiles = await Promise.all(files.map(async (f) => {
        const firstFile = await prisma.logicalFile.findFirst({
            where: { physicalFileHash: f.physicalFileHash },
            orderBy: { createdAt: 'asc' }
        });
        const isOriginal = firstFile && firstFile.id === f.id;

        return {
            id: f.id, 
            filename: f.filename, 
            size: f.physicalFile.size,
            isPublic: f.isPublic, 
            isDeduped: !isOriginal,
            uploadedAt: f.createdAt,
            deletedAt: f.deletedAt,
            downloadCount: f.downloadCount,
            type: 'file'
        };
    }));

    // 4. Map Folders (Calculate Size Sum)
    const mappedFolders = await Promise.all(folders.map(async (f) => {
        // Calculate size of all files in this folder (non-recursive for MVP speed)
        const folderFiles = await prisma.logicalFile.findMany({
            where: { folderId: f.id, deletedAt: null },
            include: { physicalFile: true }
        });
        const totalSize = folderFiles.reduce((acc, file) => acc + file.physicalFile.size, 0);

        return {
            ...f,
            size: totalSize, // <--- Sent to Frontend
            type: 'folder',
            uploadedAt: f.createdAt // ensure date column works
        };
    }));

    res.json([...mappedFolders, ...mappedFiles]);
};
const uploadFile = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // QUOTA CHECK
    const { logicalSize } = await getStatsInternal(req.user.id);
    if (logicalSize + req.file.size > STORAGE_QUOTA) {
        fs.unlinkSync(req.file.path); // Cleanup temp file
        return res.status(400).json({ error: 'Storage Quota Exceeded (Limit: 10MB)' });
    }

    try {
        const result = await processUpload(req.file.path, req.file.originalname, req.user.id);
        
        // Move to folder if specified
        if (req.body.folderId && req.body.folderId !== 'null') {
             await prisma.logicalFile.update({
                where: { id: result.logicalFile.id },
                data: { folderId: req.body.folderId }
             });
        }
        res.json(result);
    } catch (err) { res.status(500).json({ error: 'Upload failed' }); }
};

const incrementDownload = async (id) => {
    await prisma.logicalFile.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
};

const downloadFile = async (req, res) => {
    const file = await prisma.logicalFile.findUnique({ where: { id: req.params.id }, include: { physicalFile: true } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    
    if (!file.isPublic && (!req.user || file.ownerId !== req.user.id)) return res.status(403).json({ error: 'Access denied' });

    const filePath = path.join(UPLOAD_DIR, file.physicalFile.path);
    if(fs.existsSync(filePath)) {
        await incrementDownload(file.id);
        res.download(filePath, file.filename);
    } else {
        res.status(404).json({error: 'Physical file missing'});
    }
};

const previewFile = async (req, res) => {
    const file = await prisma.logicalFile.findUnique({ where: { id: req.params.id }, include: { physicalFile: true } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (!file.isPublic && (!req.user || file.ownerId !== req.user.id)) return res.status(403).json({ error: 'Access denied' });

    const filePath = path.join(UPLOAD_DIR, file.physicalFile.path);
    if(fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({error: 'Physical file missing'});
};

const getAllPublicFiles = async (req, res) => {
    const currentFolderId = req.query.folderId === 'null' ? null : req.query.folderId;

    // 1. Fetch Public Folders
    // If inside a folder, ensure the PARENT is public (or the specific requested folder is public)
    const folders = await prisma.folder.findMany({
        where: { 
            isPublic: true, 
            parentId: currentFolderId || null 
        },
        include: { owner: { select: { username: true } } }, // Get owner name
        orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch Public Files
    const files = await prisma.logicalFile.findMany({
        where: { 
            isPublic: true, 
            deletedAt: null,
            folderId: currentFolderId || null // Only show files in this specific level
        },
        include: { physicalFile: true, owner: { select: { username: true } } },
        orderBy: { createdAt: 'desc' }
    });

    // Map Files
    const mappedFiles = files.map(f => ({
        id: f.id, 
        filename: f.filename, 
        size: f.physicalFile.size,
        owner: f.owner.username, 
        isPublic: true, 
        uploadedAt: f.createdAt,
        downloadCount: f.downloadCount,
        type: 'file'
    }));

    // Map Folders
    // Note: Calculating size for public folders might be heavy, skipping size for speed here or use 0
    const mappedFolders = folders.map(f => ({
        id: f.id,
        name: f.name,
        size: 0, // Placeholder
        owner: f.owner.username,
        isPublic: true,
        uploadedAt: f.createdAt,
        type: 'folder'
    }));

    res.json([...mappedFolders, ...mappedFiles]);
};

const getStatsInternal = async (userId) => {
    const logicalFiles = await prisma.logicalFile.findMany({ where: { ownerId: userId, deletedAt: null }, include: { physicalFile: true } });
    const logicalSize = logicalFiles.reduce((acc, f) => acc + f.physicalFile.size, 0);
    const uniqueHashes = [...new Set(logicalFiles.map(f => f.physicalFileHash))];
    const physicalFiles = await prisma.physicalFile.findMany({ where: { hash: { in: uniqueHashes } } });
    const physicalSize = physicalFiles.reduce((acc, f) => acc + f.size, 0);
    return { logicalSize, physicalSize };
};

const getStorageStats = async (req, res) => {
    const { logicalSize, physicalSize } = await getStatsInternal(req.user.id);
    const savedSpace = logicalSize - physicalSize;
    res.json({
        logicalSize, physicalSize, savedSpace,
        dedupRatio: logicalSize > 0 ? (savedSpace / logicalSize) * 100 : 0
    });
};

const togglePublic = async (req, res) => {
    const { id } = req.params;

    // 1. Try finding a File first
    const file = await prisma.logicalFile.findUnique({ where: { id } });
    if (file) {
        if (file.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        const updated = await prisma.logicalFile.update({
            where: { id }, data: { isPublic: !file.isPublic }
        });
        return res.json(updated);
    }

    // 2. Try finding a Folder
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (folder) {
        if (folder.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        const updated = await prisma.folder.update({
            where: { id }, data: { isPublic: !folder.isPublic }
        });
        return res.json(updated);
    }

    return res.status(404).json({ error: "Item not found" });
};

const deleteFile = async (req, res) => {
    const file = await prisma.logicalFile.findUnique({ where: { id: req.params.id } }); // This handles both files and folders logically if mapped correctly, but schema is separate.
    // NOTE: For folders, we need separate delete logic or unify.
    // Simple approach: Check folder first.
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (folder) {
        if (folder.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        // Delete folder (Cascading handled by Prisma? Need to check schema or delete manually)
        // SQLite doesn't always cascade nicely. Let's delete manually.
        await prisma.logicalFile.deleteMany({ where: { folderId: folder.id } });
        await prisma.folder.delete({ where: { id: req.params.id } });
        return res.json({ message: 'Folder deleted' });
    }

    // Existing File Delete Logic
    const lFile = await prisma.logicalFile.findUnique({ where: { id: req.params.id } });
    if (!lFile || lFile.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    
    if (req.query.permanent === 'true') {
        await prisma.logicalFile.delete({ where: { id: req.params.id } });
        await prisma.physicalFile.update({ where: { hash: lFile.physicalFileHash }, data: { refCount: { decrement: 1 } } });
        res.json({ message: 'Permanently Deleted' });
    } else {
        await prisma.logicalFile.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isPublic: false } });
        res.json({ message: 'Moved to Trash' });
    }
};
const restoreFile = async (req, res) => {
    const file = await prisma.logicalFile.findUnique({ where: { id: req.params.id } });
    if (file.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await prisma.logicalFile.update({ where: { id: req.params.id }, data: { deletedAt: null } });
    res.json({ message: 'Restored' });
};

module.exports = { getUserFiles, getAllPublicFiles, uploadFile, downloadFile, previewFile, togglePublic, deleteFile, restoreFile, getStorageStats, createFolder, moveFile, downloadFolder };