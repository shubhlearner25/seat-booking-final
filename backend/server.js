'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { Server } = require('socket.io');

const routes = require('./src/routes')

const app = express();
const server = http.createServer(app);

// 🔹 Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 🔹 Middleware
app.use(cors());
app.use(express.json());

// 🔹 MongoDB connection
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT || 4000;

if (!MONGO_URL) {
  console.error('❌ MONGO_URL is not defined');
  process.exit(1);
}

async function start() {
  try {
    const client = new MongoClient(MONGO_URL);
    await client.connect();

    const db = client.db(); // uses db name from connection string
    console.log('✅ Connected to MongoDB');

    // make db & io available everywhere
    app.set('db', db);
    app.set('io', io);

    // routes
    app.use('/api', routes);

    // health check
    app.get('/', (req, res) => {
      res.send('Seat Booking Backend Running');
    });

    // socket connections
    io.on('connection', (socket) => {
      console.log('🔌 socket connected', socket.id);

      socket.on('disconnect', () => {
        console.log('❌ socket disconnected', socket.id);
      });
    });

    server.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
