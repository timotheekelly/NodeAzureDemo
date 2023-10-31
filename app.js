const http = require('http');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { MongoClient } = require('mongodb');

// Your Azure Blob Storage account details
const accountName = '<your-account-name>';
const accountKey = 'BlobEndpoint=
const containerName = 'blobby'; // Replace with your container name

// Your MongoDB connection URI
const mongoUri =  // Replace with your MongoDB URI

// Initialize a StorageSharedKeyCredential with your storage account name and account key
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// Initialize the BlobServiceClient with the shared key credential
const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);

// Create a container client to interact with the container
const containerClient = blobServiceClient.getContainerClient(containerName);

// Function to upload an image to Azure Blob Storage
async function uploadImage(name, fileType, data) {
  const blobName = `${name}.${fileType}`;
  const blobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the image data to Azure Blob Storage
  await blobClient.upload(data, data.length);

  return blobClient.url;
}

// Function to store metadata in MongoDB
async function storeMetadata(name, caption, fileType, imageUrl) {
  const client = new MongoClient(mongoUri);

  try {
    // Connect to the MongoDB database
    await client.connect();

    // Access the MongoDB collection for metadata (replace 'metadata' with your collection name)
    const collection = client.db().collection('metadata');

    // Insert the metadata into MongoDB
    await collection.insertOne({
      name,
      caption,
      fileType,
      imageUrl,
    });
  } finally {
    // Close the MongoDB connection
    await client.close();
  }
}

// Function to handle the image upload and metadata creation
async function handleImageUpload(req, res) {
  // Set the appropriate response headers
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (req.url === '/api/upload' && req.method === 'POST') {
      // Read data from the request body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          // Parse the JSON data from the request body
          const { name, caption, fileType, data } = JSON.parse(body);

          // Upload the image to Azure Blob Storage
          const imageUrl = await uploadImage(name, fileType, Buffer.from(data, 'base64'));

          // Store metadata in MongoDB
          await storeMetadata(name, caption, fileType, imageUrl);

          // Send a success response
          res.writeHead(201);
          res.end(JSON.stringify({ message: 'Image uploaded and metadata stored successfully' }));
        } catch (error) {
          console.error('Error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid request data' }));
        }
      });
    } else {
      // Handle other API routes or 404 Not Found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Send an error response
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}

// Create an HTTP server
const server = http.createServer(handleImageUpload);

// Set the server to listen on port 3000
const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
