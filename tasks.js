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
            const { id, _id, ...updateData } = req.body;

            // Busca robusta: tenta encontrar por string ou número
            const query = {
                $or: [
                    { id: id },
                    { id: id.toString() },
                    { id: parseInt(id) || -1 }
                ]
            };

            const result = await collection.updateOne(query, { $set: updateData });

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Tarefa não encontrada no banco' });
            }

            res.status(200).json({ message: 'Tarefa atualizada!' });
        } else if (req.method === 'DELETE') {
            const { id } = req.query;
            const query = {
                $or: [
                    { id: id },
                    { id: id.toString() },
                    { id: parseInt(id) || -1 }
                ]
            };
            await collection.deleteOne(query);
            res.status(200).json({ message: 'Tarefa excluída!' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
};
