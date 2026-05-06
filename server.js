const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('.'));

let db;
(async () => {
    db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT)`);
})();

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(403).json({ error: "AUTH_EXPIRED" }); }
};

app.post('/login', (req, res) => {
    if (req.body.password === process.env.MY_PASSWORD) {
        const token = jwt.sign({ user: 'Sahad' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } else { res.status(401).json({ error: "INVALID_PASS" }); }
});

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.post('/chat', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        
        // Fetch last 10 messages from DB for context
        const history = await db.all("SELECT role, content as text FROM messages ORDER BY id DESC LIMIT 10");
        const formattedHistory = history.reverse().map(m => ({ role: m.role, parts: [{ text: m.text }] }));

        const chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // Save to Database
        await db.run("INSERT INTO messages (role, content) VALUES (?, ?)", ['user', message]);
        await db.run("INSERT INTO messages (role, content) VALUES (?, ?)", ['model', responseText]);

        res.json({ text: responseText });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "SYSTEM_FAILURE", details: error.message });
    }
});

app.listen(3000, () => console.log("🚀 System fully optimized on port 3000"));
