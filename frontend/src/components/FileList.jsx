import React, { useState } from 'react';
import { FileText, Trash2, Globe, Lock, Download, User, Archive, Search, Eye, RotateCcw, FolderPlus, Folder, ChevronLeft, Package } from 'lucide-react';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
    if(!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
};

const FileList = ({ files, onDelete, onRestore, onToggleShare, isPublicView, isTrashView, currentUser, currentFolder, onFolderClick, onGoBack, onCreateFolder, onMoveFile }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const token = localStorage.getItem('token');

  const filteredItems = files.filter(item => 
    (item.name || item.filename).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = (id, type) => {
    const link = document.createElement('a');
    // If folder, use folder download route (Zip), else file download route
    const route = type === 'folder' ? 'folders' : 'files';
    link.href = `http://localhost:3000/api/${route}/${id}/download?token=${token}`;
    link.setAttribute('download', ''); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleQuickLook = (id) => {
    window.open(`http://localhost:3000/api/files/${id}/preview?token=${token}`, '_blank');
  };

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) onCreateFolder(name);
  };

  // DRAG AND DROP HANDLERS 
  const handleDragStart = (e, fileId) => {
      e.dataTransfer.setData("fileId", fileId);
  };

  const handleDragOver = (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('bg-vinno-primary/10'); 
  };

  const handleDragLeave = (e) => {
      e.currentTarget.classList.remove('bg-vinno-primary/10');
  };

  const handleDrop = (e, folderId) => {
      e.preventDefault();
      e.currentTarget.classList.remove('bg-vinno-primary/10');
      const fileId = e.dataTransfer.getData("fileId");
      if (fileId && folderId) {
          onMoveFile(fileId, folderId);
      }
  };

  if (files.length === 0 && !searchTerm) {
    return (
      <div className="w-full max-w-5xl bg-vinno-box2 rounded-[50px] p-12 text-center text-vinno-primary/50 font-bold italic relative">
         {!isPublicView && !isTrashView && (
             <button onClick={handleCreateFolder} className="absolute top-8 right-8 flex items-center bg-white/50 px-4 py-2 rounded-full hover:bg-white transition-all text-sm text-vinno-primary">
                 <FolderPlus className="w-4 h-4 mr-2"/> New Folder
             </button>
         )}
         {currentFolder && (
            <button onClick={onGoBack} className="absolute top-8 left-8 flex items-center bg-white/50 px-4 py-2 rounded-full hover:bg-white transition-all text-sm text-vinno-primary">
                <ChevronLeft className="w-4 h-4 mr-1"/> Back
            </button>
         )}
        <p>{isTrashView ? "Trash is empty." : (isPublicView ? "No community files yet." : "This folder is empty.")}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl bg-vinno-box2 rounded-[50px] p-10 mb-20 shadow-sm">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div className="flex items-center mb-4 md:mb-0">
          {currentFolder && (
             <button onClick={onGoBack} className="mr-3 p-2 bg-white/50 rounded-full hover:bg-white transition-colors text-vinno-primary">
                 <ChevronLeft className="w-5 h-5" />
             </button>
          )}

          <div className="bg-vinno-primary p-2 rounded-xl mr-3 text-white">
            {isTrashView ? <Trash2 className="w-6 h-6"/> : <Archive className="w-6 h-6" />}
          </div>
          <h2 className="text-3xl font-extrabold italic text-vinno-primary">
            {isTrashView ? 'Recycle Bin' : (isPublicView ? 'Community Vault' : (currentFolder ? currentFolder.name : 'Your Vault'))}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
            {!isPublicView && !isTrashView && (
                <button onClick={handleCreateFolder} className="p-2 bg-white/50 rounded-full hover:bg-white text-vinno-primary transition-colors" title="New Folder">
                    <FolderPlus className="w-5 h-5" />
                </button>
            )}
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-vinno-primary/50" />
                <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/50 rounded-full py-2 pl-10 pr-4 text-vinno-primary font-bold placeholder-vinno-primary/30 focus:outline-none focus:ring-2 focus:ring-vinno-primary/20"
                />
            </div>
        </div>
      </div>
      
      <div className="overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b-2 border-vinno-primary/10 text-vinno-primary/60 text-sm uppercase font-bold tracking-wider">
            <tr>
              <th className="px-4 py-4 text-left">Name</th>
              <th className="px-4 py-4 text-center">Size</th>
              <th className="px-4 py-4 text-center">Uploaded On</th> {/* RESTORED COLUMN */}
              {isPublicView && <th className="px-4 py-4 text-center">Downloads</th>}
              {isPublicView && <th className="px-4 py-4 text-center">Owner</th>}
              {!isPublicView && !isTrashView && <th className="px-4 py-4 text-center">Status</th>}
              <th className="px-4 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vinno-primary/10">
            {filteredItems.map((item) => (
              <tr 
                key={item.id} 
                className="hover:bg-white/20 transition-colors font-semibold text-lg text-vinno-primary cursor-pointer transition-all"
                // Drag Events for FILES only
                draggable={item.type === 'file' && !isPublicView && !isTrashView}
                onDragStart={(e) => item.type === 'file' ? handleDragStart(e, item.id) : null}
                // Drop Events for FOLDERS only
                onDragOver={(e) => item.type === 'folder' ? handleDragOver(e) : null}
                onDragLeave={(e) => item.type === 'folder' ? handleDragLeave(e) : null}
                onDrop={(e) => item.type === 'folder' ? handleDrop(e, item.id) : null}
              >
                
                {/* Name */}
                <td className="px-4 py-5 text-left flex items-center" onClick={() => item.type === 'folder' ? onFolderClick(item) : null}>
                  {item.type === 'folder' ? (
                      <Folder className="w-5 h-5 mr-3 text-vinno-primary fill-vinno-primary/20" />
                  ) : (
                      <FileText className="w-5 h-5 mr-3 opacity-60" />
                  )}
                  {item.filename || item.name}
                </td>
                
                {/* Size */}
                <td className="px-4 py-5 text-center opacity-60 text-base">
                  {formatBytes(item.size)}
                </td>

                {/* Uploaded On (Restored) */}
                <td className="px-4 py-5 text-center opacity-60 text-sm">
                  {formatDate(item.uploadedAt)}
                </td>

                {/* Download Counter (Public Only) */}
                {isPublicView && (
                  <td className="px-4 py-5 text-center text-sm opacity-60">
                      <div className="flex items-center justify-center font-bold">
                        <Download className="w-3 h-3 mr-1" /> {item.downloadCount}
                      </div>
                  </td>
                )}

                {/* Owner (Public Only) */}
                {isPublicView && (
                  <td className="px-4 py-5 text-center text-sm opacity-60">
                     <div className="flex items-center justify-center">
                       <User className="w-4 h-4 mr-2" /> {item.owner}
                     </div>
                  </td>
                )}

                {/* Status (Private Only) */}
                {!isPublicView && !isTrashView && (
                  <td className="px-4 py-5 text-center">
                    {item.type === 'folder' ? (
                        <span className="text-xs opacity-50">Folder</span>
                    ) : (
                        item.isDeduped ? (
                            <span className="inline-block px-3 py-1 bg-vinno-primary/10 text-vinno-primary rounded-full text-xs border border-vinno-primary/20">Ref</span>
                        ) : (
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs border border-green-200">Org</span>
                        )
                    )}
                  </td>
                )}

                {/* Actions */}

                <td className="px-4 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center space-x-2">
                        {isTrashView ? (
                        /* Trash Actions */
                        <>
                            <button onClick={() => onRestore(item.id)} className="p-2 rounded-full hover:bg-green-100 text-green-700 transition-colors"><RotateCcw className="w-5 h-5" /></button>
                            <button onClick={() => onDelete(item.id)} className="p-2 rounded-full hover:bg-red-100 text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </>
                        ) : (
                        /* Standard Actions */
                        <>
                            {/* Quick Look (Files Only) */}
                            {item.type === 'file' && (
                                <button onClick={() => handleQuickLook(item.id)} className="p-2 rounded-full hover:bg-white/40 transition-colors" title="Quick Look">
                                    <Eye className="w-5 h-5 text-vinno-primary" />
                                </button>
                            )}

                            {/* Download (Unified Icon for File & Folder) */}
                            <button onClick={() => handleDownload(item.id, item.type)} className="p-2 rounded-full hover:bg-white/40 transition-colors" title={item.type === 'folder' ? "Download Zip" : "Download"}>
                                {/* CHANGED: Always show Download Icon now */}
                                <Download className="w-5 h-5 text-vinno-primary" />
                            </button>

                            {/* Share (NOW ENABLED FOR FOLDERS TOO) */}
                            {(!isPublicView || item.owner === currentUser) && (
                                <button onClick={() => onToggleShare(item.id)} className="p-2 rounded-full hover:bg-white/40 transition-colors" title="Toggle Visibility">
                                    {item.isPublic ? <Globe className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-vinno-primary/60" />}
                                </button>
                            )}

                            {/* Delete (Owner Only) */}
                            {(!isPublicView || item.owner === currentUser) && (
                                <button onClick={() => onDelete(item.id)} className="p-2 rounded-full hover:bg-red-100/50 transition-colors" title="Delete">
                                    <Trash2 className="w-5 h-5 text-red-500/70" />
                                </button>
                            )}
                        </>
                        )}
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileList;