const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('.'));

// --- AUTH MIDDLEWARE ---
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ text: "Please Login." });

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(403).json({ text: "Session expired. Login again." });
    }
};

// --- LOGIN ROUTE ---
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.MY_PASSWORD) {
        const token = jwt.sign({ user: 'Sahad' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

// --- GEMINI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: "You are a senior developer. Explain every single line of code you write."
});

// --- CHAT WITH HISTORY ---
app.post('/chat', verifyToken, async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Start chat with previous context
        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        
        res.json({ text: result.response.text() });
    } catch (error) {
        res.status(500).json({ text: "AI Error: " + error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server active on http://localhost:${PORT}`));

