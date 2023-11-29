const Messages = require('../constants/messages');
const { sendResponse, getUniqueId, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { YARDS } = require('../constants/collections');

const addYard = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        let obj = req.body;

        if (!obj.yardId)
            obj.yardId = getUniqueId();

        const client = await dbService.getClient();

        await client
            .collection(YARDS)
            .findOneAndUpdate(
                { yardId: obj.yardId },
                { $set: obj },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.YARD_ADDED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

};

const getYards = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let yards = await client
            .collection(YARDS)
            .find()
            .toArray();

        if (!yards.length)
            return sendResponse(res, 404, false, Messages.NO_YARDS_FOUND);

        return sendResponse(res, 200, true, Messages.YARD_DETAILS_FETCHED, yards);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getUniqueYard = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let yard = await client
            .collection(YARDS)
            .findOne({ yardId: req.params.yardId });

        if (!yard)
            return sendResponse(res, 404, false, Messages.NO_YARDS_FOUND);

        return sendResponse(res, 200, true, Messages.YARD_DETAILS_FETCHED, yard);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, true, Messages.INTERNAL_SERVER_ERROR);
    }
};

module.exports = {
    addYard,
    getYards,
    getUniqueYard
}
