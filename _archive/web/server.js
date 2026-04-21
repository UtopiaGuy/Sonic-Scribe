const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const fs = require('fs');

const app = express();
const port = 3001;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Define and create the uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

let clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => {
        clients.delete(ws);
    });
});

function broadcast(message) {
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

app.use(cors());
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage, fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed!'), false);
    }
} });

app.post('/upload', upload.single('audio'), (req, res) => {
    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    broadcast('STATUS: File upload complete. Processing audio...');

    const process = spawn('C++_VR_App', [filePath]);

    process.stdout.on('data', (data) => {
        broadcast(`STATUS: ${data.toString()}`);
    });

    process.stderr.on('data', (data) => {
        broadcast(`STATUS: Error: ${data.toString()}`);
    });

    process.on('close', (code) => {
        broadcast(`STATUS: Process finished with code ${code}.`);
        res.json({ message: 'Processing complete.' });
    });
});

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});