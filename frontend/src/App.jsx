'use strict';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Grid from './components/Grid';
import useStore from './store';
import api from "./api"; // ✅ NEW
import { io } from 'socket.io-client';

// FIX: Browser must call localhost, not Docker service name
const socket = io("https://seat-booking-final.onrender.com");

export default function App() {
  const { setSeats } = useStore();
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(8);

  async function fetchSeats() {
    try {
      const res = await axios.get('/api/seats');
      const map = {};
      res.data.seats.forEach(s => (map[s._id] = s));
      setSeats(map);
    } catch (err) {
      console.error(err);
    }
  }

useEffect(() => {
  fetchSeats();

  socket.on("seat:update", seat => {
    setSeats(prev => ({
      ...prev,
      [seat._id]: seat
    }));
  });

  socket.on("seat:booked", ({ seatId }) => {
    setSeats(prev => ({
      ...prev,
      [seatId]: {
        ...prev[seatId],
        status: "booked",
        heldBy: null,
        holdExpiresAt: null
      }
    }));
  });

  return () => {
    socket.off("seat:update");
    socket.off("seat:booked");
  };
}, []);

  async function generate() {
    await axios.post('/api/layout', { rows, cols });
    fetchSeats();
  }

  return (
    React.createElement('div', { className: 'p-6 bg-gray-50 min-h-screen' },
      React.createElement('div', { className: 'max-w-4xl mx-auto' },
        React.createElement('h1', { className: 'text-2xl font-semibold mb-4' }, 'Seat Booking — Enhanced'),
        React.createElement('div', { className: 'flex gap-2 items-center mb-4' },
          React.createElement('label', null, 'Rows:'),
          React.createElement('input', { type: 'number', min: 3, max: 20, value: rows, onChange: e => setRows(Number(e.target.value)), className: 'border p-1 rounded w-20' }),
          React.createElement('label', null, 'Cols:'),
          React.createElement('input', { type: 'number', min: 3, max: 20, value: cols, onChange: e => setCols(Number(e.target.value)), className: 'border p-1 rounded w-20' }),
          React.createElement('button', { onClick: generate, className: 'ml-4 px-3 py-1 bg-blue-600 text-white rounded' }, 'Generate')
        ),
React.createElement(Grid)
      )
    )
  );
}
