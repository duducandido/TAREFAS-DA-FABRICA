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
            // Ensure no _id is present if it's a new task
            if (newTask._id) delete newTask._id;
            await collection.insertOne(newTask);
            res.status(201).json({ message: 'Tarefa salva!' });
        } else if (req.method === 'PUT') {
            const updateData = { ...req.body };
            const id = updateData.id;

            // CRITICAL: MongoDB does not allow updating the _id field.
            // Even if the value is the same, it must be removed from the $set object.
            delete updateData._id;
            // Also remove 'id' from the update payload since it's the identifier
            delete updateData.id;

            const query = {
                $or: [
                    { id: id },
                    { id: String(id) },
                    { id: Number(id) || -1 }
                ]
            };

            const result = await collection.updateOne(query, { $set: updateData });

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Tarefa não encontrada' });
            }

            res.status(200).json({ message: 'Tarefa atualizada!' });
        } else if (req.method === 'DELETE') {
            const { id } = req.query;
            const query = {
                $or: [
                    { id: id },
                    { id: String(id) },
                    { id: Number(id) || -1 }
                ]
            };
            await collection.deleteOne(query);
            res.status(200).json({ message: 'Tarefa excluída!' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Erro no servidor: ' + error.message });
    }
};
