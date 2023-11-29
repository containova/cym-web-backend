const Messages = require('../constants/messages');
const { sendResponse, getEpochTime, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { getIGMFileData } = require('../services/parser')
const { ISO_MASTER_DATA_COLL, CONTAINERS, IGM_INFO_DETAILS, CARGO_DETAILS, CONTAINER_DETAILS, CONTAINER_SIZES, CONTAINER_TYPES, SLOTS, BUCKETS } = require('../constants/collections');
const { buildPDF } = require('../services/pdf-service');
const { createExcel } = require('../services/xcel-service')
const Config = require("../constants/configuration");
const { createJobCard } = require('./jobcard');
const { ObjectId } = require('mongodb');
const { CONTAINER_IMAGES } = require('../constants/blobContainers');
const { blobURLGeneration } = require('../services/blobURL');

const getContainersDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();
        let containers;
        let obj = {};
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        obj['organizationId'] = req.query.organizationId;
        obj['fsId'] = req.query.fsId;

        if (req.query.containerId) {
            obj["containerId"] = {
                $regex: `.*${req.query.containerId}.*`,
                $options: "i",
            };
        };
        if (req.query.statusArr) {
            console.log(req.query.statusArr)
            let s = req.query.statusArr.map(ele => parseInt(ele))
            obj["statusId"] = { $in: s };
        };

        if (req.query.statusId) {
            obj["statusId"] = parseInt(req.query.statusId);
        };

        if (req.query.containerSizeId) {
            obj["containerSizeId"] = parseInt(req.query.containerSizeId);
        };

        if (req.query.containerTypeId) {
            obj["containerTypeId"] = parseInt(req.query.containerTypeId);
        };

        if (req.query.fromDate) {
            obj["gateInDetails.gateInTime"] = {
                "$gte": parseInt(req.query.fromDate)
            };
        };

        if (req.query.toDate) {
            obj["gateInDetails.gateInTime"] = {
                "$lte": parseInt(req.query.toDate)
            };
        };

        if (req.query.toDate && req.query.fromDate) {
            obj["gateInDetails.gateInTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lt": parseInt(req.query.toDate)
            };
        };

        const pipeline = [
            {
                "$match": obj
            },
            {
                '$lookup': {
                    'from': 'containerTypes',
                    'localField': 'containerTypeId',
                    'foreignField': 'containerTypeId',
                    'as': 'containerTypeDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'containerSizes',
                    'localField': 'containerSizeId',
                    'foreignField': 'containerSizeId',
                    'as': 'containerSizeDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'users',
                    'localField': 'gateInDetails.modifiedBy.userId',
                    'foreignField': 'userId',
                    'as': 'userDetails'
                }
            },
            {
                '$lookup': {
                    'from': 'damageLevel',
                    'localField': 'damageLevelId',
                    'foreignField': 'damageLevelId',
                    'as': 'damageLevelDetails'
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
        containers = await client
            .collection(CONTAINERS)
            .aggregate(pipeline)
            .toArray();

        if (!containers.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        console.log('containers', containers);

        return sendResponse(res, 200, true, Messages.CONTAINERS_FETCHED_SUCCESSFULLY, containers);

    } catch (err) {

        await genericErrorLog(err, 'getContainersDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};


const getUniqueContainerDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            containerId: req.params.containerId
        };
        console.log('matchBy', matchBy);

        const client = await dbService.getClient();

        const container = await client
            .collection(CONTAINERS)
            .find(matchBy)
            .toArray();

        if (!container.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        return sendResponse(res, 200, true, Messages.CONTAINERS_FETCHED_SUCCESSFULLY, container);

    } catch (err) {

        await genericErrorLog(err, 'getUniqueContainerDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getSingleContainerDetailsWithISOCode = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            containerId: req.query.containerId,
            statusId: { $lt: 2 }
        };
        if (req.query.isoCode) {
            matchBy["isoCode"] = req.query.isoCode
        }

        console.log('matchBy', matchBy);

        const client = await dbService.getClient();

        const container = await client
            .collection(CONTAINERS)
            .find(matchBy)
            .toArray();

        if (!container.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        return sendResponse(res, 200, true, Messages.CONTAINERS_FETCHED_SUCCESSFULLY, container);

    } catch (err) {

        await genericErrorLog(err, 'getSingleContainerDetailsISOCode');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const postContainerDetailsManually = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.body.organizationId,
            fsId: req.body.fsId,
            containerId: req.body.containerId
        };

        const client = await dbService.getClient();

        const container = await client
            .collection(CONTAINERS)
            .find(matchBy)
            .toArray();

        if (container.length > 0) {

            let obj = {}

            if (req.body.containerTypeId)
                obj["containerTypeId"] = req.body.containerTypeId;

            if (req.body.containerSizeId)
                obj["containerSizeId"] = req.body.containerSizeId;

            if (req.body.entryFileNo)
                obj["entryFileNo"] = req.body.entryFileNo;

            if (req.body.gateInDetails.trailerNo)
                obj["gateInDetails.trailerNo"] = req.body.gateInDetails.trailerNo;

            if (req.body.gateInDetails.allocatedMachine)
                obj["gateInDetails.allocatedMachine"] = req.body.gateInDetails.allocatedMachine;

            if (req.body.gateInDetails.modifiedBy)
                obj["gateInDetails.modifiedBy"] = req.body.gateInDetails.modifiedBy;

            if (req.body.gateInDetails.gateInImages)
                obj["gateInDetails.gateInImages"] = req.body.gateInDetails.gateInImages;

            if (req.body.gateInDetails.gateInTypeId)
                obj["gateInDetails.gateInTypeId"] = req.body.gateInDetails.gateInTypeId;

            if (req.body.gateInDetails.comments)
                obj["gateInDetails.comments"] = req.body.gateInDetails.comments;

            if (req.body.gateInDetails.modifiedTime)
                obj["gateInDetails.modifiedTime"] = req.body.gateInDetails.modifiedTime;

            if (req.body.gateInDetails.priorityId)
                obj["gateInDetails.priorityId"] = req.body.gateInDetails.priorityId;

            if (req.body.zoneId)
                obj["zoneId"] = req.body.zoneId;

            if (req.body.isoCode)
                obj["isoCode"] = req.body.isoCode;

            if (req.body.statusId) {
                obj["statusId"] = req.body.statusId;
                obj["gateInDetails.gateInTime"] = getEpochTime();
            };

            if (req.body.onHold) {
                obj["onHold"] = req.body.onHold;
            };

            if (req.body.damageLevelId) {
                obj['damageLevelId'] = req.body.damageLevelId;
            }
            if (req.body.gateInDetails.imageArr) {
                obj["gateInDetails.imageArr"] = req.body.gateInDetails.imageArr
            }
            if (req.body.gateInDetails.loc) {
                obj["gateInDetails.loc"] = req.body.gateInDetails.loc
            }
            if (req.body.isDPD) {
                obj["isDPD"] = req.body.isDPD;
            }
            if (req.body.isHazardous) {
                obj["isHazardous"] = req.body.isHazardous;
            }
            if (req.body.fsId) {
                obj["fsId"] = req.body.fsId;
            }
            if (req.body.organizationId) {
                obj["organizationId"] = req.body.organizationId;
            }
            console.log(obj);
            await client
                .collection(CONTAINERS)
                .updateOne(
                    {
                        fsId: req.body.fsId,
                        organizationId: req.body.organizationId,
                        containerId: req.body.containerId,
                    },
                    {
                        $set: obj
                    },
                    { upsert: false }
                )
            if (req.body.statusId) {
                req.body["automaticGenerate"] = true;
                req.body["movementTypeId"] = 1
                let containerSizeObj = await client.collection(CONTAINER_SIZES).findOne({ containerSizeId: req.body.containerSizeId })
                if (containerSizeObj.containerSize > 20) {
                    req.body["fromLocation"] = [{
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    },
                    {
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    }]
                }
                else {
                    req.body["fromLocation"] = [{
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    }]
                }
                req.body["toLocation"] = req.body.gateInDetails.loc;
                req.body["machineId"] = req.body.gateInDetails.allocatedMachine;
                let obj = req.body["gateInDetails"]
                req.body = { ...req.body, ...obj }
                console.log("Creating Job ", req.body);
                await createJobCard(req, res)
            }
            return sendResponse(res, 200, true, Messages.CONTAINER_UPDATED_SUCCESSFULLY)
        }
        else {
            let containerObj = {
                ...req.body,
                organizationId: req.body.organizationId,
                fsId: req.body.fsId
            };

            await client
                .collection(CONTAINERS)
                .insertOne(containerObj);

            if (req.body.statusId) {
                req.body["automaticGenerate"] = true;
                req.body["movementTypeId"] = 1
                let containerSizeObj = await client.collection(CONTAINER_SIZES).findOne({ containerSizeId: req.body.containerSizeId })
                if (containerSizeObj.containerSize > 20) {
                    req.body["fromLocation"] = [{
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    },
                    {
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    }]
                }
                else {
                    req.body["fromLocation"] = [{
                        "name": "0",
                        "row": "0",
                        "col": 0,
                        "level": 0
                    }]
                }
                req.body["toLocation"] = req.body.gateInDetails.loc;
                req.body["machineId"] = req.body.gateInDetails.allocatedMachine;
                let obj = req.body["gateInDetails"]
                req.body = { ...req.body, ...obj }
                console.log("Creating Job else part ", req.body);
                await createJobCard(req, res)
            }
        }



        return sendResponse(res, 201, true, Messages.CONTAINER_DETAILS_ADDED);

    } catch (err) {

        await genericErrorLog(err, 'postContainerDetailsManually');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const postGateOutDetailsManually = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);


        let matchBy = {
            organizationId: req.body.organizationId,
            fsId: req.body.fsId,
            containerId: req.body.containerId
        };
        console.log(matchBy);
        const client = await dbService.getClient();

        const container = await client
            .collection(CONTAINERS)
            .find(matchBy)
            .toArray();

        if (!container.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        let obj = {}

        if (req.body.containerTypeId)
            obj["containerTypeId"] = req.body.containerTypeId;

        if (req.body.containerSizeId)
            obj["containerSizeId"] = req.body.containerSizeId;

        if (req.body.zoneId)
            obj["zoneId"] = req.body.zoneId;

        if (req.body.gateOutDetails.trailerNo)
            obj["gateOutDetails.trailerNo"] = req.body.gateOutDetails.trailerNo;

        if (req.body.gateOutDetails.machineId)
            obj["gateOutDetails.allocatedMachine"] = req.body.gateOutDetails.machineId;

        if (req.body.gateOutDetails.modifiedBy)
            obj["gateOutDetails.modifiedBy"] = req.body.gateOutDetails.modifiedBy;

        if (req.body.gateOutDetails.gateOutImages)
            obj["gateOutDetails.gateOutImages"] = req.body.gateOutDetails.gateOutImages;

        if (req.body.gateOutDetails.gateOutTypeId)
            obj["gateOutDetails.gateOutTypeId"] = req.body.gateOutDetails.gateOutTypeId;

        if (req.body.gateOutDetails.comments)
            obj["gateOutDetails.comments"] = req.body.gateOutDetails.comments;

        if (req.body.gateOutDetails.modifiedTime)
            obj["gateOutDetails.modifiedTime"] = req.body.gateOutDetails.modifiedTime;

        if (req.body.gateOutDetails.surveyResult)
            obj["gateOutDetails.surveyResult"] = req.body.gateOutDetails.surveyResult;

        if (req.body.gateOutDetails.purposeId)
            obj["gateOutDetails.purposeId"] = req.body.gateOutDetails.purposeId;

        if (req.body.statusId) {
            obj["statusId"] = req.body.statusId;
            obj["gateOutDetails.gateOutTime"] = getEpochTime();
        }
        if (req.body.gateOutDetails.imageArr) {
            obj["gateOutDetails.imageArr"] = req.body.gateOutDetails.imageArr;
        }
        if (req.body.fsId) {
            obj["fsId"] = req.body.fsId;
        }
        if (req.body.organizationId) {
            obj["organizationId"] = req.body.organizationId;
        }

        if (req.body.statusId) {
            req.body["automaticGenerate"] = true;
            req.body["movementTypeId"] = 2;
            let containerSizeObj = await client.collection(CONTAINER_SIZES).findOne({ containerSizeId: req.body.containerSizeId })
            if (containerSizeObj.containerSize > 20) {
                req.body["toLocation"] = [{
                    "name": "0",
                    "row": "0",
                    "col": 0,
                    "level": 0
                },
                {
                    "name": "0",
                    "row": "0",
                    "col": 0,
                    "level": 0
                }]
            }
            else {
                req.body["toLocation"] = [{
                    "name": "0",
                    "row": "0",
                    "col": 0,
                    "level": 0
                }]
            }

            let pipeline = [
                {
                    $match: {
                        organizationId: req.body.organizationId,
                        fsId: req.body.fsId,
                        occupancy: {
                            $elemMatch: {
                                containerId: req.body.containerId,
                            },
                        },
                    },
                },
                {
                    '$lookup': {
                        'from': 'containers',
                        'localField': 'occupancy.containerId',
                        'foreignField': 'containerId',
                        'as': 'containerDetails'
                    }
                },
                {
                    $project: {

                        name: 1,
                        row: 1,
                        col: 1,
                        occupancy: {
                            $filter: {
                                input: "$occupancy",
                                as: "occupancyObj",
                                cond: {
                                    $regexMatch: {
                                        input: "$$occupancyObj.containerId",
                                        regex: req.body.containerId
                                    }
                                },
                            },
                        }
                    },
                }
            ]
            console.log(JSON.stringify(pipeline));
            let containerDetails = await client
                .collection(SLOTS)
                .aggregate(pipeline)
                .toArray()
            if (containerDetails.length > 0) {
                let fromLocationArr = []
                containerDetails.map((ele) => {
                    let obj = {
                        "name": ele.name,
                        "row": ele.row,
                        "col": parseInt(ele.col),
                        "level": parseInt(ele.occupancy[0].level)
                    }
                    fromLocationArr.push(obj)
                })
                req.body["fromLocation"] = fromLocationArr;
            }
            else {
                return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
            }
            let obj = req.body["gateOutDetails"]
            req.body = { ...req.body, ...obj }
            console.log("Create Job");
            await createJobCard(req, res)
        }
        await client
            .collection(CONTAINERS)
            .updateOne(
                { containerId: req.body.containerId },
                {
                    $set: obj
                },
                { upsert: false }
            );
        return sendResponse(res, 200, true, Messages.CONTAINER_UPDATED_SUCCESSFULLY)


    } catch (err) {

        await genericErrorLog(err, 'postGateOutDetailsManually');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const igmDetailsSave = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        if (!req.files.igmdetails[0])
            return sendResponse(res, 400, false, Messages.FILE_NOT_FOUND_ERROR);

        const IGMObj = getIGMFileData(req.files.igmdetails[0]);
        const organizationId = req.body.organizationId;
        const fsId = req.body.fsId;

        let IGMFileDetails = {
            ...IGMObj.IGMInfo,
            organizationId: organizationId,
            fsId: fsId
        };

        let cargoDetails = IGMObj.cargoDetails.map(obj => ({
            ...obj,
            organizationId: organizationId,
            fsId: fsId
        }));


        let containerDetails = IGMObj.containerDetails.map(obj => ({
            ...obj,
            organizationId: organizationId,
            fsId: fsId
        }));

        const client = await dbService.getClient();

        let igmDocNo = await client
            .collection(IGM_INFO_DETAILS)
            .find({
                organizationId: organizationId,
                fsId: fsId,
                IGMDocNo: IGMObj.IGMInfo.IGMDocNo
            })
            .toArray();

        if (igmDocNo.length)
            return sendResponse(res, 409, false, Messages.IGM_FILE_ALREADY_UPLOADED);

        const containers = [];

        for (let i = 0; i < IGMObj.containerDetails.length; i++) {
            let isoCode = await client
                .collection(ISO_MASTER_DATA_COLL)
                .find({ isoCode: IGMObj.containerDetails[i].isoCode })
                .toArray();

            let sizeId = await client
                .collection(CONTAINER_SIZES)
                .findOne({ containerSize: isoCode[0].containerSize });

            let typeId = await client
                .collection(CONTAINER_TYPES)
                .findOne({ containerType: isoCode[0].containerType })

            let container = {
                organizationId: organizationId,
                fsId: fsId,
                containerId: IGMObj.containerDetails[i].containerId,
                entryFileNo: IGMObj.IGMInfo.IGMDocNo,
                containerSizeId: sizeId.containerSizeId,
                containerTypeId: typeId.containerTypeId,
                ISOCode: isoCode[0],
                isoCode: isoCode[0].isoCode,
                statusId: 0,
                gateInDetails: {
                    createdBy: {
                        userId: req.tokenData.userId
                    },
                    createdTime: getEpochTime(),
                    modifiedBy: {
                        userId: req.tokenData.userId
                    },
                    modifiedTime: getEpochTime()
                }
            };

            containers.push(container);
        }

        const result = await Promise.allSettled([

            client
                .collection(CARGO_DETAILS)
                .insertMany(cargoDetails),
            client
                .collection(CONTAINER_DETAILS)
                .insertMany(containerDetails),
            client
                .collection(IGM_INFO_DETAILS)
                .insertOne(IGMFileDetails),
            client
                .collection(CONTAINERS)
                .insertMany(containers)
        ]);

        return sendResponse(res, 201, true, Messages.IGM_DETAILS_SAVED);

    } catch (err) {

        await genericErrorLog(err, 'igmDetailsSave');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const renderContainersPdf = async (req, res) => {
    try {
        const client = await dbService.getClient();
        let containers = await client
            .collection(CONTAINERS)
            .find()
            .toArray()

        req.body = containers
        console.log(req.body)
        buildPDF(req, res)
    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const renderContainerPdf = async (req, res) => {
    try {
        const client = await dbService.getClient();
        let containers = await client
            .collection(CONTAINERS)
            .find({ containerId: req.params.containerId })
            .toArray()

        req.body = containers
        console.log(req.body)
        buildPDF(req, res)
    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const renderContainersExcel = async (req, res) => {
    try {
        const client = await dbService.getClient();
        let containers = await client
            .collection(CONTAINERS)
            .find()
            .toArray()

        req.body = containers
        console.log(req.body)
        // buildPDF(req, res)
        const data = containers;
        const stream = await createExcel([
            { header: 'containerId', key: 'containerId' },
            { header: 'entryFileNo', key: 'entryFileNo' },
            { header: 'containerType', key: 'containerType' },
            { header: 'containerSize', key: 'containerSize' }
        ], data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=containers.xlsx`);
        res.setHeader('Content-Length', stream.length);
        res.send(stream);
    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const renderContainerExcel = async (req, res) => {
    try {
        const client = await dbService.getClient();
        let containers = await client
            .collection(CONTAINERS)
            .find({ containerId: req.params.containerId })
            .toArray()

        req.body = containers
        console.log(req.body)

        const data = containers;
        const stream = await createExcel([
            { header: 'containerId', key: 'containerId' },
            { header: 'entryFileNo', key: 'entryFileNo' },
            { header: 'containerType', key: 'containerType' },
            { header: 'containerSize', key: 'containerSize' }
        ], data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=container.xlsx`);
        res.setHeader('Content-Length', stream.length);
        res.send(stream);
    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const updateContainerDetails = async (req, res) => {

    try {
        // await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            containerId: req.params.containerId
        };

        const client = await dbService.getClient();

        let container = await client
            .collection(CONTAINERS)
            .findOne(matchBy);

        if (!container) {
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        }

        let obj = {}
        obj["damageImages"] = [];
        let containerUpdate;
        console.log(req.files)
        if (req.files) {
            let imageArr = [];
            for (let i = 0; i < req.files.length; i++) {
                imageArr[i] = blobURLGeneration(req.files[i], CONTAINER_IMAGES);
                obj["damageImages"].push(imageArr[i]["imageUrl"])
            }
            containerUpdate = await client
                .collection(CONTAINERS)
                .updateOne(
                    { containerId: req.params.containerId },
                    {
                        $push: { damageImages: { $each: obj["damageImages"] } }
                    },
                    { upsert: false }
                );

        }

        if (req.body.damageLevelId) {
            obj['damageLevelId'] = parseInt(req.body.damageLevelId);
            containerUpdate = await client
                .collection(CONTAINERS)
                .updateOne(
                    { containerId: req.params.containerId },
                    {
                        $set: { damageLevelId: obj["damageLevelId"] }
                    },
                    { upsert: false }
                );
        }


        if (containerUpdate.modifiedCount == 1)
            return sendResponse(res, 200, true, Messages.CONTAINER_UPDATED_SUCCESSFULLY);

    } catch (err) {

        await genericErrorLog(err, 'updateContainerDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getMasterData = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();
        console.log(req.query.collectionName);
        let sortFeild = req.query.collectionName.substr(0, req.query.collectionName.length - 1);
        console.log('sortFeild', sortFeild);

        let data = await client
            .collection(req.query.collectionName)
            .find()
            .sort(sortFeild)
            .toArray();

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, data);

    } catch (err) {

        await genericErrorLog(err, 'getMasterData');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const locateContainer = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();
        let containerDetails = await client
            .collection(SLOTS)
            .aggregate([
                {
                    $match: {
                        fsId: req.query.fsId,
                        organizationId: req.query.organizationId,
                        occupancy: {
                            $elemMatch: {
                                containerId: new RegExp(`.*${req.body.containerId}.*`, "i"),
                            },
                        },
                    },
                },
                {
                    $project: {

                        name: 1,
                        row: 1,
                        col: 1,
                        occupancy: {
                            $filter: {
                                input: "$occupancy",
                                as: "occupancyObj",
                                cond: {
                                    $regexMatch: {
                                        input: "$$occupancyObj.containerId",
                                        regex: new RegExp(`.*${req.body.containerId}.*`, "i")
                                    }
                                },
                            },
                        },
                    },
                },
            ])
            .toArray();

        if (!containerDetails.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        return sendResponse(res, 200, true, Messages.SLOT_FETCHED_SUCCESSFULLY, containerDetails);

    } catch (err) {

        await genericErrorLog(err, 'locateContainer');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getContainerLocation = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;
        console.log(req.query.containerId);
        const client = await dbService.getClient();
        let pipeline = [
            {
                $match: {
                    organizationId: req.query.organizationId,
                    fsId: req.query.fsId,
                    occupancy: {
                        $elemMatch: {
                            containerId: new RegExp(`.*${req.query.containerId}.*`, "i"),
                        },
                    },
                },
            },
            {
                '$lookup': {
                    'from': 'containers',
                    'localField': 'occupancy.containerId',
                    'foreignField': 'containerId',
                    'as': 'containerDetails'
                }
            },
            {
                $project: {

                    name: 1,
                    row: 1,
                    col: 1,
                    occupancy: {
                        $filter: {
                            input: "$occupancy",
                            as: "occupancyObj",
                            cond: {
                                $regexMatch: {
                                    input: "$$occupancyObj.containerId",
                                    regex: new RegExp(`.*${req.query.containerId}.*`, "i")
                                }
                            },
                        },
                    },
                    containerSizeId: {
                        $first: '$containerDetails.containerSizeId'
                    },
                    damageImages: {
                        $first: "$containerDetails.damageImages"
                    },
                    latestPositionImage: { $first: '$containerDetails.latestPositionImage' },
                    damageLevelId: {
                        $first: "$containerDetails.damageLevelId"
                    },

                },
            }
        ]
        console.log(JSON.stringify(pipeline));
        let containerDetails = await client
            .collection(SLOTS)
            .aggregate(pipeline)
            .toArray()

        if (!containerDetails.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINERS_FOUND, []);

        return sendResponse(res, 200, true, Messages.SLOT_FETCHED_SUCCESSFULLY, containerDetails);

    } catch (err) {

        await genericErrorLog(err, 'getContainerLocation');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const suggestLocation = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let pipeline = [
            {
                $match:
                {
                    organizationId: req.query.organizationId,
                    fsId: req.query.fsId,
                    $and: [
                        {
                            $or: [
                                { 'rules.containerSizeId': null },
                                {
                                    'rules.containerSizeId': {
                                        $elemMatch: { $eq: parseInt(req.query.containerSizeId) }
                                    }
                                }
                            ]
                        },
                        {
                            $or: [
                                { "rules.containerTypeId": null },
                                {
                                    'rules.containerTypeId': {
                                        $elemMatch: { $eq: parseInt(req.query.containerTypeId) }
                                    }
                                }
                            ]
                        },
                        {
                            $or: [
                                { 'rules.shippingLineName': "" },
                                {
                                    'rules.shippingLineName': {
                                        $elemMatch: { $eq: req.query.containerId.substring(0, 3) }
                                    }
                                }
                            ]
                        },
                        {
                            $or: [
                                { 'rules.processId': null },
                                {
                                    'rules.processId': {
                                        $elemMatch: { $eq: parseInt(req.query.gateInTypeId) }
                                    }
                                }
                            ]
                        }
                    ],
                    'rules.isHazardous': req.query.hasOwnProperty("isHazardous") ? JSON.parse(req.query.isHazardous) : false,
                    'rules.isDPD': req.query.hasOwnProperty("isDPD") ? JSON.parse(req.query.isDPD) : false,
                    'rules.onHold': req.query.hasOwnProperty("onHold") ? JSON.parse(req.query.onHold) : false
                }
            },
            {
                $sort: {
                    sortId: 1
                }
            }
        ];

        let matchingBuckets = await client
            .collection(BUCKETS)
            .aggregate(pipeline)
            .toArray();

        // console.log("pipeline ", JSON.stringify(pipeline))
        // console.log("matchingBuckets ", matchingBuckets);

        if (matchingBuckets.length == 0) {
            console.log("Hi there")
            let suggestedSlots = await noBucketSlots(req, res);
            if (!suggestedSlots.length)
                return sendResponse(res, 204, true, Messages.NO_SLOTS_FOUND, []);

            return sendResponse(res, 200, true, Messages.SUGGESTED_SLOTS_FETCHED, suggestedSlots);
        };


        let slotsArr = [];

        for (let i = 0; i < matchingBuckets.length; i++) {

            const pipeline2 = [
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        bucketId: matchingBuckets[i].bucketId,
                    }
                },
                {
                    $project: {
                        _id: 1,
                        bucketName: 1,
                        bucketId: 1,
                        color: 1,
                        slotIdObj: {
                            $map: {
                                input: "$slotIds",
                                as: "slotId",
                                in: {
                                    $convert: {
                                        input: "$$slotId",
                                        to: "objectId",
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $lookup: {
                        from: "slots",
                        localField: "slotIdObj",
                        foreignField: "_id",
                        as: "result",
                    },
                },
                { $unwind: "$result" },
                { $unwind: "$result.occupancy" },
                {
                    $match: {
                        "result.occupancy.status": "empty",
                    },
                },
                {
                    $group: {
                        _id: {
                            name: "$result.name",
                            row: "$result.row",
                            col: "$result.col",
                        },
                        level: {
                            $push: "$result.occupancy.level",
                        },
                    },
                },

                {
                    $project: {
                        name: "$_id.name",
                        row: "$_id.row",
                        col: "$_id.col",
                        level: {
                            $first: "$level"
                        },
                        _id: 0,
                    },
                },
                {
                    $sort: {
                        name: 1,
                        row: 1,
                        col: 1,
                        level: 1,
                    },
                },
            ]

            const emptySlots = await client
                .collection(BUCKETS)
                .aggregate(pipeline2)
                .toArray();

            slotsArr = [];

            if (req.query.containerSizeId == 2 || req.query.containerSizeId == 3) {
                for (let e = 0; e < emptySlots.length - 1; e++) {

                    let obj = emptySlots[e];
                    let suggestedLocation = [];
                    let name = obj.name;
                    let row = obj.row;
                    let col = obj.col;
                    let level = obj.level;

                    if (name == emptySlots[e + 1].name && row == emptySlots[e + 1].row && (col + 1) == emptySlots[e + 1].col && level == emptySlots[e + 1].level) {

                        if (level == 1) {
                            suggestedLocation.push(emptySlots[e]);
                            suggestedLocation.push(emptySlots[e + 1]);
                        }

                        else {

                            let slotDetails = await client
                                .collection(SLOTS)
                                .aggregate([
                                    {
                                        $match: {
                                            fsId: req.query.fsId,
                                            name: name,
                                            row: row,
                                            $or: [{ col: col }, { col: col + 1 }],
                                            occupancy: { $elemMatch: { level: level - 1 } },
                                        },
                                    },
                                    {
                                        $project: {
                                            occupancyDetails: {
                                                $arrayElemAt: [
                                                    {
                                                        $map: {
                                                            input: "$occupancy",
                                                            as: "element",
                                                            in: {
                                                                $cond: [
                                                                    {
                                                                        $eq: [
                                                                            "$$element.level",
                                                                            level - 1,
                                                                        ],
                                                                    },
                                                                    "$$element",
                                                                    null,
                                                                ],
                                                            },
                                                        },
                                                    },
                                                    0,
                                                ],
                                            },
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "containers",
                                            localField: "occupancyDetails.containerId",
                                            foreignField: "containerId",
                                            as: "result"
                                        }
                                    },
                                    {
                                        $project: {
                                            container: { $first: "$result" },

                                        }
                                    },
                                    {
                                        $project: {
                                            containerSizeId: "$container.containerSizeId"
                                        }
                                    }
                                ])
                                .toArray();

                            const isValidContainerSizeId = slotDetails.every(document => {
                                const containerSizeId = document.containerSizeId;
                                return containerSizeId === 2 || containerSizeId === 3;
                            });

                            if (!isValidContainerSizeId) {

                            }

                            else {
                                suggestedLocation.push(emptySlots[e]);
                                suggestedLocation.push(emptySlots[e + 1]);
                            }

                        }
                    }

                    if (suggestedLocation.length) {
                        slotsArr.push(suggestedLocation);
                        if (slotsArr.length > 2) {
                            break;
                        }
                    }
                }

            }


            else if (req.query.containerSizeId == 1) {

                for (let k = 0; k < emptySlots.length; k++) {

                    if (emptySlots[k].level == 1) {
                        slotsArr.push(emptySlots[k]);
                        if (slotsArr.length > 2) {
                            break;
                        }
                    }
                    else {

                        let containerSizeDetails = await client
                            .collection(SLOTS)
                            .aggregate([
                                {
                                    $match: { fsId: req.query.fsId }
                                },
                                { $unwind: "$occupancy" },
                                {
                                    $match: {
                                        name: emptySlots[k].name,
                                        row: emptySlots[k].row,
                                        col: emptySlots[k].col,
                                        "occupancy.level": emptySlots[k].level - 1,

                                    }
                                },
                                {
                                    $lookup: {
                                        from: "containers",
                                        localField: "occupancy.containerId",
                                        foreignField: "containerId",
                                        as: "containers"
                                    }
                                },
                                {
                                    $project: {
                                        containerDetails: { $first: "$containers" }
                                    }
                                },
                                {
                                    $project: {
                                        containerSizeId: "$containerDetails.containerSizeId"
                                    }
                                }
                            ])
                            .toArray();

                        if (containerSizeDetails.length) {
                            if (containerSizeDetails[0].containerSizeId == 1) {
                                slotsArr.push(emptySlots[k])
                                if (slotsArr.length > 2) {
                                    break;
                                }
                            }
                        }
                    }
                }

            }

        };

        if (!slotsArr.length) {

            let suggestedSlots = await noBucketSlots(req, res);

            if (!suggestedSlots.length)
                return sendResponse(res, 204, true, Messages.NO_SLOTS_FOUND, []);

            return sendResponse(res, 200, true, Messages.SUGGESTED_SLOTS_FETCHED, suggestedSlots);

        }

        return sendResponse(res, 200, true, Messages.SLOTS_FETCHED_SUCCESSFULLY, slotsArr);

    } catch (err) {

        await genericErrorLog(err, "suggestLocation");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

}

// const getEmptySlots = async (req, res) => {

//     try {

//         await saveActivityLog(req, res);

//         if (!req.query.organizationId || !req.query.fsId)
//             return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

//         const client = await dbService.getClient();

//         let matchingBuckets = await client
//             .collection(BUCKETS)
//             .aggregate[(
//                 {
//                     $match:
//                     {

//                         organizationId: req.query.organizationId,
//                         fsId: req.query.fsId,
//                         $or: [
//                             { 'rules.containerSizeId': null },
//                             {
//                                 'rules.containerSizeId': {
//                                     $elemMatch: { $eq: req.query.containerId }
//                                 }
//                             }
//                         ],
//                         $or: [
//                             { "rules.containerTypeId": null },
//                             {
//                                 'rules.containerSizeId': {
//                                     $elemMatch: { $eq: req.query.containerTypeId }
//                                 }
//                             }
//                         ],
//                         $or: [
//                             { 'rules.shippingLine': null },
//                             {
//                                 'rules.shippingLine': {
//                                     $elemMatch: { $eq: req.query.shippingLine }
//                                 }
//                             }
//                         ],
//                         $or: [
//                             { 'rules.destuffMode': null },
//                             {
//                                 'rules.destuffMode': {
//                                     $elemMatch: { $eq: req.query.destuffMode }
//                                 }
//                             }
//                         ],
//                         $or: [
//                             { 'rules.process': null },
//                             {
//                                 'rules.process': {
//                                     $elemMatch: { $eq: req.query.gateInType }
//                                 }
//                             }
//                         ],
//                         'rules.hazardous': req.query.hazardous,
//                         'rules.DPD': req.query.OPD,
//                         'rules.onHold': req.query.onHold

//                     }
//                 },
//                 {
//                     $sort: {
//                         priority: 1
//                     }
//                 }
//             )]
//             .toArray();

//         if (!matchingBuckets.length)
//             return await noBucketSlot(req, res);


//         let emptySlots = await client
//             .collection(BUCKETS)
//             .aggregate([
//                 {
//                     $match: {
//                         "rules.containerSize.containerSizeId": 1,
//                     },
//                 },
//                 {
//                     $project: {
//                         _id: 1,
//                         bucketName: 1,
//                         bucketId: 1,
//                         color: 1,
//                         slotIdObj: {
//                             $map: {
//                                 input: "$slotIds",
//                                 as: "slotId",
//                                 in: {
//                                     $convert: {
//                                         input: "$$slotId",
//                                         to: "objectId",
//                                     },
//                                 },
//                             },
//                         },
//                     },
//                 },
//                 {
//                     $lookup: {
//                         from: "slots",
//                         localField: "slotIdObj",
//                         foreignField: "_id",
//                         as: "result",
//                     },
//                 },
//                 { $unwind: "$result" },
//                 { $unwind: "$result.occupancy" },
//                 {
//                     $match: {
//                         "result.occupancy.status": "empty",
//                     },
//                 },
//                 {
//                     $group: {
//                         _id: {
//                             name: "$result.name",
//                             row: "$result.row",
//                             col: "$result.col",
//                         },
//                         level: {
//                             $push: "$result.occupancy.level",
//                         },
//                     },
//                 },

//                 {
//                     $project: {
//                         name: "$_id.name",
//                         row: "$_id.row",
//                         col: "$_id.col",
//                         level: {
//                             $first: "$level"
//                         },
//                         _id: 0,
//                     },
//                 },
//                 {
//                     $sort: {
//                         name: 1,
//                         row: 1,
//                         col: 1,
//                         level: 1,
//                     },
//                 },
//             ])
//             .toArray();

//         return emptySlots;

//     } catch (err) {

//         await genericErrorLog(err, "getEmptyslots");
//         console.log(err);
//         return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

//     }

// };

const noBucketSlots = async (req, res) => {

    try {

        const client = await dbService.getClient();

        let allocatedSlots = await client
            .collection(BUCKETS)
            .find({
                organizationId: req.query.organizationId,
                fsId: req.query.fsId
            })
            .toArray();

        let slotIds = [];
        let slotIdObjArr = [];
        if (allocatedSlots.length) {
            for (let i = 0; i < allocatedSlots.length; i++) {
                for (let j = 0; j < allocatedSlots[i].slotIds.length; j++)
                    slotIds.push(allocatedSlots[i].slotIds[j]);
            }
            slotIdObjArr = slotIds.map((str) => {
                if (str) {
                    return ObjectId(str)
                }
            });
        };

        let nonAllocatedSlots = await client
            .collection(SLOTS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId
                    }
                },
                {
                    $unwind: '$occupancy'
                },
                {
                    $match:
                    {
                        _id: { $nin: slotIdObjArr },
                        "occupancy.status": "empty"
                    }
                },
                {
                    $group: {
                        _id: {
                            name: "$name",
                            row: "$row",
                            col: "$col",
                        },
                        level: {
                            $push: "$occupancy.level",
                        },
                    },
                },

                {
                    $project: {
                        name: "$_id.name",
                        row: "$_id.row",
                        col: "$_id.col",
                        level: {
                            $first: "$level"
                        },
                        _id: 0,
                    },
                },
                {
                    $sort: {
                        name: 1,
                        row: 1,
                        col: 1,
                        level: 1
                    }
                }
            ])
            .toArray();


        let slotsArr = [];
        if (req.query.containerSizeId == 2 || req.query.containerSizeId == 3) {

            for (let i = 0; i < nonAllocatedSlots.length - 1; i++) {

                let obj = nonAllocatedSlots[i];
                let suggestedLocation = [];
                let name = obj.name;
                let row = obj.row;
                let col = obj.col;
                let level = obj.level;

                if (name == nonAllocatedSlots[i + 1].name && row == nonAllocatedSlots[i + 1].row && (col + 1) == nonAllocatedSlots[i + 1].col && level == nonAllocatedSlots[i + 1].level) {

                    if (level == 1) {
                        suggestedLocation.push(nonAllocatedSlots[i]);
                        suggestedLocation.push(nonAllocatedSlots[i + 1]);
                    }

                    else {

                        let slotDetails = await client
                            .collection(SLOTS)
                            .aggregate([
                                {
                                    $match: {
                                        fsId: req.query.fsId,
                                        name: name,
                                        row: row,
                                        $or: [{ col: col }, { col: col + 1 }],
                                        occupancy: { $elemMatch: { level: level - 1 } },
                                    },
                                },
                                {
                                    $project: {
                                        occupancyDetails: {
                                            $arrayElemAt: [
                                                {
                                                    $map: {
                                                        input: "$occupancy",
                                                        as: "element",
                                                        in: {
                                                            $cond: [
                                                                {
                                                                    $eq: [
                                                                        "$$element.level",
                                                                        level - 1,
                                                                    ],
                                                                },
                                                                "$$element",
                                                                null,
                                                            ],
                                                        },
                                                    },
                                                },
                                                0,
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "containers",
                                        localField: "occupancyDetails.containerId",
                                        foreignField: "containerId",
                                        as: "result"
                                    }
                                },
                                {
                                    $project: {
                                        container: { $first: "$result" },

                                    }
                                },
                                {
                                    $project: {
                                        containerSizeId: "$container.containerSizeId"
                                    }
                                }
                            ])
                            .toArray();


                        const isValidContainerSizeId = slotDetails.every(document => {
                            const containerSizeId = document.containerSizeId;
                            return containerSizeId === 2 || containerSizeId === 3;
                        });

                        if (!isValidContainerSizeId) {

                        }

                        else {
                            suggestedLocation.push(nonAllocatedSlots[i]);
                            suggestedLocation.push(nonAllocatedSlots[i + 1]);
                        }

                    }
                }

                if (suggestedLocation.length) {
                    slotsArr.push(suggestedLocation);
                    if (slotsArr.length > 2) {
                        break;
                    }
                }
            }

        }

        else if (req.query.containerSizeId == 1) {

            for (let k = 0; k < nonAllocatedSlots.length; k++) {

                if (nonAllocatedSlots[k].level == 1) {
                    slotsArr.push(nonAllocatedSlots[k]);
                    if (slotsArr.length > 2) {
                        break;
                    }
                }
                else {

                    let containerSizeDetails = await client
                        .collection(SLOTS)
                        .aggregate([
                            {
                                $match: { fsId: req.query.fsId }
                            },
                            { $unwind: "$occupancy" },
                            {
                                $match: {
                                    name: nonAllocatedSlots[k].name,
                                    row: nonAllocatedSlots[k].row,
                                    col: nonAllocatedSlots[k].col,
                                    "occupancy.level": nonAllocatedSlots[k].level - 1,

                                }
                            },
                            {
                                $lookup: {
                                    from: "containers",
                                    localField: "occupancy.containerId",
                                    foreignField: "containerId",
                                    as: "containers"
                                }
                            },
                            {
                                $project: {
                                    containerDetails: { $first: "$containers" }
                                }
                            },
                            {
                                $project: {
                                    containerSizeId: "$containerDetails.containerSizeId"
                                }
                            }
                        ])
                        .toArray();

                    if (containerSizeDetails.length) {
                        if (containerSizeDetails[0].containerSizeId == 1) {
                            slotsArr.push(nonAllocatedSlots[k])
                            if (slotsArr.length > 2) {
                                break;
                            }
                        }
                    }
                }
            }



        }

        return slotsArr;

    } catch (err) {

        await genericErrorLog(err, "noBucketSlot");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};


module.exports = {
    getContainersDetails,
    getUniqueContainerDetails,
    postContainerDetailsManually,
    postGateOutDetailsManually,
    igmDetailsSave,
    renderContainersPdf,
    renderContainerPdf,
    renderContainerExcel,
    renderContainersExcel,
    updateContainerDetails,
    getMasterData,
    locateContainer,
    suggestLocation,
    getContainerLocation,
    getSingleContainerDetailsWithISOCode
}
