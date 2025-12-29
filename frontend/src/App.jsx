import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Upload, CheckCircle, Loader2, LogOut, User, Trash2 } from 'lucide-react';
import FileList from './components/FileList';
import StorageStats from './components/StorageStats';
import Login from './components/Login';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('private'); 
  const [uploadStatus, setUploadStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    setToken(null);
    setUsername(null);
    setFiles([]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const folderId = currentFolder ? currentFolder.id : 'null';

      if (view === 'private') {
        const resFiles = await axios.get(`${API_BASE}/files?folderId=${folderId}`);
        setFiles(resFiles.data);
        const resStats = await axios.get(`${API_BASE}/stats`);
        setStats(resStats.data);
      } else if (view === 'trash') {
        const res = await axios.get(`${API_BASE}/files?trash=true`);
        setFiles(res.data);
      } else {
        const res = await axios.get(`${API_BASE}/files/public?folderId=${folderId}`);
        setFiles(res.data);
      }
      setErrorMsg('');
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      if (err.response?.status === 429 && err.config.url.includes('/files')) {
          setErrorMsg("Whoa! Slow down (Rate Limit Exceeded).");
          setTimeout(() => setErrorMsg(''), 3000);
      }
    }
  }, [token, view, handleLogout, currentFolder]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchData();
    }
  }, [token, fetchData]);

  const handleLoginSuccess = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleDelete = async (id) => {
    const isPermanent = view === 'trash';
    const msg = isPermanent ? "Delete forever?" : "Move to Trash?";
    if (confirm(msg)) {
      await axios.delete(`${API_BASE}/files/${id}${isPermanent ? '?permanent=true' : ''}`);
      fetchData();
    }
  };

  const handleMoveFile = async (fileId, targetFolderId) => {
      try {
          await axios.put(`${API_BASE}/files/${fileId}/move`, { folderId: targetFolderId });
          fetchData(); 
      } catch (err) {
          console.error("Move failed", err);
      }
  };

  const handleCreateFolder = async (name) => {
      try {
          await axios.post(`${API_BASE}/folders`, { name, parentId: currentFolder?.id });
          fetchData();
      } catch (err) { alert("Failed to create folder"); }
  };

  const handleFolderClick = (folder) => {
      setFolderHistory([...folderHistory, currentFolder]);
      setCurrentFolder(folder);
  };

  const handleGoBack = () => {
      const prev = folderHistory[folderHistory.length - 1];
      setFolderHistory(folderHistory.slice(0, -1));
      setCurrentFolder(prev);
  };

  const handleRestore = async (id) => {
    await axios.put(`${API_BASE}/files/${id}/restore`);
    fetchData();
  };

  const handleToggleShare = async (id) => {
    await axios.put(`${API_BASE}/files/${id}/share`);
    fetchData();
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setUploadStatus('uploading');
    setErrorMsg('');
    for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) formData.append('folderId', currentFolder.id);

        try { await axios.post(`${API_BASE}/upload`, formData); } 
        catch (error) { 
            if (error.response?.data?.error) alert(error.response.data.error);
        }
    }
    setUploadStatus('success');
    fetchData();
    setTimeout(() => { setUploadStatus(null); }, 3000);
  }, [token, fetchData, currentFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  if (!token) return <Login onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-6 font-sans relative bg-vinno-bg text-vinno-primary">
      
      {/* Top Bar */}
      <div className="absolute top-6 right-8 flex items-center space-x-4">
        <div className="flex items-center font-bold text-lg opacity-80">
          <User className="w-5 h-5 mr-2" /> Hello, {username}!
        </div>
        
        <button 
          onClick={() => { setView(view === 'trash' ? 'private' : 'trash'); setCurrentFolder(null); }}
          className={`p-2 rounded-full transition-colors ${view === 'trash' ? 'bg-vinno-primary text-white' : 'bg-vinno-box1 text-vinno-primary hover:bg-vinno-box1/80'}`}
          title={view === 'trash' ? "Close Bin" : "Recycle Bin"}
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <button onClick={handleLogout} className="flex items-center px-4 py-2 bg-vinno-box1 rounded-full font-bold text-sm text-vinno-primary hover:opacity-90 transition-all shadow-sm">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </button>
      </div>

      <h1 className="text-5xl font-extrabold italic mb-8 tracking-tight mt-8 text-vinno-primary drop-shadow-sm">VinnoDrive</h1>

      {errorMsg && (
          <div className="bg-red-100 text-red-700 px-6 py-2 rounded-full font-bold mb-4 animate-pulse shadow-md">
              {errorMsg}
          </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 mb-8">
        <button 
          onClick={() => { setView('private'); setCurrentFolder(null); }}
          className={`px-8 py-3 rounded-full font-extrabold text-lg transition-all transform ${view === 'private' ? 'bg-vinno-primary text-white shadow-lg scale-105' : 'bg-vinno-box1 text-vinno-primary/80 hover:bg-vinno-primary hover:text-white'}`}
        >
          My Vault
        </button>
        <button 
          onClick={() => { setView('public'); setCurrentFolder(null); }}
          className={`px-8 py-3 rounded-full font-extrabold text-lg transition-all transform ${view === 'public' ? 'bg-vinno-primary text-white shadow-lg scale-105' : 'bg-vinno-box1 text-vinno-primary/80 hover:bg-vinno-primary hover:text-white'}`}
        >
          Community
        </button>
      </div>

      {/* Upload & Stats (Visible ONLY in Private view) */}
      {view === 'private' && (
        <>
          <div className="w-full max-w-2xl mb-12 relative z-10">
            <div 
              {...getRootProps()} 
              className={`w-full bg-vinno-box2 rounded-[50px] p-12 text-center cursor-pointer transition-transform shadow-sm hover:scale-[1.02] ${isDragActive ? 'ring-4 ring-vinno-primary/20' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-vinno-primary">
                {uploadStatus === 'uploading' ? (
                  <Loader2 className="w-12 h-12 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-12 h-12 mb-4 opacity-90" strokeWidth={2.5} />
                    <h2 className="text-3xl font-extrabold italic">Drag & Drop</h2>
                    <p className="text-vinno-primary/70 font-semibold mt-2">
                        {currentFolder ? `Upload to "${currentFolder.name}"` : 'or Click to Upload File'}
                    </p>
                  </>
                )}
              </div>
            </div>
            {uploadStatus === 'success' && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded-full font-bold flex items-center shadow-xl animate-bounce">
                <CheckCircle className="w-4 h-4 mr-2" /> Complete!
              </div>
            )}
          </div>
          {/* Always show stats if we have them, prevents disappearing when switching back */}
          <StorageStats stats={stats} />
        </>
      )}

      <FileList 
        files={files} 
        onDelete={handleDelete} 
        onRestore={handleRestore}
        onToggleShare={handleToggleShare}
        onCreateFolder={handleCreateFolder}
        onFolderClick={handleFolderClick}
        onGoBack={handleGoBack}
        onMoveFile={handleMoveFile}
        currentFolder={currentFolder}
        isPublicView={view === 'public'}
        isTrashView={view === 'trash'}
        currentUser={username}
      />
    </div>
  );
}

export default App;