const Messages = require('../constants/messages');
const { sendResponse, getEpochTime } = require('../lib/utils');
const dbService = require('../lib/database');
const { DEMO } = require('../constants/collections');

const postdemoInfo = async (req, res) => {
    try {

        const client = await dbService.getClient();

        let obj = req.body;
        obj.timestamp = getEpochTime();

        await client
            .collection(DEMO)
            .insertOne(obj);

        return sendResponse(res, 201, true, Messages.DETAILS_ADDED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const getDemoInfo = async (req, res) => {
    try {

        const client = await dbService.getClient();

        let info = await client
            .collection(DEMO)
            .aggregate([
                {
                  $sort: {
                    timestamp: -1,
                  },
                },
                {
                  $limit: 1,
                },
              ])
            .toArray();
        
        if (!info.length)
            return sendResponse(res, 400, false, Messages.NO_INFO_FOUND);

        return sendResponse(res, 200, true, Messages.INFO_FETCED, info);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
    }
}
module.exports = {
    postdemoInfo,
    getDemoInfo
}