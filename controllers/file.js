const { sendResponse, genericErrorLog, saveActivityLog } = require('../lib/utils')
const Messages = require('../constants/messages')
const { blobURLGeneration, deleteBlobImage, downloadBlob } = require('../services/blobURL')
const { CONTAINER_IMAGES } = require('../constants/blobContainers');
const { generateCollectionFromExcel } = require('../services/xcel-service');
const dbService = require('../lib/database');
const CircularJSON = require('circular-json');

const uploadToAzureBlob = async (req, res) => {
    // TODO Modify api to store files in different container
    try {
        let count = 0;
        let imageArr = [];
        for (let i = 0; i < req.files.length; i++) {
            // req.files[i].containerName = CONTAINER_IMAGES;
            imageArr[i] = blobURLGeneration(req.files[i], CONTAINER_IMAGES);
            console.log(imageArr[i]);
            count++;
        }

        if (count == req.files.length)
            return sendResponse(res, 201, true, Messages.IMAGES_UPLOADED, imageArr);

    } catch (err) {

        await genericErrorLog(err, 'uploadToAzureBlob')
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const deleteFromAzureBlob = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        let count = 0;

        for (let i = 0; i < req.body.images.length; i++) {
            deleteBlobImage(req.body.images[i])
            count++;
        }

        if (count == req.body.images.length)
            return sendResponse(res, 200, true, Messages.IMAGES_DELETED);

    } catch (err) {

        await genericErrorLog(err, 'deleteFromAzureBlob');
        console.log(err);
        return sendResponse(req, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const downloadBase64FromAzureBlob = async (req, res) => {
    try {
        if (!req.query.fileUrl) {
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED)
        }
        let obj = {}
        let splitArr = req.query.fileUrl.split("/")
        if (splitArr.length > 0) {
            obj["fileName"] = splitArr[splitArr.length - 1];
            let resu = await downloadBlob(obj)
            return sendResponse(res, 200, true, Messages.IMAGES_DOWNLOADED, resu)
        }
        return sendResponse(res, 204, true, Messages.IMAGES_DOWNLOADED, "")
    } catch (err) {
        genericErrorLog(err.toString(), "downloadBase64FromAzureBlob")
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
    }

};

const generateColFromExcel = async (req, res) => {

    try {

        //await saveActivityLog(req, res);

        const fileBuffer = req.file.buffer;
        const collection = generateCollectionFromExcel(fileBuffer);
        //const serializedCollection = CircularJSON.stringify(collection);

        const client = await dbService.getClient();

        await client.collection(req.body.collectionName).insertMany(collection);

        return sendResponse(res, 201, true, Messages.EXCEL_ADDED);

    } catch (err) {

        await genericErrorLog(req, res);
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

}

module.exports = {
    uploadToAzureBlob,
    deleteFromAzureBlob,
    downloadBase64FromAzureBlob,
    generateColFromExcel
};
