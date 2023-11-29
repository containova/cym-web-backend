const Messages = require('../constants/messages');
const { sendResponse, getEpochTime, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { MOVEMENT_LOGS } = require('../constants/collections');
const Config = require("../constants/configuration");

const getMovementLogDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let logs;
        let obj = {};
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        obj["organizationId"] = req.query.organizationId;
        obj["fsId"] = req.query.fsId;

        if (req.query.containerId) {
            obj["containerId"] = {
                $regex: `.*${req.query.containerId}.*`,
                $options: "i",
            };
        };

        if (req.query.containerSizeId) {
            obj["containerSizeId"] = parseInt(req.query.containerSizeId);
        };

        if (req.query.zone) {
            obj["currentZoneName"] = {
                $regex: `.*${req.query.zone}.*`,
                $options: "i",
            };
        };

        if (req.query.fromDate) {
            obj["movementDetails.activityTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lt": getEpochTime(filter = true)
            }
        };

        if (req.query.toDate) {
            obj["movementDetails.activityTime"] = {
                "$lte": parseInt(req.query.toDate)
            };
        };

        if (req.query.toDate && req.query.fromDate) {
            obj["movementDetails.activityTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lt": parseInt(req.query.toDate)
            }
        };

        obj = { ...obj, ...{ "movementDetails.machineId": { $exists: true } } };

        let pipeline = [
            {
                $match: obj
            },
            {
                $unwind: "$movementDetails"
            },
            {
                $lookup: {
                    from: "machines",
                    localField: "movementDetails.machineId",
                    foreignField: "machineId",
                    as: "machineInfo"
                }
            },
            {
                $addFields: {
                    "movementDetails.machineName": { $first: "$machineInfo.machineName" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    containerId: { $first: "$containerId" },
                    containerSizeId: { $first: "$containerSizeId" },
                    currentZoneName: { $first: "$currentZoneName" },
                    movementDetails: { $push: "$movementDetails" },
                    fsId: { $first: "$fsId" },
                    organizationId: { $first: "$organizationId" }
                }
            },
            {
                $skip: skip
            },
            {
                $limit: size
            }
        ]

        logs = await client
            .collection(MOVEMENT_LOGS)
            .aggregate(pipeline)
            .toArray();

        if (!logs.length)
            return sendResponse(res, 204, true, Messages.NO_MOVEMENT_LOGS);

        return sendResponse(res, 200, true, Messages.MOVEMENT_LOGS_FETCHED, logs);

    } catch (err) {

        await genericErrorLog(err, 'getMovementLogDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getMachineSpecificMovementLog = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let movementDetails = await client
            .collection(MOVEMENT_LOGS)
            .find(
                {
                    organizationId: req.query.organizationId,
                    fsId: req.query.fsId,
                    "movementDetails": { "$elemMatch": { machineId: req.params.machineId } }
                }
            )
            .toArray();

        if (!movementDetails.length)
            return sendResponse(res, 204, true, Messages.NO_MACHINE_MOVEMENTS);

        return sendResponse(res, 200, true, Messages.MOVEMENT_LOGS_FETCHED, movementDetails);

    } catch (err) {

        await genericErrorLog(err, 'getMachineSpecificMovementLog');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    getMovementLogDetails,
    getMachineSpecificMovementLog
};