'use strict';
const express = require('express');
const { z } = require('zod');

const router = express.Router();

const layoutSchema = z.object({
  rows: z.number().min(3).max(20).optional(),
  cols: z.number().min(3).max(20).optional()
});

const holdSchema = z.object({
  seatId: z.string().min(1),
  userId: z.string().min(1)
});

const bookSchema = z.object({
  seatIds: z.array(z.string()).min(1),
  userId: z.string().min(1)
});

function validate(schema){
  return (req,res,next)=>{
    const parsed = schema.safeParse(req.body);
    if(!parsed.success) return res.status(400).json({ error: parsed.error.format() });
    req.valid = parsed.data;
    next();
  };
}

router.post('/layout', validate(layoutSchema), async (req,res)=>{
  try {
    const { rows = 5, cols = 8 } = req.valid;
    const db = req.app.get('db');
    const seats = db.collection('seats');
    await seats.deleteMany({});
    const docs = [];
    for(let r=1;r<=rows;r++){
      for(let c=1;c<=cols;c++){
        docs.push({
          _id: `R${r}C${c}`,
          row: r,
          col: c,
          status: 'available',
          heldBy: null,
          holdExpiresAt: null,
          version: 1
        });
      }
    }
    if(docs.length) await seats.insertMany(docs);
    return res.json({ ok: true, rows, cols });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

router.get('/seats', async (req,res)=>{
  try {
    const db = req.app.get('db');
    const seats = await db.collection('seats').find({}).toArray();
    res.json({ seats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/hold', validate(holdSchema), async (req,res)=>{
  try {
    const { seatId, userId } = req.valid;
    const db = req.app.get('db');
    const seats = db.collection('seats');
    const now = new Date();
    const expireAt = new Date(now.getTime() + 60*1000);
    const result = await seats.findOneAndUpdate(
      { _id: seatId, status: 'available' },
      { $set: { status: 'held', heldBy: userId, holdExpiresAt: expireAt }, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if(!result.value) {
      return res.status(409).json({ error: 'Seat not available' });
    }
    const io = req.app.get('io');
    io.emit('seat:update', result.value);
    return res.json({ ok: true, seat: result.value });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

router.post('/release', validate(holdSchema), async (req,res)=>{
  try {
    const { seatId, userId } = req.valid;
    const db = req.app.get('db');
    const seats = db.collection('seats');
    const result = await seats.findOneAndUpdate(
      { _id: seatId, status: 'held', heldBy: userId },
      { $set: { status: 'available', heldBy: null, holdExpiresAt: null }, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if(!result.value) return res.status(409).json({ error: 'Cannot release' });
    const io = req.app.get('io');
    io.emit('seat:update', result.value);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

router.post('/book', validate(bookSchema), async (req,res)=>{
  try {
    const { seatIds, userId } = req.valid;
    const db = req.app.get('db');
    const seats = db.collection('seats');
    const ops = seatIds.map(id => ({
      updateOne: {
        filter: { _id: id, status: 'held', heldBy: userId },
        update: { $set: { status: 'booked', heldBy: null, holdExpiresAt: null }, $inc: { version: 1 } }
      }
    }));
    const result = await seats.bulkWrite(ops);
    if(result.modifiedCount !== seatIds.length) {
      return res.status(409).json({ error: 'Booking conflict' });
    }
    const io = req.app.get('io');
    seatIds.forEach(id => io.emit('seat:booked', { seatId: id, bookedBy: userId }));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

router.get('/my-holds/:userId', async (req,res)=>{
  try {
    const userId = req.params.userId;
    const db = req.app.get('db');
    const seats = await db.collection('seats').find({ heldBy: userId }).toArray();
    res.json({ seats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
