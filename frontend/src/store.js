  'use strict';
  import create from 'zustand';

  const useStore = create(set => ({
    seats: {},
    myId: localStorage.getItem('userId') || ('user-' + Math.random().toString(36).slice(2,9)),
    setSeats: seats => set({ seats }),
    setMyId: id => set({ myId: id })
  }));

  export default useStore;
