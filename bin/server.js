#!/usr/bin/env node
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://woxiangqusia:Ieb8BOsQVN1pptIE@cluster0.mgwsb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

process.env.DEBUG = 'peer:*';

const { PeerServer } = require('peer');
const express = require('express');

const app = express();
app.use(cors());

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



app.use(express.json()); // Middleware to parse JSON bodies

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('peer').collection('user_peer');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

app.get('/online', (req, res) => {
  res.json(Array.from(onlinePeers));
});

// Create
app.post('/peer', async (req, res) => {
  try {
    const collection = await connectToDatabase();
    const { username, peerId } = req.body;
    console.log(peerId);
    // Upsert the document (insert if not exists, update if exists)
    const result = await collection.updateOne(
      { username: username },
      { $set: { peerId: peerId, lastActive: new Date() } },
      { upsert: true }
    ); 
    res.status(200).json(result);
  } catch (error) {
    console.error('Error creating/updating mapping:', error);
    res.status(500).send('');
  }
});

// Get a mapping by username (GET /mappings/:username)
app.get('/user/:username', async (req, res) => {
  try {
    const collection = await connectToDatabase();
    const username = req.params.username;
    console.log(username)
    const mapping = await collection.findOne({ username: username });
    
    if (mapping) {
      res.json(mapping);
      console.log(mapping)
    } else {
      res.status(404).send('');
    }
  } catch (error) {
    console.error('Error retrieving mapping:', error);
    res.status(500).send('');
  }
});

// Read (Get a single item by ID)
app.get('/peer/:id', async (req, res) => {
  try {
    const collection = await connectToDatabase();
    const itemId = req.params.id;
    console.log(itemId);
    const item = await collection.findOne({ peerId: (itemId) });
    if (item) {
      res.json(item);
    } else {
      res.status(404).send('Item not found');
    }
  } catch (error) {
    console.error('Error getting item:', error);
    res.status(500).send('');
  }
});

app.post('/peer/update', async (req, res) => {
  try {
    const collection = await connectToDatabase();
    const { username, peerId } = req.body;
    if (!username || !peerId) {
      return res.status(400).send('Invalid input: username and peerId are required');
    }

    // Upsert the document (insert if not exists, update if exists)
    const result = await collection.updateOne(
      { username: username },  // Filter by username
      { 
        $set: { 
          peerId: peerId,        // Update peerId
          lastActive: new Date(),// Update last active time
        }
      },
      { upsert: true }  // Create a new document if no match is found
    );

    if (result.upsertedCount > 0) {
      // If a new document was created
      res.status(201).json({ message: 'User added and peerId set successfully', result });
    } else {
      // If an existing document was updated
      res.status(200).json({ message: 'peerId updated successfully', result });
    }
  } catch (error) {
    console.error('Error updating peerId:', error);
    res.status(500).send('');
  }
});

app.delete('/user/:username', async (req, res) => {
  try {
    const collection = await connectToDatabase();
    const username = req.params.username;
    const result = await collection.deleteOne({ username: username });
    
    if (result.deletedCount === 1) {
      res.status(200).send('Mapping deleted');
    } else {
      res.status(404).send('');
    }
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).send('');
  }
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Express server running at http://0.0.0.0:${port}`);
});