const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, saveActivityLog, getUniqueId, findDuplicate } = require('../lib/utils');
const dbService = require('../lib/database');
const { MOBILES, CAMERA, PROCESSING_DEVICES, GPS } = require('../constants/collections');
const Config = require("../constants/configuration");

const checkDuplicateMobile = async (payload) => {
    const duplicate = await findDuplicate(
        MOBILES,
        {	// Fields to check for duplication
            mobileNo: payload.mobileNo,
            serialNo: payload.serialNo,
        },
        {	// Unique field name & value
            name: 'deviceId',
            value: payload.deviceId
        },
        {
            // Fields to check for duplication
            fsId: payload.fsId
        }
    );
    let message = '';
    if (duplicate.isDuplicate) {
        switch (duplicate.fieldName) {
            case 'mobileNo':
                message = Messages.MOBILE_NO_EXISTS;
                break;
            case 'serialNo':
                message = Messages.DUPLICATE_SERIAL_NO;
                break;
            default:
                message = Messages.BAD_REQUEST;
                break;
        }
    }
    duplicate.message = message;
    return duplicate;
}

const checkDuplicate = async (payload, collection) => {
    const duplicate = await findDuplicate(
        collection,
        {	// Fields to check for duplication
            serialNo: payload.serialNo,
        },
        {	// Unique field name & value
            name: 'deviceId',
            value: payload.deviceId
        },
        {
            // Fields to check for duplication
            fsId: payload.fsId
        }
    );
    let message = '';
    if (duplicate.isDuplicate) {
        switch (duplicate.fieldName) {
            case 'serialNo':
                message = Messages.DUPLICATE_SERIAL_NO;
                break;
            default:
                message = Messages.BAD_REQUEST;
                break;
        }
    }
    duplicate.message = message;
    return duplicate;
}

