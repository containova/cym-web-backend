const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, getUniqueId, getEpochTime, saveActivityLog, findDuplicate } = require('../lib/utils');
const dbService = require('../lib/database');
const { MOVEMENT_LOGS, MACHINES, MACHINE_MOVEMENTS, MACHINE_BREAKDOWN_DETAILS } = require('../constants/collections');
const Config = require('../constants/configuration')

const checkDuplicate = async (payload) => {
    const duplicate = await findDuplicate(
        MACHINES,
        {	// Fields to check for duplication
            registrationNo: payload.registrationNo,
            vehicleNo: payload.vehicleNo,
            mobileId: payload.mobileId,
            processingUnitId: payload.processingUnitId,
            cameraId: payload.cameraId,
        },
        {	// Unique field name & value
            name: 'machineId',
            value: payload.machineId
        }
    );
    let message = Messages.BAD_REQUEST;
    if (duplicate.isDuplicate) {
        switch (duplicate.fieldName) {
            case 'registrationNo':
                message = Messages.DUPLICATE_REGISTRATION_NO;
                break;
            case 'vehicleNo':
                message = Messages.DUPLICATE_VEHICLE_NO;
                break;
            case 'mobileId':
                message = Messages.MOBILE_NO_USED;
                break;
            case 'processingUnitId':
                message = Messages.PROCESSING_UNIT_USED;
                break;
            case 'cameraId':
                message = Messages.CAMERA_USED;
                break;
            default:
                message = Messages.BAD_REQUEST;
                break;
        }
    }
    duplicate.message = message;
    return duplicate;
}

