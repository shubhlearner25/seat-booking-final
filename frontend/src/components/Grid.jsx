'use strict';
import React, { useMemo, useState, useEffect } from 'react';
import useStore from '../store';
import axios from 'axios';

function seatColor(s, myId) {
  if (!s) return 'bg-gray-200';
  if (s.status === 'booked') return 'bg-red-600';
  if (s.status === 'held') {
    return s.heldBy === myId ? 'bg-amber-500' : 'bg-gray-400';
  }
  return 'bg-green-600';
}

function validateContiguous(selection, seats) {
  if (!selection || selection.length <= 1) return { valid: true };

  const rows = {};
  selection.forEach(id => {
    const s = seats[id];
    if (!s) return;
    rows[s.row] = rows[s.row] || [];
{ `R${s.row}C${s.col}` }
  });

  for (const r of Object.keys(rows)) {
    const cols = rows[r].sort((a, b) => a - b);
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] !== cols[i - 1] + 1) {
        return { valid: false, message: `Gap detected in row ${r}` };
      }
    }
  }
  return { valid: true };
}

export default function Grid() {
  const { seats, myId, setSeats } = useStore();
  const [selection, setSelection] = useState([]);

  // Always ensure userId exists in localStorage
  useEffect(() => {
    localStorage.setItem("userId", myId);
  }, [myId]);

  const seatArray = useMemo(
    () => Object.values(seats).sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row)),
    [seats]
  );
async function handleClick(s) {
  console.log("CLICKED SEAT:", s);

  // AVAILABLE → HOLD
  if (s.status === "available") {
    try {
      const res = await axios.post("/api/hold", { seatId: s._id, userId: myId });

      setSeats(prev => ({
        ...prev,
        [s._id]: res.data.seat
      }));

      setSelection(prev => [...prev, s._id]);
    } catch (err) {
      console.error("HOLD ERROR:", err.response?.data);
      alert(err.response?.data?.error || "Hold failed");
    }
  }

  // HELD BY ME → RELEASE
  else if (s.status === "held" && s.heldBy === myId) {
    try {
      const res = await axios.post("/api/release", { seatId: s._id, userId: myId });

      setSeats(prev => ({
        ...prev,
        [s._id]: {
          ...s,
          status: "available",
          heldBy: null,
          holdExpiresAt: null
        }
      }));

      setSelection(prev => prev.filter(id => id !== s._id));
    } catch (err) {
      console.error("RELEASE ERROR:", err.response?.data);
      alert("Release failed");
    }
  }

  // HELD BY OTHER USER → DO NOTHING
  else {
    console.log("Seat is locked by another user");
  }
}


 async function bookSelected() {
  if (selection.length === 0) {
    alert("No seats selected!");
    return;
  }

  const valid = validateContiguous(selection, seats);
  if (!valid.valid) return alert(valid.message);

  try {
    await axios.post("/api/book", { seatIds: selection, userId: myId });

    // Get updated seats (but don't collapse UI if empty)
    const res = await axios.get("/api/seats");

    if (!res.data.seats || res.data.seats.length === 0) {
      console.warn("Received empty seat list — ignoring to avoid grid collapse");
      return;
    }

    const map = {};
    res.data.seats.forEach(s => (map[s._id] = s));
    setSeats(map);

    setSelection([]);
    alert("Booked!");

  } catch (err) {
    alert(err.response?.data?.error || "Booking failed");
  }
}


  const rows = useMemo(() => {
    const r = {};
    seatArray.forEach(s => {
      r[s.row] = r[s.row] || [];
      r[s.row].push(s);
    });
    return r;
  }, [seatArray]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <div>
        {Object.keys(rows).map(row =>
          <div key={row} className="flex mb-2">
            {rows[row].map(s =>
              <button
                key={s._id}
                onClick={() => handleClick(s)}
                className={`${seatColor(s, myId)} text-white w-12 h-10 rounded mr-2 flex items-center justify-center`}
              >
                {s.row}-{s.col}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={bookSelected}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Book Selected
        </button>

        <button
          onClick={async () => {
            const res = await axios.get("/api/seats");
            const map = {};
            res.data.seats.forEach(s => (map[s._id] = s));
            setSeats(map);
          }}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