const addMobile = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const payload = req.body;
        console.log(payload);
        if (!payload.deviceId) {
            payload.deviceId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicateMobile(payload);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }
        console.log(payload);
        await client
            .collection(MOBILES)
            .findOneAndUpdate(
                { deviceId: payload.deviceId },
                { $set: payload },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.DEVICE_ADDED);

    } catch (err) {
        await genericErrorLog(err, 'addMobile');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getMobiles = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {};
        if (req.query.hasOwnProperty('organizationId'))
            findBy['organizationId'] = req.query.organizationId;

        if (req.query.hasOwnProperty('fsId'))
            findBy['fsId'] = req.query.fsId;

        if (req.query.hasOwnProperty('isActive'))
            findBy['isActive'] = JSON.parse(req.query.isActive);

        if (req.query.hasOwnProperty("mobileNo")) {
            findBy["mobileNo"] = {
                $regex: `.*${req.query.mobileNo}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("modelName")) {
            findBy["modelName"] = {
                $regex: `.*${req.query.modelName}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("manufacturar")) {
            findBy["manufacturar"] = {
                $regex: `.*${req.query.manufacturar}.*`,
                $options: "i",
            };
        }

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        const pipeline = [
            {
                "$match": findBy
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

        let mobiles = await client
            .collection(MOBILES)
            .aggregate(pipeline)
            .toArray();

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, mobiles);

    } catch (err) {

        await genericErrorLog(err, 'getMobiles');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueMobile = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        console.log('Mobile No: ', req.params.mobileNo);

        const mobile = await client
            .collection(MOBILES)
            .findOne({ mobileNo: req.params.mobileNo });

        if (!mobile)
            return sendResponse(res, 204, true, Messages.NO_DEVICE_FOUND);

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, mobile);

    } catch (err) {
        await genericErrorLog(err, 'getUniqueMobile');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const addProcessingUnit = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const payload = req.body;

        if (!payload.deviceId) {
            payload.deviceId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(payload, PROCESSING_DEVICES);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        await client
            .collection(PROCESSING_DEVICES)
            .findOneAndUpdate(
                { deviceId: payload.deviceId },
                { $set: payload },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.DEVICE_ADDED);

    } catch (err) {
        await genericErrorLog(err, 'addProcessingUnit');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getProcessingUnits = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {};
        if (req.query.hasOwnProperty('organizationId'))
            findBy['organizationId'] = req.query.organizationId;

        if (req.query.hasOwnProperty('fsId'))
            findBy['fsId'] = req.query.fsId;

        if (req.query.hasOwnProperty('isActive'))
            findBy['isActive'] = JSON.parse(req.query.isActive);

        if (req.query.hasOwnProperty("modelName")) {
            findBy["modelName"] = {
                $regex: `.*${req.query.modelName}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("processor")) {
            findBy["processor"] = {
                $regex: `.*${req.query.processor}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("manufacturer")) {
            findBy["manufacturer"] = {
                $regex: `.*${req.query.manufacturer}.*`,
                $options: "i",
            };
        }

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        const pipeline = [
            {
                "$match": findBy
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

        let processingDevices = await client
            .collection(PROCESSING_DEVICES)
            .aggregate(pipeline)
            .toArray();

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, processingDevices);

    } catch (err) {

        await genericErrorLog(err, 'getProcessingUnits');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueProcessingUnit = async (req, res) => {

    try {

        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const processingUnit = await client
            .collection(PROCESSING_DEVICES)
            .findOne({ deviceId: req.params.deviceId });

        if (!processingUnit)
            return sendResponse(res, 204, true, Messages.NO_DEVICE_FOUND);

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, processingUnit);

    } catch (err) {
        await genericErrorLog(err, 'getUniqueProcessingUnit');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getActiveProcessingUnit = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {
            isActive: true,
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        let processingUnits = await client
            .collection(PROCESSING_DEVICES)
            .find(findBy)
            .project({
                deviceId: 1,
                serialNo: 1,
                _id: 0
            })
            .sort({ serialNo: 1 })
            .toArray();

        if (!processingUnits.length) {
            return sendResponse(res, 204, true, Messages.NO_ACTIVE_DEVICES_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.ACTIVE_PROCESSING_UNITS_FETCHED, processingUnits);

    } catch (err) {

        await genericErrorLog(err, "getActiveProcessingUnit");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
};

const getActiveCamera = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {
            isActive: true,
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        let camera = await client
            .collection(CAMERA)
            .find(findBy)
            .project({
                deviceId: 1,
                serialNo: 1,
                _id: 0
            })
            .sort({ serialNo: 1 })
            .toArray();

        if (!camera.length) {
            return sendResponse(res, 204, true, Messages.NO_ACTIVE_DEVICES_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.ACTIVE_CAMERAS_FETCHED, camera);

    } catch (err) {

        await genericErrorLog(err, "getActiveCamera");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
};

const getActiveMobile = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {
            isActive: true,
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        let mobile = await client
            .collection(MOBILES)
            .find(findBy)
            .project({
                deviceId: 1,
                serialNo: 1,
                mobileNo: 1,
                _id: 0
            })
            .sort({ mobileNo: 1 })
            .toArray();

        if (!mobile.length) {
            return sendResponse(res, 204, true, Messages.NO_ACTIVE_DEVICES_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.ACTIVE_MOBILES_FETCHED, mobile);

    } catch (err) {

        await genericErrorLog(err, "getActiveMobile");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
};

const getActiveGPS = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {
            isActive: true,
            organizationId: req.query.organizationId,
            fsId: req.query.fsId
        };

        let gps = await client
            .collection(GPS)
            .find(findBy)
            .project({
                deviceId: 1,
                serialNo: 1,
                _id: 0
            })
            .sort({ serialNo: 1 })
            .toArray();

        if (!gps.length) {
            return sendResponse(res, 204, true, Messages.NO_ACTIVE_DEVICES_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.ACTIVE_GPS_DEVICES_FETCHED, gps);

    } catch (err) {

        await genericErrorLog(err, "getActiveGPS");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }
};

const addCamera = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const payload = req.body;

        if (!payload.deviceId) {
            payload.deviceId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(payload, CAMERA);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        await client
            .collection(CAMERA)
            .findOneAndUpdate(
                { deviceId: payload.deviceId },
                { $set: payload },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.DEVICE_ADDED);

    } catch (err) {
        await genericErrorLog(err, 'addCamera');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getCameras = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {};
        if (req.query.hasOwnProperty('organizationId'))
            findBy['organizationId'] = req.query.organizationId;

        if (req.query.hasOwnProperty('fsId'))
            findBy['fsId'] = req.query.fsId;

        if (req.query.hasOwnProperty('isActive'))
            findBy['isActive'] = JSON.parse(req.query.isActive);

        if (req.query.hasOwnProperty("serialNo")) {
            findBy["serialNo"] = {
                $regex: `.*${req.query.serialNo}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("modelName")) {
            findBy["modelName"] = {
                $regex: `.*${req.query.modelName}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("manufacturer")) {
            findBy["manufacturer"] = {
                $regex: `.*${req.query.manufacturer}.*`,
                $options: "i",
            };
        }

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        const pipeline = [
            {
                "$match": findBy
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

        let cameras = await client
            .collection(CAMERA)
            .aggregate(pipeline)
            .toArray();

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, cameras);

    } catch (err) {

        await genericErrorLog(err, 'getCameras');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueCamera = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const camera = await client
            .collection(CAMERA)
            .findOne({ deviceId: req.params.deviceId });

        if (!camera)
            return sendResponse(res, 204, true, Messages.NO_DEVICE_FOUND);

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, camera);

    } catch (err) {
        await genericErrorLog(err, 'getUniqueCamera');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const addGPS = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const payload = req.body;

        if (!payload.deviceId) {
            payload.deviceId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(payload, GPS);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        await client
            .collection(GPS)
            .findOneAndUpdate(
                { deviceId: payload.deviceId },
                { $set: payload },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.DEVICE_ADDED);

    } catch (err) {
        await genericErrorLog(err, 'addGPS');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getGPSs = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {};
        if (req.query.hasOwnProperty('organizationId'))
            findBy['organizationId'] = req.query.organizationId;

        if (req.query.hasOwnProperty('fsId'))
            findBy['fsId'] = req.query.fsId;

        if (req.query.hasOwnProperty('isActive'))
            findBy['isActive'] = JSON.parse(req.query.isActive);


        if (req.query.hasOwnProperty("serialNo")) {
            findBy["serialNo"] = {
                $regex: `.*${req.query.serialNo}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("modelName")) {
            findBy["modelName"] = {
                $regex: `.*${req.query.modelName}.*`,
                $options: "i",
            };
        }
        if (req.query.hasOwnProperty("manufacturer")) {
            findBy["manufacturer"] = {
                $regex: `.*${req.query.manufacturer}.*`,
                $options: "i",
            };
        }

        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        const pipeline = [
            {
                "$match": findBy
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

        let gpss = await client
            .collection(GPS)
            .aggregate(pipeline)
            .toArray();

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, gpss);

    } catch (err) {

        await genericErrorLog(err, 'getGPSs');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueGPS = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const gps = await client
            .collection(GPS)
            .findOne({ deviceId: req.params.deviceId });

        if (!gps)
            return sendResponse(res, 204, true, Messages.NO_DEVICE_FOUND);

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, gps);

    } catch (err) {
        await genericErrorLog(err, 'getUniqueGPS');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};



module.exports = {
    addMobile,
    getMobiles,
    getUniqueMobile,
    addProcessingUnit,
    getProcessingUnits,
    getUniqueProcessingUnit,
    addCamera,
    getCameras,
    getUniqueCamera,
    addGPS,
    getGPSs,
    getUniqueGPS,
    getActiveProcessingUnit,
    getActiveCamera,
    getActiveGPS,
    getActiveMobile
}
