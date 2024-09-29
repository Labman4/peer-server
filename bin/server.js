#!/usr/bin/env node
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const { PeerServer } = require('peer');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');

const userHomeDir = os.homedir();
let uri;

try {
  const data = fs.readFileSync(userHomeDir + '/.peer/db_config', 'utf8');
  uri = data;
} catch (err) {
  console.error('Error reading file:', err);
}
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const app = express();
app.use(cors());

const port = 3000;

try {
  const ssl_path = fs.readFileSync(userHomeDir + '/.peer/ssl_config', 'utf8');
} catch (err) {
  console.error('Error reading file:', err);
}

const peerServer = PeerServer({ 
  port: 9091, 
  path: '/app', 
  proxied: true, 
  allow_discovery: true,
  ssl: {
		key: fs.readFileSync(ssl_path + ".key"),
		cert: fs.readFileSync(ssl_path + ".crt"),
	},
  }
);

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