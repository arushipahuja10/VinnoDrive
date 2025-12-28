// frontend/src/components/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

const Login = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const endpoint = isRegistering ? '/auth/register' : '/auth/login';
    
    try {
      const res = await axios.post(`${API_BASE}${endpoint}`, { username, password });
      
      if (isRegistering) {
        setIsRegistering(false);
        setError('Account created! Please log in.');
        setLoading(false);
      } else {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        onLoginSuccess(res.data.token, res.data.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-gray-800">
      <h1 className="text-6xl font-extrabold italic mb-8 tracking-tight text-vinno-primary">VinnoDrive</h1>
      
      <div className="w-full max-w-md bg-orange-100 rounded-[3rem] p-12 shadow-lg">
        <h2 className="text-3xl font-bold italic mb-8 text-center text-gray-800">
          {isRegistering ? 'join the vault' : 'welcome back'}
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-2xl text-center text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <User className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 z-10" />
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white rounded-3xl py-4 pl-14 pr-6 font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all relative"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 z-10" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white rounded-3xl py-4 pl-14 pr-6 font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all relative"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gray-800 text-white py-4 rounded-3xl font-extrabold text-lg flex items-center justify-center hover:scale-[1.02] active:scale-95 transition-all shadow-md disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                {isRegistering ? 'Create Account' : 'Access Vault'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-sm font-bold opacity-60 hover:opacity-100 underline decoration-2 underline-offset-4"
          >
            {isRegistering ? 'Already have an account? Log In' : 'New here? Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;