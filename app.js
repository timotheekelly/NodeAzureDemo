const http = require('http');
const { BlobServiceClient } = require('@azure/storage-blob');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI;
const accountName = process.env.ACCOUNT_NAME;
const sasToken = process.env.SAS_TOKEN;
const containerName = process.env.CONTAINER_NAME;

const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net/?${sasToken}`);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function uploadImageStreamed(blobName, dataStream) {
  const blobClient = containerClient.getBlockBlobClient(blobName);
  await blobClient.uploadStream(dataStream);
  return blobClient.url;
}

async function storeMetadata(name, caption, fileType, imageUrl) {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db("tutorial").collection('metadata');
  await collection.insertOne({ name, caption, fileType, imageUrl });
  await client.close();
}

async function handleImageUpload(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/upload' && req.method === 'POST') {
    try {
      // Extract metadata from headers
      const contentType = req.headers['content-type'];
      const contentDisposition = req.headers['content-disposition'] || '';
      const caption = req.headers['x-image-caption'] || 'No caption provided';
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      const filename = (matches && matches[1]) || `image-${Date.now()}`;
      const fileType = contentType.split('/')[1];

      // Upload the image as a stream
      const imageUrl = await uploadImageStreamed(filename, req);

      // Store the metadata in MongoDB
      await storeMetadata(filename, caption, fileType, imageUrl);

      res.writeHead(201);
      res.end(JSON.stringify({ message: 'Image uploaded and metadata stored successfully', imageUrl }));
    } catch (error) {
      console.error('Error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
}

const server = http.createServer(handleImageUpload);
const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});