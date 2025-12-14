'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const routes = require('./routes');

const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/seatsdb';

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.set('io', io);

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();
  app.set('db', db);
  console.log('Connected to MongoDB');

  await db.collection('seats').createIndex({ holdExpiresAt: 1 }).catch(()=>{});

  app.use('/api', routes);

  // Cleaner to release expired holds
  setInterval(async () => {
    try {
      const seats = db.collection('seats');
      const now = new Date();
      const res = await seats.findOneAndUpdate(
        { status: 'held', holdExpiresAt: { $lte: now } },
        { $set: { status: 'available', heldBy: null, holdExpiresAt: null }, $inc: { version: 1 } },
        { returnDocument: 'after' }
      );
      if (res.value) {
        io.emit('seat:update', res.value);
      }
    } catch (err) {
      console.error('Cleaner error', err);
    }
  }, 3000);

  io.on('connection', socket => {
    console.log('socket connected', socket.id);
  });

  server.listen(PORT, () => {
    console.log(`Backend running on: ${PORT}`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
