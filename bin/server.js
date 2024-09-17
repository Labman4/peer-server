#!/usr/bin/env node

const { PeerServer } = require('peer');
const express = require('express');

const app = express();
const port = 3000;

let onlinePeers = new Set();

const peerServer = PeerServer({ port: 9091, path: '/app' });

peerServer.on('connection', (client) => {
    const peerId = client.getId();
    console.log(`Peer connected: ${peerId}`);
    onlinePeers.add(peerId);
});

peerServer.on('disconnect', (client) => { 
    const peerId = client.getId();
    console.log(`Peer disconnected: ${peerId}`);
    onlinePeers.delete(peerId);
});

app.get('/online', (req, res) => {
    res.json(Array.from(onlinePeers));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Express server running at http://0.0.0.0:${port}`);
});