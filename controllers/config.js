const { getParsedData, getIGMFileData } = require('../services/parser');
const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { ISO_MASTER_DATA_COLL, CONTAINER_DETAILS, IGM_INFO_DETAILS, CARGO_DETAILS } = require('../constants/collections')


const isoDetailsSave = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.files.isodetails[0])
            return sendResponse(res, 400, false, Messages.FILE_NOT_FOUND_ERROR);

        const isoDetails = getParsedData(req.files.isodetails[0]);

        const client = await dbService.getClient();

        await client
            .collection(ISO_MASTER_DATA_COLL)
            .insertMany(isoDetails);

        return sendResponse(res, 201, true, Messages.ISO_MASTER_POPULATED);

    } catch (err) {

        await genericErrorLog(err, 'isoDetailsSave')
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};


const getISOCodes = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const isoCodes = await client
            .collection(ISO_MASTER_DATA_COLL)
            .find()
            .toArray();

        if (!isoCodes.length)
            return sendResponse(res, 204, true, Messages.ISO_CODES_NOT_FOUND, []);

        return sendResponse(res, 200, true, Messages.ISO_CODES_FETCHED_SUCCESSFULLY, isoCodes);

    } catch (err) {

        await genericErrorLog(err, 'getISOCodes');
        console.log(err)
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getISOCode = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const isoCode = await client
            .collection(ISO_MASTER_DATA_COLL)
            .find({ isoCode: req.params.code })
            .toArray();

        if (!isoCode.length)
            return sendResponse(res, 204, false, Messages.ISO_CODES_NOT_FOUND, []);

        return sendResponse(res, 200, true, Messages.ISO_CODE_FETCHED_SUCCESSFULLY, isoCode);

    } catch (err) {

        await genericErrorLog(err, 'getISOCode')
        console.log(err)
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    isoDetailsSave,
    getISOCodes,
    getISOCode
};