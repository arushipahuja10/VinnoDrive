// frontend/src/components/StorageStats.jsx
import React from 'react';
import { HardDrive, Server, Zap } from 'lucide-react';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const StorageStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full max-w-5xl mb-12">
      <div className="flex-1 bg-vinno-box1 p-6 rounded-[50px] shadow-sm flex items-center">
        <div className="bg-white/30 p-4 rounded-full mr-4 text-vinno-primary">
          <HardDrive className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-vinno-primary/60 font-bold uppercase tracking-wider">You Uploaded</p>
          <p className="text-2xl font-extrabold text-vinno-primary">{formatBytes(stats.logicalSize)}</p>
        </div>
      </div>

      <div className="flex-1 bg-vinno-box1 p-6 rounded-[50px] shadow-sm flex items-center">
        <div className="bg-white/30 p-4 rounded-full mr-4 text-vinno-primary">
          <Server className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-vinno-primary/60 font-bold uppercase tracking-wider">Disk Used</p>
          <p className="text-2xl font-extrabold text-vinno-primary">{formatBytes(stats.physicalSize)}</p>
        </div>
      </div>

      <div className="flex-1 bg-vinno-box1 p-6 rounded-[50px] shadow-sm flex items-center">
        <div className="bg-white/30 p-4 rounded-full mr-4 text-vinno-primary">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-vinno-primary/60 font-bold uppercase tracking-wider">Space Saved</p>
          {/* NEW: Percentage + Bytes Saved */}
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-vinno-primary">{stats.dedupRatio.toFixed(0)}%</p>
            <p className="text-sm text-vinno-primary/70 font-semibold">~ {formatBytes(stats.savedSpace)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageStats;