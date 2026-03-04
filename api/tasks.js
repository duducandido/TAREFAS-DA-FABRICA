const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

module.exports = async (req, res) => {
    try {
        const client = await connectToDatabase();
        const database = client.db('taskmanager');
        const collection = database.collection('tasks');

        if (req.method === 'GET') {
            const tasks = await collection.find({}).toArray();
            res.status(200).json(tasks);
        } else if (req.method === 'POST') {
            const newTask = req.body;
            await collection.insertOne(newTask);
            res.status(201).json({ message: 'Tarefa salva!' });
        } else if (req.method === 'PUT') {
            const { id, ...updateData } = req.body;
            await collection.updateOne({ id: id }, { $set: updateData });
            res.status(200).json({ message: 'Tarefa atualizada!' });
        } else if (req.method === 'DELETE') {
            const { id } = req.query;
            await collection.deleteOne({ id: id });
            res.status(200).json({ message: 'Tarefa excluída!' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
