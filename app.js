const http = require('http');
const { BlobServiceClient } = require('@azure/storage-blob');
const { MongoClient } = require('mongodb');
const { Readable } = require('stream');
require('dotenv').config(); // Load environment variables from .env file

// Your MongoDB connection URI
const mongoUri =  process.env.MONGO_URI; // Replace with your connection string

// Your Azure Blob Storage account details
const accountName = process.env.ACCOUNT_NAME; // Replace with your account name
const sasToken = process.env.SAS_TOKEN; // Replace with your SAS token
const containerName = 'blobby'; // Replace with your container name

// Initialize the BlobServiceClient with the SAS token
const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net/?${sasToken}`);

// Create a container client to interact with the container
const containerClient = blobServiceClient.getContainerClient(containerName);

// Function to upload an image to Azure Blob Storage using streams
async function uploadImageStreamed(name, fileType, dataStream, contentType) {
  const blobName = `${name}.${fileType}`;
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const options = {
    blobHTTPHeaders: {
      blobContentType: contentType
    }
  };

  // Upload the image data to Azure Blob Storage using a stream
  await blobClient.uploadStream(dataStream, undefined, undefined, options);

  return blobClient.url;
}

// Convert base64 string to stream
function base64ToStream(base64String) {
  const buffer = Buffer.from(base64String, 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // EOF
  return stream;
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
          const { name, caption, fileType, data } = JSON.parse(body);
          const dataStream = base64ToStream(data);
      
          const contentType = `image/${fileType}`;
          const imageUrl = await uploadImageStreamed(name, fileType, dataStream, contentType);      

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
    } 
    else {
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
  console.log(process.env); 
  console.log(`Server listening on port ${port}`);
});
