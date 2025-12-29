const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { processUpload } = require('../services/fileService');
const archiver = require('archiver'); 

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const STORAGE_QUOTA = 10 * 1024 * 1024; 

// folder
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

//Move File (Drag & Drop)
const moveFile = async (req, res) => {
    const { folderId } = req.body; 
    try {
        await prisma.logicalFile.update({
            where: { id: req.params.id },
            data: { folderId: folderId || null }
        });
        res.json({ message: "File moved" });
    } catch (e) { res.status(500).json({ error: "Move failed" }); }
};

// Download folder 
const downloadFolder = async (req, res) => {
    const folderId = req.params.id;
    
    const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { files: { include: { physicalFile: true } } } 
    });

    if (!folder || folder.ownerId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    res.attachment(`${folder.name}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    folder.files.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file.physicalFile.path);
        if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: file.filename });
        }
    });

    await archive.finalize();
};

const getUserFiles = async (req, res) => {
    const isTrash = req.query.trash === 'true';
    const currentFolderId = req.query.folderId === 'null' ? null : req.query.folderId;

    let folders = [];
    if (!isTrash) {
        folders = await prisma.folder.findMany({
            where: { ownerId: req.user.id, parentId: currentFolderId || null },
            orderBy: { createdAt: 'desc' }
        });
    }

    const files = await prisma.logicalFile.findMany({
        where: { 
            ownerId: req.user.id,
            deletedAt: isTrash ? { not: null } : null,
            folderId: isTrash ? undefined : (currentFolderId || null)
        },
        include: { physicalFile: true },
        orderBy: { createdAt: 'desc' }
    });

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

    const mappedFolders = await Promise.all(folders.map(async (f) => {
        const folderFiles = await prisma.logicalFile.findMany({
            where: { folderId: f.id, deletedAt: null },
            include: { physicalFile: true }
        });
        const totalSize = folderFiles.reduce((acc, file) => acc + file.physicalFile.size, 0);

        return {
            ...f,
            size: totalSize, 
            type: 'folder',
            uploadedAt: f.createdAt 
        };
    }));

    res.json([...mappedFolders, ...mappedFiles]);
};
const uploadFile = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const { logicalSize } = await getStatsInternal(req.user.id);
    if (logicalSize + req.file.size > STORAGE_QUOTA) {
        fs.unlinkSync(req.file.path); 
        return res.status(400).json({ error: 'Storage Quota Exceeded (Limit: 10MB)' });
    }

    try {
        const result = await processUpload(req.file.path, req.file.originalname, req.user.id);
        
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

    const folders = await prisma.folder.findMany({
        where: { 
            isPublic: true, 
            parentId: currentFolderId || null 
        },
        include: { owner: { select: { username: true } } }, 
        orderBy: { createdAt: 'desc' }
    });

    const files = await prisma.logicalFile.findMany({
        where: { 
            isPublic: true, 
            deletedAt: null,
            folderId: currentFolderId || null 
        },
        include: { physicalFile: true, owner: { select: { username: true } } },
        orderBy: { createdAt: 'desc' }
    });

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


    const mappedFolders = folders.map(f => ({
        id: f.id,
        name: f.name,
        size: 0, 
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

    const file = await prisma.logicalFile.findUnique({ where: { id } });
    if (file) {
        if (file.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        const updated = await prisma.logicalFile.update({
            where: { id }, data: { isPublic: !file.isPublic }
        });
        return res.json(updated);
    }

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
    const file = await prisma.logicalFile.findUnique({ where: { id: req.params.id } }); 
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (folder) {
        if (folder.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        await prisma.logicalFile.deleteMany({ where: { folderId: folder.id } });
        await prisma.folder.delete({ where: { id: req.params.id } });
        return res.json({ message: 'Folder deleted' });
    }

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