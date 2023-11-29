const Messages = require('../constants/messages')
const { sendResponse, getEpochTime, getUniqueId, getNextSequence, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { getNearestMachine } = require('../services/machine.service')
const { JOB_CARDS } = require('../constants/collections')
const Config = require("../constants/configuration");
const { DONE, OPEN } = require('../constants/status');
const { JOB_CARD_ID } = require('../constants/sequence');
const socketIOClient = require("socket.io-client");


const createJobCard = async (req, res) => {

    try {
        if (!req.body.automaticGenerate) {
            await saveActivityLog(req, res);
        }
        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();
        let jobcard = req.body;
        jobcard.status = OPEN;
        console.log("JOB Card ", JSON.stringify(jobcard));
        let machineId = getNearestMachine();
        if (!jobcard.machineId) {
            jobcard.machineId = machineId;
        }

        if (!jobcard.jobCardId)
            jobcard.jobCardId = await getNextSequence(client, JOB_CARD_ID);

        let matchBy = {
            organizationId: req.body.organizationId,
            fsId: req.body.fsId,
            jobCardId: parseInt(jobcard.jobCardId)
        };

        let obj = {};
        if (jobcard.jobCardId) {
            obj.jobCardId = jobcard.jobCardId;
        }

        if (jobcard.containerId)
            obj.containerId = jobcard.containerId;

        if (jobcard.modifiedBy)
            obj.modifiedBy = jobcard.modifiedBy;

        if (jobcard.fromLocation)
            obj.fromLocation = jobcard.fromLocation;

        if (jobcard.toLocation)
            obj.toLocation = jobcard.toLocation;

        if (jobcard.priorityId)
            obj.priorityId = jobcard.priorityId;

        if (jobcard.purposeId)
            obj.purposeId = jobcard.purposeId;

        if (jobcard.trailerNo)
            obj.trailerNo = jobcard.trailerNo;

        if (jobcard.zoneId)
            obj.zoneId = jobcard.zoneId;

        if (jobcard.machineId)
            obj.machineId = jobcard.machineId;

        if (jobcard.movementTypeId)
            obj.movementTypeId = jobcard.movementTypeId;

        if (jobcard.estimatedDate)
            obj.estimatedDate = jobcard.estimatedDate;

        if (jobcard.status)
            obj.status = jobcard.status;

        await client
            .collection(JOB_CARDS)
            .findOneAndUpdate(
                matchBy,
                {
                    $set: obj
                },
                { upsert: true, returnNewDocument: true }
            );

        const socketObject = socketIOClient(`${process.env.SOCKET_URL}?machineId=${jobcard.machineId}`);
        await new Promise((resolve, reject) => {
            try {
                socketObject.emit("task", obj)
                resolve({
                    message: 'Emit Success',
                    data: obj
                })
                console.log("emitted data ", obj);
            } catch (err) {
                reject(err)
            }
        })
        if (jobcard.automaticGenerate) {
            return
        }

        return sendResponse(res, 201, true, Messages.JOB_CARD_ADDED, obj);

    } catch (err) {

        await genericErrorLog(err, 'createJobCard');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getAssignedJobCards = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            machineId: req.params.machineId,
            status: OPEN
        };
        console.log(matchBy);
        const client = await dbService.getClient();

        let jobcards = await client
            .collection(JOB_CARDS)
            .find(matchBy)
            .toArray();

        if (!jobcards.length)
            return sendResponse(res, 204, true, Messages.NO_JOB_CARDS_ASSIGNED, []);

        return sendResponse(res, 200, true, Messages.JOB_CARDS_FETCHED, jobcards);

    } catch (err) {

        await genericErrorLog(err, 'getAssignedJobCards');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const updateJobCard = async (req, res) => {
    //TODO some updates required
    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            machineId: req.params.machineId
        };

        const client = await dbService.getClient();

        let jobCardUpdate = await client
            .collection(JOB_CARDS)
            .updateOne(
                matchBy,
                {
                    $set:
                    {
                        status: DONE
                    }
                },
                {
                    upsert: false
                }
            );

        if (jobCardUpdate.modifiedCount == 1)
            return sendResponse(res, 200, true, Messages.MACHINE_UPDATED_SUCCESSFULLY);

    } catch (err) {

        await genericErrorLog(err, 'updateJobCard');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getJobCardDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let jobcards;
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

        if (req.query.movementTypeId)
            obj["movementTypeId"] = parseInt(req.query.movementTypeId);

        if (req.query.machineId)
            obj["machineId"] = req.query.machineId;

        if (req.query.zoneId)
            obj["zoneId"] = parseInt(req.query.zoneId);

        if (req.query.purposeId)
            obj["purposeId"] = parseInt(req.query.purposeId);

        if (req.query.fromDate) {
            obj["$or"] = [
                {
                    "actualTime": {
                        "$gte": parseInt(req.query.fromDate)
                    }
                },
                {
                    "estimatedDate": {
                        "$gte": parseInt(req.query.fromDate)
                    }
                },

            ]
            // obj["actualTime"] = {
            //     "$gte": parseInt(req.query.fromDate)
            // }
        };

        if (req.query.toDate) {
            obj["$or"] = [
                {
                    "actualTime": {
                        "$lte": parseInt(req.query.toDate)
                    }
                },
                {
                    "estimatedDate": {
                        "$lte": parseInt(req.query.toDate)
                    }
                },

            ]
            // obj["actualTime"] = {
            //     "$lte": parseInt(req.query.toDate)
            // }
        };

        if (req.query.toDate && req.query.fromDate) {
            obj["$or"] = [
                {
                    "actualTime": {
                        "$gte": parseInt(req.query.fromDate),
                        "$lt": parseInt(req.query.toDate)
                    }
                },
                {
                    "estimatedDate": {
                        "$gte": parseInt(req.query.fromDate),
                        "$lt": parseInt(req.query.toDate)
                    }
                },

            ]
            // obj["actualTime"] = {
            //     "$gte": parseInt(req.query.fromDate),
            //     "$lt": parseInt(req.query.toDate)
            // }
        };

        const pipeline = [
            {
                "$match": obj
            },
            {
                '$lookup': {
                    'from': 'movementTypes',
                    'localField': 'movementTypeId',
                    'foreignField': 'movementTypeId',
                    'as': 'movementTypeDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'machines',
                    'localField': 'machineId',
                    'foreignField': 'machineId',
                    'as': 'machineDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'zone',
                    'localField': 'zoneId',
                    'foreignField': 'zoneId',
                    'as': 'zoneDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'purpose',
                    'localField': 'purposeId',
                    'foreignField': 'purposeId',
                    'as': 'purposeDetails'
                }
            },
            { "$sort": { _id: -1 } },
            {
                "$facet": {
                    "metadata": [
                        { "$count": "total" }
                    ],
                    "data": [
                        { "$skip": skip },
                        { "$limit": size }
                    ]
                }
            },
            {
                "$project": {
                    "total": { "$arrayElemAt": ["$metadata.total", 0] },
                    "data": 1,
                }
            }
        ];
        console.log(JSON.stringify(obj));

        jobcards = await client
            .collection(JOB_CARDS)
            .aggregate(pipeline)
            .toArray();

        if (!jobcards.length)
            return sendResponse(res, 204, true, Messages.NO_JOB_CARD_FOUND, []);

        return sendResponse(res, 200, true, Messages.CONTAINERS_FETCHED_SUCCESSFULLY, jobcards);

    } catch (err) {

        await genericErrorLog(err, 'getJobCardDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getSingleJobCardDetails = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            jobCardId: parseInt(req.params.jobCardId)
        }

        const client = await dbService.getClient();

        let jobCardDetails = await client
            .collection(JOB_CARDS)
            .findOne(matchBy);

        if (!jobCardDetails)
            return sendResponse(res, 204, true, Messages.NO_JOB_CARD_FOUND, []);

        return sendResponse(res, 200, true, Messages.JOB_CARDS_FETCHED, jobCardDetails);

    } catch (err) {

        await genericErrorLog(err, 'getSingleJobCardDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    createJobCard,
    getAssignedJobCards,
    updateJobCard,
    getJobCardDetails,
    getSingleJobCardDetails
}
