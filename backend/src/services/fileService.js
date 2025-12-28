const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const processUpload = async (tempPath, originalName, userId) => {
  const hash = await calculateFileHash(tempPath);
  const stats = fs.statSync(tempPath);
  
  let physicalFile = await prisma.physicalFile.findUnique({ where: { hash } });

  if (physicalFile) {
    await prisma.physicalFile.update({
      where: { hash },
      data: { refCount: { increment: 1 } },
    });
    fs.unlinkSync(tempPath); 
  } else {
    const storageName = `${hash}-${Date.now()}${path.extname(originalName)}`;
    const storagePath = path.join(UPLOAD_DIR, storageName);
    fs.renameSync(tempPath, storagePath);

    physicalFile = await prisma.physicalFile.create({
      data: { hash, size: stats.size, path: storageName, refCount: 1 },
    });
  }

  const logicalFile = await prisma.logicalFile.create({
    data: { filename: originalName, ownerId: userId, physicalFileHash: hash },
  });

  return { logicalFile, deduplicated: physicalFile.refCount > 1 };
};

module.exports = { processUpload };