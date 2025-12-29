const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cors({
    origin: '*', // For simplicity in this demo, allow all. In pro, set to Vercel URL.
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);

// Start Server
app.listen(PORT, '0.0.0.0'() => {
    console.log(`Server running on http://localhost:${PORT}`);
});