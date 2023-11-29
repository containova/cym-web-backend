const { BlockBlobClient, BlobServiceClient } = require('@azure/storage-blob');
const { Readable } = require('stream');
const { genericErrorLog } = require('../lib/utils');
const containerName = 'container-images';

const getBlobName = originalName => {
    const identifier = Math.random().toString().replace(/0\./, ''); // remove "0." from start of string
    return `${identifier}`; //-${originalName}
};

const blobURLGeneration = (req, container_name = 'container-images', res) => {

    const blobName = getBlobName(req.originalname);
    const blobService = new BlockBlobClient(process.env.AZURE_STORAGE_CONNECTION_STRING, container_name, blobName);
    const stream = Readable.from(req.buffer);
    const streamLength = req.buffer.length;

    blobService.uploadStream(stream, streamLength);

    let originalName = req.originalname;
    console.log(blobService.url, blobName, originalName)
    let imageObj = {
        imageUrl: blobService.url,
        storageName: blobName,
        uploadName: originalName
    }
    console.log(imageObj)
    return imageObj;
}

const deleteBlobImage = async (req, res) => {

    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    containerClient.deleteBlob(req.storageName);

}

const downloadBlob = async (obj) => {
    try {
        // Create a BlobServiceClient object using the connection string
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

        // Get a reference to the container
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Get a reference to the blob
        const blobClient = containerClient.getBlobClient(obj.fileName);

        // Download the blob
        const downloadResponse = await blobClient.download();

        // Read the downloaded data
        const data = await streamToBuffer(downloadResponse.readableStreamBody);

        // Convert the data to Base64
        const base64Data = data.toString("base64");

        return base64Data;
    } catch (err) {
        console.log(err);
        await genericErrorLog(err.toString(), downloadBlob)
        return "";
    }
}

// Helper function to convert a readable stream to a buffer
function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on("error", reject);
    });
}



module.exports = {
    blobURLGeneration,
    deleteBlobImage,
    downloadBlob
}
