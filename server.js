const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('.'));

// --- LOWDB INITIALIZATION (The simple way) ---
const fs = require('fs');
const dbFile = './db.json';

// Initialize the JSON file if it doesn't exist
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ messages: [] }));
}

function getMessages() {
    return JSON.parse(fs.readFileSync(dbFile)).messages;
}

function saveMessage(role, content) {
    const data = JSON.parse(fs.readFileSync(dbFile));
    data.messages.push({ role, content, timestamp: new Date() });
    // Keep only last 50 messages to keep it fast
    if (data.messages.length > 50) data.messages.shift();
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// --- AUTH MIDDLEWARE ---
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "AUTH_REQUIRED" });
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(403).json({ error: "SESSION_EXPIRED" }); }
};

// --- LOGIN ---
app.post('/login', (req, res) => {
    if (req.body.password === process.env.MY_PASSWORD) {
        const token = jwt.sign({ user: 'Sahad' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } else { res.status(401).json({ error: "INVALID_CREDENTIALS" }); }
});

// --- AI ENGINE ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: "You are a senior full-stack architect. Provide production-ready code with line-by-line explanations."
});

app.post('/chat', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;

        // Pull last 10 messages from JSON for context
        const allMessages = getMessages();
        const history = allMessages.slice(-10).map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // Save conversation to JSON
        saveMessage('user', message);
        saveMessage('model', responseText);

        res.json({ text: responseText });
    } catch (error) {
        res.status(500).json({ error: "SERVER_ERROR", details: error.message });
    }
});

app.listen(3000, () => console.log("🚀 System Optimized: JSON DB + JWT + Gemini Active"));