const getMachineMovements = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        let obj = {};

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        obj["organizationId"] = req.query.organizationId;
        obj["fsId"] = req.query.fsId;

        if (req.query.name) {
            obj["machineId"] = {
                $regex: `.*${req.query.name}.*`,
                $options: "i",
            };
        };

        if (req.query.containerSizeId)
            obj["movementDetails.containerSizeId"] = parseInt(req.query.containerSizeId);


        if (req.query.zoneId)
            obj["results.zoneId"] = parseInt(req.query.zoneId);


        if (req.query.fromDate) {
            obj["movementDetails.actualActivityTime"] = {
                "$gte": parseInt(req.query.fromDate)
            };
        };

        if (req.query.toDate) {
            obj["movementDetails.actualActivityTime"] = {
                "$lte": parseInt(req.query.toDate)
            };
        };

        if (req.query.toDate && req.query.fromDate) {
            obj["movementDetails.actualActivityTime"] = {
                "$gte": parseInt(req.query.fromDate),
                "$lte": parseInt(req.query.toDate)
            };
        };

        const client = await dbService.getClient();
        let pipeline = [
            {
                $match: obj
            },
            {
                $lookup: {
                    from: "machines",
                    localField: "machineId",
                    foreignField: "machineId",
                    as: "machineDetails",
                },
            },
            { "$skip": skip },
            { "$limit": size },
            {
                $project: {
                    machineId: 1,
                    machineName: {
                        $first: "$machineDetails.machineName",
                    },
                    movementDetails: 1,
                    fsId: 1,
                    organizationId: 1,
                },
            },
        ]
        let machineMovements = await client
            .collection(MACHINE_MOVEMENTS)
            .aggregate(pipeline)
            .toArray();
        if (machineMovements.length == 0) {
            return sendResponse(res, 204, true, Messages.NO_MACHINE_MOVEMENTS, []);
        }


        return sendResponse(res, 200, true, Messages.MACHINE_MOVEMENTS_FETCHED, machineMovements);

    } catch (err) {

        await genericErrorLog(err, 'getMachineMovements');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getMachineDetails = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.organizationId || !req.query.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;
        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        if (req.query.machineName) {
            matchBy["machineName"] = {
                $regex: `.*${req.query.machineName}.*`,
                $options: "i",
            };
        };

        if (req.query.machineId) {
            matchBy["machineId"] = req.query.machineId;
        };

        if (req.query.vehicleNo) {
            matchBy["vehicleNo"] = {
                $regex: `.*${req.query.vehicleNo}.*`,
                $options: "i",
            };
        };

        if (req.query.registrationNo) {
            matchBy["registrationNo"] = {
                $regex: `.*${req.query.registrationNo}.*`,
                $options: "i",
            };
        };

        const client = await dbService.getClient();

        const machines = await client
            .collection(MACHINES)
            .aggregate([
                {
                    $match: matchBy
                },
                {
                    $lookup: {
                        from: "mobileDevices",
                        localField: "mobileId",
                        foreignField: "deviceId",
                        as: "mobile",
                    },
                },
                {
                    $lookup: {
                        from: "gpsDevices",
                        localField: "gpsId",
                        foreignField: "deviceId",
                        as: "gps",
                    },
                },
                {
                    $lookup: {
                        from: "processingDevices",
                        localField: "processingUnitId",
                        foreignField: "deviceId",
                        as: "processingUnit",
                    },
                },
                {
                    $lookup: {
                        from: "cameraDevices",
                        localField: "cameraId",
                        foreignField: "deviceId",
                        as: "camera",
                    },
                },
                {
                    $lookup: {
                        from: "freightStations",
                        localField: "fsId",
                        foreignField: "fsId",
                        as: "freightStation",
                    },
                },
                {
                    $lookup: {
                        from: "organizations",
                        localField: "organizationId",
                        foreignField: "organizationId",
                        as: "organization",
                    },
                },
                {
                    $project: {
                        organizationId: 1,
                        fsId: 1,
                        machineId: 1,
                        machineName: 1,
                        registrationNo: 1,
                        vehicleNo: 1,
                        mobileId: 1,
                        processingUnitId: 1,
                        cameraId: 1,
                        gpsId: 1,
                        oem: 1,
                        status: 1,
                        organizationName: {
                            $first: "$organization.organizationName",
                        },
                        fsName: {
                            $first: "$freightStation.fsName",
                        },
                        phoneNo: { $first: "$mobile.mobileNo" },
                        gpsSerialNo: { $first: "$gps.serialNo" },
                        processingUnitSerialNo: {
                            $first: "$processingUnit.serialNo",
                        },
                        cameraSerialNo: {
                            $first: "$camera.serialNo",
                        },
                    },
                },
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
            ])
            .toArray();

        if (machines.length < 1)
            return sendResponse(res, 204, true, Messages.NO_MACHINES_FOUND, []);

        return sendResponse(res, 200, true, Messages.MACHINES_FETCHED_SUCCESSFULLY, machines);

    } catch (err) {

        await genericErrorLog(err, 'getMachineDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueMachineDetails = async (req, res) => {

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

        const machine = await client
            .collection(MACHINES)
            .findOne(matchBy);

        if (!machine)
            return sendResponse(res, 204, true, Messages.NO_MACHINE_FOUND, {});

        return sendResponse(res, 200, true, Messages.MACHINES_FETCHED_SUCCESSFULLY, machine);

    } catch (err) {

        await genericErrorLog(err, 'getUniqueMachineDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const addMachineDetails = async (req, res) => {
    //TODO: to check whether latitude and longitude will come from frontend or not.
    try {

        await saveActivityLog(req, res);

        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        if (!req.body.machineId) {
            req.body.machineId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(req.body);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        let machine = {
            organizationId: req.body.organizationId,
            fsId: req.body.fsId,
            machineId: req.body.machineId,
            machineName: req.body.machineName,
            registrationNo: req.body.registrationNo,
            vehicleNo: req.body.vehicleNo,
            mobileId: req.body.mobileId,
            processingUnitId: req.body.processingUnitId,
            cameraId: req.body.cameraId,
            gpsId: req.body.gpsId,
            oem: req.body.oem,
            status: req.body.status,
            // vendorContactNumber: parseInt(req.body.vendorContactNumber),
            // userId: req.body.userId,
            // isActive: req.body.isActive
        };

        const client = await dbService.getClient();

        await client.collection(MACHINES).findOneAndUpdate(
            {
                machineId: machine.machineId
            },
            { $set: machine },
            { upsert: true }
        );

        if (req.body.status == "inactive") {

            let obj = {
                machineId: req.body.machineId,
                startDate: getEpochTime(),
                fsId: req.body.fsId,
                organizationId: req.body.organizationId
            };

            await client.collection(MACHINE_BREAKDOWN_DETAILS).insertOne(obj);
        }

        if (req.body.status == "active") {

            await client.collection(MACHINE_BREAKDOWN_DETAILS).findOneAndUpdate(
                {
                    machineId: req.body.machineId,
                    startDate: { $exists: true },
                    endDate: { $exists: false },
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId
                },
                { $set: { endDate: getEpochTime() } },
                { upsert: false }
            );
        }

        return sendResponse(res, 201, true, Messages.MACHINE_ADDED);

    } catch (err) {

        await genericErrorLog(err, 'addMachineDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};


const updateMachineDetails = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId || !req.query.machineId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            machineId: req.query.machineId
        };

        let updateObj = {}

        if (req.query.lat)
            updateObj["lat"] = parseFloat(req.query.lat);

        if (req.query.long)
            updateObj["long"] = parseFloat(req.query.lat);

        if (req.query.phoneNo)
            updateObj["phoneNo"] = req.query.phoneNo;

        if (req.query.user)
            updateObj["user"] = req.query.user;

        if (req.query.vendorName)
            updateObj["vendorName"] = req.query.vendorName;

        if (req.query.status)
            updateObj["status"] = req.query.status;

        if (req.query.machineName)
            updateObj["machineName"] = req.query.machineName;

        const client = await dbService.getClient();

        let machineUpdate = await client
            .collection(MACHINES)
            .updateOne(
                matchBy,
                {
                    $set: updateObj
                },
                { upsert: false }
            );

        if (machineUpdate.modifiedCount == 1)
            return sendResponse(res, 200, true, Messages.MACHINE_UPDATED_SUCCESSFULLY);

    } catch (err) {

        await genericErrorLog(err, 'updateMachineDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const deleteMachine = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        if (!req.query.organizationId || !req.query.fsId || !req.query.machineId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let deleteBy = {
            organizationId: req.query.organizationId,
            fsId: req.query.fsId,
            machineId: req.query.machineId
        };

        const client = await dbService.getClient();

        await client
            .collection(MACHINES)
            .deleteOne(deleteBy);

        return sendResponse(res, 201, true, Messages.MACHINE_DELETED);

    } catch (err) {

        await genericErrorLog(err, 'deleteMachine');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
}

const postMachineStatus = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.body.machineId || !req.body.status || !req.body.organizationId || !req.body.fsId) {
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }

        let machineId = req.body.machineId;
        let status = req.body.status;
        let updatedTime = getEpochTime()
        const client = await dbService.getClient();
        await client.collection(MACHINES).findOneAndUpdate(
            { machineId: machineId },
            { $set: { status: status, updatedTime: updatedTime } },
            { upsert: false }
        )

        if (req.body.status == "inactive") {

            let obj = {
                machineId: req.body.machineId,
                startDate: getEpochTime(),
                fsId: req.body.fsId,
                organizationId: req.body.organizationId
            };

            await client.collection(MACHINE_BREAKDOWN_DETAILS).insertOne(obj);

        }

        if (req.body.status == "active") {

            await client.collection(MACHINE_BREAKDOWN_DETAILS).findOneAndUpdate(
                {
                    machineId: req.body.machineId,
                    endDate: { $exists: false },
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId
                },
                { $set: { endDate: getEpochTime() } },
                { upsert: false }
            );
        }

        return sendResponse(res, 200, true, Messages.MACHINE_UPDATED_SUCCESSFULLY);

    } catch (err) {

        await genericErrorLog(err, 'postMachineStatus');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
}

const getMachineStatus = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        if (!req.query.machineId || !req.query.organizationId || !req.query.fsId) {
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }
        let machineId = req.query.machineId;
        const client = await dbService.getClient();
        let data = await client.collection(MACHINES).find(
            { machineId: machineId }
        ).toArray();
        return sendResponse(res, 200, true, Messages.MACHINE_FETCHED_SUCCESSFULLY, data);
    } catch (err) {
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const getMachineList = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        delete req.query["activityUserId"]

        if (!req.query.organizationId || !req.query.fsId) {
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }

        let obj = {}
        if (req.query) {
            obj = req.query;
        }
        const client = await dbService.getClient();
        let data = await client.collection(MACHINES).find(obj).toArray();
        return sendResponse(res, 200, true, Messages.MACHINE_FETCHED_SUCCESSFULLY, data);
    } catch (err) {
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const getMachineBreakdownDetails = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.organizationId || !req.query.fsId) {
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED);
        }

        let obj = {
            fsId: req.query.fsId,
            organizationId: req.query.organizationId
        };
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        if (req.query.machineId) {
            obj["machineId"] = req.query.machineId;
        };

        if (req.query.toDate && !req.query.fromDate) {
            obj["endDate"] = {
                "$lte": parseInt(req.query.toDate)
            };
        };

        if (req.query.fromDate && !req.query.toDate) {
            obj["startDate"] = {
                "$gte": parseInt(req.query.fromDate)
            };
        };

        if (req.query.toDate && req.query.fromDate) {
            obj["$and"] = [
                {
                    "endDate": {
                        "$lte": parseInt(req.query.toDate)
                    }
                },
                {
                    "startDate": {
                        "$gte": parseInt(req.query.fromDate)
                    }
                },
            ];
        };

        const client = await dbService.getClient();
        let pipeline = [
            {
                $match: obj
            },
            {
                $lookup: {
                    from: "machines",
                    localField: "machineId",
                    foreignField: "machineId",
                    as: "machineDetails",
                }
            },
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: size },
            {
                $project: {
                    machineName: { $first: "$machineDetails.machineName" },
                    registrationNo: { $first: "$machineDetails.registrationNo" },
                    vehicleNo: { $first: "$machineDetails.vehicleNo" },
                    startDate: 1,
                    endDate: 1
                }
            }
        ]

        console.log(JSON.stringify(pipeline));
        let machineBreakdownList = await client
            .collection(MACHINE_BREAKDOWN_DETAILS)
            .aggregate(pipeline)
            .toArray();

        if (!machineBreakdownList.length) {
            return sendResponse(res, 204, true, Messages.NO_MACHINE_BREAKDOWN_DETAILS, []);
        }

        return sendResponse(res, 200, true, Messages.MACHINE_BREAKDOWN_DETAILS_FETCHED, machineBreakdownList);

    } catch (err) {

        await genericErrorLog(err, 'getMachineBreakdownDetails');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
}
module.exports = {
    getMachineMovements,
    getMachineDetails,
    getUniqueMachineDetails,
    addMachineDetails,
    updateMachineDetails,
    deleteMachine,
    postMachineStatus,
    getMachineStatus,
    getMachineList,
    getMachineBreakdownDetails
}
