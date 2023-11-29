const { MongoClient } = require('mongodb');
const { DB_NAME } = require('../constants/collections');

function dbService() {

    let client = null;
    const url = process.env.DB_URL || "mongodb://0.0.0.0:27017"

    async function getClient() {

        if (client)
            return client.db(DB_NAME);

        client = new MongoClient(url);

        try {
            await client.connect();
            console.log('Database connected successfully!');
        }
        catch (err) {
            console.log('Database connection error: ', err.toString());
            return null;
        }

        return client.db(DB_NAME);
    }

    return { getClient };
}

module.exports = dbService();
