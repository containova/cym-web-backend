const Messages = require('../constants/messages');
const { sendResponse, getEpochTime, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { TRAILERS } = require('../constants/collections');
const Config = require("../constants/configuration");

const getTrailerDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let obj1 = {};
        let obj2 = {}
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        obj1["organizationId"] = req.query.organizationId;
        obj1["fsId"] = req.query.fsId;

        obj2["organizationId"] = req.query.organizationId;
        obj2["fsId"] = req.query.fsId;

        if (req.query.trailerNo) {

            obj1["trailerNo"] = {
                $regex: `.*${req.query.trailerNo}.*`,
                $options: "i",
            };

            obj2["trailerNo"] = {
                $regex: `.*${req.query.trailerNo}.*`,
                $options: "i",
            };

        };

        if (req.query.containerId) {

            obj1["gateInDetails.containerId"] = {
                $regex: `.*${req.query.containerId}.*`,
                $options: "i",
            };

            obj2["gateOutDetails.containerId"] = {
                $regex: `.*${req.query.containerId}.*`,
                $options: "i",
            };

        };

        if (req.query.withinYard) {

            obj1["withinYard"] = JSON.parse(req.query.withinYard);
            obj2["withinYard"] = JSON.parse(req.query.withinYard);

        };

        if (req.query.purposeId) {

            obj1["gateInDetails.purposeId"] = parseInt(req.query.purposeId);
            obj2["gateOutDetails.purposeId"] = parseInt(req.query.purposeId);

        };

        if (req.query.fromDate) {

            obj1["gateInDetails.gateInTime"] = {
                "$gte": parseInt(req.query.fromDate)
            };
            obj2["gateOutDetails.gateOutTime"] = {
                "$gte": parseInt(req.query.fromDate)
            };

        };

        if (req.query.toDate) {

            obj1["gateInDetails.gateInTime"] = {
                "$lte": parseInt(req.query.toDate)
            };
            obj2["gateOutDetails.gateOutTime"] = {
                "$lte": parseInt(req.query.toDate)
            };

        };

        if (req.query.toDate && req.query.fromDate) {

            obj1["gateInDetails.gateInTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lt": parseInt(req.query.toDate)
            };

            obj2["gateOutDetails.gateOutTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lt": parseInt(req.query.toDate)
            };

        };

        const client = await dbService.getClient();

        let trailers = await Promise.all([

            await client
                .collection(TRAILERS)
                .aggregate([{
                    $match: obj1
                },
                {
                    $project: {
                        trailerNo: 1,
                        withinYard: 1,
                        gateInDetails: 1
                    }
                }])
                .toArray(),

            await client
                .collection(TRAILERS)
                .aggregate([{
                    $match: obj2
                },
                {
                    $project: {
                        trailerNo: 1,
                        withinYard: 1,
                        gateOutDetails: 1
                    }
                }])
                .toArray()

        ]);

        if (!trailers[0].length && !trailers[1].length)
            return sendResponse(res, 204, true, Messages.NO_TRAILERS_FOUND);

        let response = [...trailers[0], ...trailers[1]];
        let count = response.length;

        response.sort((a, b) => b._id.toString().localeCompare(a._id.toString()));

        response = response.splice(skip, size);

        let data = [
            {
                data: response,
                total: count
            }
        ]

        return sendResponse(res, 200, true, Messages.TRAILERS_FETCHED, data);

    } catch (err) {

        await genericErrorLog(err, 'getTrailerDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const postTrailerDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        if(req.body.withinYard){
            let trailer = await client
            .collection(TRAILERS)
            .find(
                {
                    organizationId: req.body.organizationId,
                    fsId: req.body.fsId,
                    trailerNo: req.body.trailerNo,
                    withinYard: true
                }
            )
            .toArray();

            if (trailer.length)
                return sendResponse(res, 200, false, Messages.TRAILER_ALREADY_PRESENT, trailer);
        }
       

        let obj = {};

        if (req.body.statusId) {

            if (req.body.statusId == 1) {

                obj["withinYard"] = true;
                obj["trailerNo"] = req.body.trailerNo;
                obj["gateInDetails"] = {}
                obj["gateInDetails"]["containerId"] = req.body.containerId;
                obj["gateInDetails"]["zoneId"] = req.body.zoneId;
                obj["gateInDetails"]["purposeId"] = req.body.purposeId;
                obj["gateInDetails"]["createdBy"] = req.body.gateInDetails.modifiedBy;
                obj["gateInDetails"]["gateInTime"] = getEpochTime();
                obj["organizationId"] = req.body.organizationId;
                obj["fsId"] = req.body.fsId;

                await client
                    .collection(TRAILERS)
                    .insertOne(obj);

                return sendResponse(res, 201, true, Messages.TRAILER_DETAILS_ADDED);

            }

            else if (req.body.statusId == 2) {

                obj["withinYard"] = false;
                obj["trailerNo"] = req.body.trailerNo;
                obj["gateOutDetails"] = {}
                obj["gateOutDetails"]["containerId"] = req.body.containerId;
                obj["gateOutDetails"]["zoneId"] = req.body.zoneId;
                obj["gateOutDetails"]["purposeId"] = req.body.purposeId;
                obj["gateOutDetails"]["createdBy"] = req.body.gateOutDetails.modifiedBy;
                obj["gateOutDetails"]["gateOutTime"] = getEpochTime();

                await client
                    .collection(TRAILERS)
                    .findOneAndUpdate(
                        {
                            trailerNo: req.body.trailerNo,
                            withinYard: true
                        },
                        { $set: obj },
                        { upsert: false }
                    );

                return sendResponse(res, 201, true, Messages.TRAILER_DETAILS_UPDATED);

            }

        }

        else if (!req.body.statusId) {

            if (!req.body.hasOwnProperty('withinYard'))
                return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED)

            if (req.body.withinYard) {

                obj["organizationId"] = req.body.organizationId;
                obj["fsId"] = req.body.fsId;
                obj["withinYard"] = true;
                obj["trailerNo"] = req.body.trailerNo;
                obj["gateInDetails"] = {}
                if (req.body.containerId)
                    obj["gateInDetails"]["containerId"] = req.body.containerId;

                obj["gateInDetails"]["zoneId"] = req.body.zoneId;
                obj["gateInDetails"]["purposeId"] = req.body.purposeId;
                obj["gateInDetails"]["createdBy"] = req.body.createdBy;
                obj["gateInDetails"]["gateInTime"] = getEpochTime();

                await client
                    .collection(TRAILERS)
                    .insertOne(obj);

                return sendResponse(res, 201, true, Messages.TRAILER_DETAILS_ADDED);
            }

            else if (!req.body.withinYard) {

                obj["withinYard"] = false;
                obj["trailerNo"] = req.body.trailerNo;
                obj["organizationId"] = req.body.organizationId;
                obj["fsId"] = req.body.fsId;
                obj["gateOutDetails"] = {}
                if (req.body.containerId)
                    obj["gateOutDetails"]["containerId"] = req.body.containerId;

                obj["gateOutDetails"]["zoneId"] = req.body.zoneId;
                obj["gateOutDetails"]["purposeId"] = req.body.purposeId;
                obj["gateOutDetails"]["createdBy"] = req.body.createdBy;
                obj["gateOutDetails"]["gateOutTime"] = getEpochTime();

                await client
                    .collection(TRAILERS)
                    .findOneAndUpdate(
                        {
                            trailerNo: req.body.trailerNo,
                            withinYard: true
                        },
                        { $set: obj },
                        { upsert: false }
                    )
            }
        }

        return sendResponse(res, 201, true, Messages.TRAILER_DETAILS_UPDATED);

    } catch (err) {

        await genericErrorLog(err, 'postTrailerDetails' )
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getAllWithinYardTrailersList = async(req,res)=>{
    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId){
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }
        const client = await dbService.getClient();
        let resu = await client.collection(TRAILERS)
        .find(
            {
                organizationId: req.query.organizationId,
                fsId: req.query.fsId,
                withinYard: true
            }
        )
        .toArray();
        return sendResponse(res, 200, true, Messages.TRAILERS_FETCHED, resu);

    } catch (error) {
        await genericErrorLog(error.toString(), "getAllWithinYardTrailersList")
    }
}

module.exports = {
    getTrailerDetails,
    postTrailerDetails,
    getAllWithinYardTrailersList
}