const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, saveActivityLog, getUniqueId, getEpochTime } = require('../lib/utils');
const dbService = require('../lib/database');
const { NOTIFICATION_LOG, NOTIFICATION_LOG_HIST } = require('../constants/collections')

const addNotification = async (req, res) => {
    try {

        const client = await dbService.getClient();
        if (!req.body.organizationId || !req.body.fsId) {
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }
        let payload = req.body;
        payload["notificationId"] = getUniqueId()
        payload["notifiedTime"] = getEpochTime()
        payload["organizationId"] = req.body.organizationId;
        payload["fsId"] = req.body.fsId;

        await client.collection(NOTIFICATION_LOG).insertOne(payload);
        return sendResponse(res, 200, true, Messages.NOTIFICATION_ADDED);

    } catch (err) {
        console.log(err.toString());
        await genericErrorLog(err.toString(), "addNotification")
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const getNotification = async (req, res) => {
    try {

        const client = await dbService.getClient();
        let obj = {}
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        obj["fsId"] = req.query["fsId"];
        obj["organizationId"] = req.query["organizationId"];

        let data = [];
        data = await client.collection(NOTIFICATION_LOG).find(obj).sort({ _id: -1 }).toArray();
        if (data.length == 0) {
            return sendResponse(res, 204, true, Messages.NOTIFICATION_FETCHED, data);
        }
        return sendResponse(res, 200, true, Messages.NOTIFICATION_FETCHED, data);

    } catch (err) {
        await genericErrorLog(err.toString(), "getNotification")
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const archiveNotificationLog = async () => {
    try {
        let client = await dbService.getClient();
        // Create a new Date object for the current date
        const currentDate = new Date();

        // Subtract days from the current date
        currentDate.setDate(currentDate.getDate() - process.env.NOTIFICATION_ARCHIVE_DAYS);

        // Get the epoch time of three months ago
        const threeDaysAgoEpochTime = Math.floor(currentDate.getTime() / 1000);

        let resu = await client.collection(NOTIFICATION_LOG).find({ notifiedTime: { $lte: threeDaysAgoEpochTime } }).toArray();
        if (resu.length > 0) {
            await client.collection(NOTIFICATION_LOG_HIST).insertMany(resu);
            await client.collection(NOTIFICATION_LOG).deleteMany({ notifiedTime: { $lte: threeDaysAgoEpochTime } })
        }

    } catch (err) {
        console.log(err)
    }
}

module.exports = { addNotification, getNotification, archiveNotificationLog }