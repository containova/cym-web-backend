const Messages = require('../constants/messages');
const { sendResponse, generateUserName, getEpochTime, genericErrorLog, getUniqueId, saveActivityLog, findDuplicate } = require('../lib/utils');
const dbService = require('../lib/database');
const { MACHINES, FREIGHT_STATIONS, SLOTS, MOVEMENT_LOG, CONTAINERS, MOVEMENT_LOGS, MACHINE_MOVEMENTS, JOB_CARDS } = require('../constants/collections');
const { blobURLGeneration, deleteBlobImage } = require('../services/blobURL');
const Config = require("../constants/configuration");
const { EMPTY, OCCUPIED, PRODUCTIVE, GATE_OUT, OPEN, DONE } = require('../constants/status');
const { LAYOUT_FILES } = require('../constants/blobContainers');
const socketIOClient = require("socket.io-client");

const FormData = require('form-data');

const layoutGenerationEndpoint = process.env.LAYOUT_GENERATION_ENDPOINT;

const axios = require('axios');

let message = [];


const checkDuplicate = async (payload) => {
    const duplicate = await findDuplicate(
        FREIGHT_STATIONS,
        {	// Fields to check for duplication
            email: payload.email,
        },
        {	// Unique field name & value
            name: 'fsId',
            value: payload.fsId
        }
    );
    let message = '';
    if (duplicate.isDuplicate) {
        switch (duplicate.fieldName) {
            case 'email':
                message = Messages.EMAIL_EXISTS;
                break;
            default:
                message = Messages.BAD_REQUEST;
                break;
        }
    }
    duplicate.message = message;
    return duplicate;
}

const getMachineDetails = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const machines = await client
            .collection(MACHINES)
            .find({ fsId: req.params.fsId })
            .toArray();

        if (machines.length < 1)
            return sendResponse(res, 404, false, Messages.NO_MACHINES_FOUND);

        return sendResponse(res, 200, true, Messages.MACHINES_FETCHED_SUCCESSFULLY, machines);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

}

const getUniqueMachineDetails = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        const machine = await client
            .collection(MACHINES)
            .find({ fsId: req.params.fsId, machineId: req.params.machineId })
            .toArray();

        if (machine.length < 1)
            return sendResponse(res, 404, false, Messages.NO_MACHINE_FOUND);

        return sendResponse(res, 200, true, Messages.MACHINES_FETCHED_SUCCESSFULLY, machine);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const addMachineDetails = async (req, res) => {
    //TODO: to check whether latitude and longitude will come from frontend or not.
    try {
        await saveActivityLog(req, res);
        let machine = {
            clientId: req.body.clientId,
            fsId: req.params.fsId,
            machineId: generateUserName(),
            name: req.body.name,
            type: req.body.type,
            zone: req.body.zone,
            lat: req.body.lat,
            lon: req.body.lon,
            status: req.body.status
        };

        const client = await dbService.getClient();

        await client.collection(MACHINES).insertOne(machine);

        return sendResponse(res, 201, true, Messages.MACHINE_ADDED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const updateMachineDetails = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let machineUpdate = await client
            .collection(MACHINES)
            .updateOne(
                {
                    machineId: req.params.machineId,
                    fsId: req.params.fsId
                },
                {
                    $set:
                    {
                        clientId: req.body.clientId,
                        name: req.body.name,
                        type: req.body.type,
                        zone: req.body.zone,
                        lat: req.body.lat,
                        lon: req.body.lon,
                        status: req.body.status
                    }
                },

                { upsert: false }
            );

        if (machineUpdate.modifiedCount == 1)
            return sendResponse(res, 200, true, Messages.MACHINE_UPDATED_SUCCESSFULLY);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const deleteMachine = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        await client.collection(MACHINES).deleteOne({ fsId: req.params.fsId, machineId: req.params.machineId });

        return sendResponse(res, 201, true, Messages.MACHINE_DELETED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
}

const getFreightStations = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let findBy = {};
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        if (req.query.hasOwnProperty('organizationId'))
            findBy.organizationId = req.query.organizationId;

        if (req.query.hasOwnProperty('fsId'))
            findBy.fsId = req.query.fsId;

        if (req.query.hasOwnProperty('fsName'))
            findBy["fsName"] = {
                $regex: `.*${req.query.fsName}.*`,
                $options: "i",
            };

        if (req.query.hasOwnProperty('organizationName'))
            findBy["organizationName"] = {
                $regex: `.*${req.query.organizationName}.*`,
                $options: "i",
            };

        if (req.query.hasOwnProperty('address'))
            findBy["address"] = {
                $regex: `.*${req.query.address}.*`,
                $options: "i",
            };

        if (req.query.hasOwnProperty('contactNumber'))
            findBy["contactNumber"] = {
                $regex: `.*${req.query.contactNumber}.*`,
                $options: "i",
            };

        if (req.query.hasOwnProperty('isActive'))
            findBy["isActive"] = JSON.parse(req.query.isActive);

        const pipeline = [
            {
                "$match": findBy
            },
            {
                $lookup: {
                    from: "organizations",
                    localField: "organizationId",
                    foreignField: "organizationId",
                    as: "result"
                }
            },
            { $sort: { _id: -1 } },
            {
                $project: {
                    "organizationName": { $first: "$result.organizationName" },
                    "organizationId": 1,
                    "organizationLogo": 1,
                    "fsId": 1,
                    "address": 1,
                    "contactNumber": 1,
                    "email": 1,
                    "fsLayoutMap": 1,
                    "fsName": 1,
                    "isActive": 1,
                    "layoutUrl": 1

                }
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
        ]

        console.log(JSON.stringify(pipeline));
        const freightstations = await client
            .collection(FREIGHT_STATIONS)
            .aggregate(pipeline)
            .toArray();

        if (freightstations.length < 1)
            return sendResponse(res, 204, true, Messages.NO_FREIGHT_STATION_FOUND, []);

        return sendResponse(res, 200, true, Messages.FREIGHT_STATIONS_FETCHED_SUCCESSFULLY, freightstations);

    } catch (err) {

        await genericErrorLog(err, 'getFreightStations');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getActiveFreightStations = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();
        let findBy = {
            'isActive': true
        };

        if (req.query.hasOwnProperty('organizationId'))
            findBy.organizationId = req.query.organizationId;

        let freightstations = await client
            .collection(FREIGHT_STATIONS)
            .find(findBy, {
                "fsId": 1,
                "fsName": 1,
                "organizationId": 1,
                "organizationName": 1
            }
            )
            .toArray();

        if (!freightstations.length) {
            return sendResponse(res, 204, true, Messages.NO_FREIGHT_STATION_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.FREIGHT_STATIONS_FETCHED_SUCCESSFULLY, freightstations);

    } catch (error) {

        await genericErrorLog(error, 'getActiveFreightStations');
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getUniqueFreightStation = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let freightstation = await client
            .collection(FREIGHT_STATIONS)
            .find({ fsId: req.params.fsId })
            .toArray();

        if (freightstation.length < 1)
            return sendResponse(res, 204, true, Messages.NO_FREIGHT_STATION_FOUND, []);

        return sendResponse(res, 200, true, Messages.FREIGHT_STATION_FETCHED_SUCCESSFULLY, freightstation);

    } catch (err) {

        await genericErrorLog(err, 'getUniqueFreightStation');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const addFrieghtStation = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        let obj = req.body;

        if (!obj.fsId) {
            obj.fsId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(obj);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        const client = await dbService.getClient();
        obj["isActive"] = JSON.parse(obj["isActive"])
        await client
            .collection(FREIGHT_STATIONS)
            .findOneAndUpdate(
                { fsId: obj.fsId },
                { $set: obj },
                { upsert: true }
            );


        if (req.file) {

            const uploadedFile = blobURLGeneration(req.file, LAYOUT_FILES);
            // console.log('uploadedFile: ', uploadedFile);

            const formData = new FormData();
            formData.append('organizationId', obj.organizationId);
            formData.append('fsId', obj.fsId);
            formData.append('fileUrl', uploadedFile.imageUrl);

            const headers = {
                'Content-Type': 'multipart/form-data',
                'subscription-key': process.env.PRIMARY_SUBCRIPTION_KEY
            };

            const response = axios.post(layoutGenerationEndpoint, formData, { headers });
        }

        return sendResponse(res, 201, true, Messages.FREIGHT_STATION_ADDED);

    } catch (err) {

        await genericErrorLog(err, 'addFrieghtStation');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getSlots = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let slots = await client
            .collection(SLOTS)
            .find({ fsId: req.params.fsId })
            .toArray();

        if (slots.length < 1)
            return sendResponse(res, 404, false, Messages.NO_SLOTS_FOUND);

        return sendResponse(res, 200, true, Messages.SLOTS_FETCHED_SUCCESSFULLY, slots);

    } catch (err) {

        await genericErrorLog(err, "getSlots");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

};

// const getUniqueSlot = async (req, res) => {
//     try {
//         const client = await dbService.getClient();

//         let slot = await client
//             .collection(SLOTS)
//             .find({ fsId: req.params.fsId, slotId: req.params.slotId })
//             .toArray()
//         if (slot.length<1)
//             return sendResponse(res, 404, false, Messages.NO_SLOTS_FOUND)
//         return sendResponse(res, 200, true, Messages.SLOT_FETCHED_SUCCESSFULLY, slot)
//     } catch (err) {
//         console.log(err);
//         return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
//     }
// }

// const updateSlots = async (req, res) => {
//     try {
//         let messages = []
//         const client = await dbService.getClient();

//         let container = await client
//             .collection(CONTAINERS)
//             .findOne({ containerId: req.body.currentActiveContainerId })

//         console.log(container)
//         let latestImage = container.latestPositionImage;
//         let containerSizeId = container.containerSizeId;
//         let count = 0;
//         let flag = 0;

//         for (let i = 0; i < req.body.currentActiveContainerPosition.length; i++) {
//             let removeContainer = await client
//                 .collection(SLOTS)
//                 .updateOne(
//                     {
//                         fsId: req.params.fsId,
//                         "occupancy": { "$elemMatch": { "containerId": req.body.currentActiveContainerId } }
//                     },

//                     {
//                         '$set':

//                         {
//                             'occupancy.$.containerId': '',
//                             'occupancy.$.status': EMPTY,
//                             'occupancy.$.lastUpdated': getEpochTime()
//                         }
//                     },
//                     { upsert: false }
//                 )
//             if (removeContainer.modifiedCount == 1)
//                 count++;
//         }

//         for (let i = 0; i < req.body.currentActiveContainerPosition.length; i++) {
//             let addContainer = await client
//                 .collection(SLOTS)
//                 .updateOne(
//                     {
//                         fsId: req.params.fsId,
//                         name: req.body.currentActiveContainerPosition[i].name,
//                         row: req.body.currentActiveContainerPosition[i].row,
//                         col: req.body.currentActiveContainerPosition[i].col,
//                         "occupancy": { "$elemMatch": { "level": req.body.currentActiveContainerPosition[i].level } }
//                     },

//                     {
//                         '$set':

//                         {
//                             'occupancy.$.containerId': req.body.currentActiveContainerId,
//                             'occupancy.$.status': OCCUPIED,
//                             'occupancy.$.lastUpdated': getEpochTime()
//                         }
//                     },
//                     { upsert: false }
//                 )
//             if (addContainer.modifiedCount == 1)
//                 flag++;
//         }

//         if (count == req.body.currentActiveContainerPosition.length && flag == req.body.currentActiveContainerPosition.length)
//             messages.push('slots updated')
//         // console.log(req.body.currentActiveContainerId)
//         //TODO
//         //with wasted moves
//         // let activityType = ""
//         // if (req.body.jobCardContainerId == req.body.currentActiveContainerId)
//         //     activityType = "productive"
//         // else
//         //     activityType = "wasted"

//         // let logs = await client
//         //     .collection(MOVEMENT_LOG)
//         //     .updateOne(
//         //         {
//         //             containerId: req.body.currentActiveContainerId,
//         //             containerSize: req.body.currentActiveContainerSize
//         //         },
//         //         {
//         //             $set: {
//         //                 currentZone: req.body.currentActivePosition.zone
//         //             },
//         //             $push: {
//         //                 "subjectDetails": {
//         //                     machineId: req.body.machineId,
//         //                     zone: req.body.currentActiveContainerPosition.zone,
//         //                     row: req.body.currentActiveContainerPosition.row,
//         //                     slot: req.body.currentActiveContainerPosition.slot,
//         //                     level: req.body.currentActiveContainerPosition.level,
//         //                     activityTime: getEpochTime(filter = true),
//         //                     actualActivityTime: getEpochTime(),
//         //                     typeOfActivity: activityType,
//         //                     jobCardId: req.body.jobCardId
//         //                 }
//         //             },
//         //         },
//         //         {
//         //             upsert: true
//         //         }
//         //     )
//         //     if(logs.modifiedCount==1)
//         //         messages.push("movement captured");

//         //without wasted moves
//         let logs = await client
//             .collection(MOVEMENT_LOGS)
//             .updateOne(
//                 {
//                     containerId: req.body.currentActiveContainerId,
//                     containerSizeId: containerSizeId
//                 },
//                 {
//                     $set: {
//                         currentZoneName: req.body.currentActiveContainerPosition.name
//                     },
//                     $push: {
//                         "movementDetails": {
//                             machineId: req.body.machineId,
//                             movedTo:req.body.currentActiveContainerPosition,
//                             activityTime: getEpochTime(filter = true),
//                             actualActivityTime: getEpochTime(),
//                             typeOfActivity: PRODUCTIVE,
//                         }
//                     },
//                 },
//                 {
//                     upsert: true
//                 }
//             )
//         console.log(logs)
//         if (logs.modifiedCount == 1 || logs.upsertedCount == 1)
//             messages.push("movement captured");

//         let containerUpdate = await client
//             .collection(CONTAINERS)
//             .updateOne(
//                 {
//                     containerId: req.body.currentActiveContainerId
//                 },
//                 {
//                     $set: {
//                         latestPositionImage: req.body.latestPositionImage[0]
//                     }
//                 }
//             )
//         if (containerUpdate.modifiedCount == 1)
//             messages.push("latest container position images updated");

//         deleteBlobImage(latestImage);

//         console.log(messages)

//         if (messages.length < 3)
//             return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR, messages);

//         return sendResponse(res, 200, true, Messages.ALL_SLOTS_UPDATED, messages);

//     } catch (err) {
//         console.log(err);
//         return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
//     }
// }
const updateSlots = async (req, res) => {

    try {

        // await saveActivityLog(req, res);

        if (!req.body.organizationId || !req.body.fsId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        if (req.body.movementTypeId == 1)
            await gateInSlotUpdate(req, res);

        else if (req.body.movementTypeId == 2)
            await gateOutSlotUpdate(req, res);

        else if (req.body.movementTypeId == 3)
            await interimSlotUpdate(req, res);

        else
            return sendResponse(res, 400, false, Messages.INVALID_MOVEMENT_TYPE);

        await captureMovementLog(req, res);
        await machineMovements(req, res);

        const messages = [...message];

        message = [];

        return sendResponse(res, 200, true, Messages.ALL_SLOTS_UPDATED, messages);

    } catch (err) {

        await genericErrorLog(err, "updateSlots");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const gateInSlotUpdate = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let flag = 0;

        for (let i = 0; i < req.body.currentActiveContainerPosition.length; i++) {
            let addContainer = await client
                .collection(SLOTS)
                .updateOne(
                    {
                        fsId: req.body.fsId,
                        organizationId: req.body.organizationId,
                        name: req.body.currentActiveContainerPosition[i].name,
                        row: req.body.currentActiveContainerPosition[i].row,
                        col: req.body.currentActiveContainerPosition[i].col,
                        "occupancy": { "$elemMatch": { "level": req.body.currentActiveContainerPosition[i].level } }
                    },

                    {
                        '$set':

                        {
                            'occupancy.$.containerId': req.body.currentActiveContainerId,
                            'occupancy.$.status': OCCUPIED,
                            'occupancy.$.lastUpdated': getEpochTime()
                        }
                    },
                    { upsert: false }
                );

            if (addContainer.modifiedCount == 1)
                flag++;
        }

        if (flag == req.body.currentActiveContainerPosition.length)
            message.push("slots updated");

        let container = await client
            .collection(CONTAINERS)
            .updateOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                },
                {
                    "$set": {
                        latestPositionImage: req.body.latestPositionImage
                    }
                },
                { upsert: false }
            );

        if (container.modifiedCount == 1)
            message.push("latest position image saved");

        let jobcard = await client
            .collection(JOB_CARDS)
            .findOneAndUpdate(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId,
                    status: OPEN
                },
                {
                    "$set": {
                        status: DONE
                    }
                },
                { upsert: false }
            );

        console.log(jobcard);
        if (jobcard.lastErrorObject.updatedExisting)
            message.push("jobcard status set to done");
        let jobCardDetails = jobcard.value

        // socket 
        console.log("Socket ");
        const socketObject = socketIOClient(`${process.env.SOCKET_URL}?machineId=${jobCardDetails.machineId}`);
        await new Promise((resolve, reject) => {
            try {
                let obj = { jobCardId: jobCardDetails.jobCardId, fsId: jobCardDetails.fsId, organizationId: jobCardDetails.organizationId }
                socketObject.emit("taskClose", obj)
                resolve({
                    message: 'Emit Success',
                    data: obj
                })
                console.log("emitted data ", obj);
            } catch (err) {
                reject(err)
            }
        })

    } catch (err) {

        await genericErrorLog(err, "gateInSlotUpdate");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const gateOutSlotUpdate = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let count = 0;

        let containerDetails = await client
            .collection(CONTAINERS)
            .findOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                }
            );

        let sizeId = containerDetails.containerSizeId;
        let length = 1;

        if (sizeId == 2 || sizeId == 3)
            length = 2;

        for (let i = 0; i < length; i++) {
            let removeContainer = await client
                .collection(SLOTS)
                .updateOne(
                    {
                        fsId: req.body.fsId,
                        organizationId: req.body.organizationId,
                        "occupancy": { "$elemMatch": { "containerId": req.body.currentActiveContainerId } }
                    },

                    {
                        '$set':

                        {
                            'occupancy.$.containerId': '',
                            'occupancy.$.status': EMPTY,
                            'occupancy.$.lastUpdated': getEpochTime()
                        }
                    },
                    { upsert: false }
                );

            if (removeContainer.modifiedCount == 1)
                count++;
        }

        if (count == length)
            message.push("slots updated");

        let container = await client
            .collection(CONTAINERS)
            .updateOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                },
                {
                    "$set": {
                        latestPositionImage: req.body.latestPositionImage
                    }
                },
                { upsert: false }
            );

        if (container.modifiedCount == 1)
            message.push("latest position image saved");

        let jobcard = await client
            .collection(JOB_CARDS)
            .findOneAndUpdate(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId,
                    status: OPEN
                },
                {
                    "$set": {
                        status: DONE
                    }
                },
                { upsert: false }
            );

        console.log(jobcard);
        if (jobcard.lastErrorObject.updatedExisting)
            message.push("jobcard status set to done");
        let jobCardDetails = jobcard.value

        // socket 
        console.log("Socket ");
        const socketObject = socketIOClient(`${process.env.SOCKET_URL}?machineId=${jobCardDetails.machineId}`);
        await new Promise((resolve, reject) => {
            try {
                let obj = { jobCardId: jobCardDetails.jobCardId, fsId: jobCardDetails.fsId, organizationId: jobCardDetails.organizationId }
                socketObject.emit("taskClose", obj)
                resolve({
                    message: 'Emit Success',
                    data: obj
                })
                console.log("emitted data ", obj);
            } catch (err) {
                reject(err)
            }
        })



    } catch (err) {

        await genericErrorLog(err, 'gateOutSlotUpdate');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const interimSlotUpdate = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        let count = 0;
        let flag = 0;

        const client = await dbService.getClient();

        for (let i = 0; i < req.body.currentActiveContainerPosition.length; i++) {
            let removeContainer = await client
                .collection(SLOTS)
                .updateOne(
                    {
                        fsId: req.body.fsId,
                        organizationId: req.body.organizationId,
                        "occupancy": { "$elemMatch": { "containerId": req.body.currentActiveContainerId } }
                    },

                    {
                        '$set':

                        {
                            'occupancy.$.containerId': '',
                            'occupancy.$.status': EMPTY,
                            'occupancy.$.lastUpdated': getEpochTime()
                        }
                    },
                    { upsert: false }
                );

            if (removeContainer.modifiedCount == 1)
                count++;
        }

        for (let i = 0; i < req.body.currentActiveContainerPosition.length; i++) {
            let addContainer = await client
                .collection(SLOTS)
                .updateOne(
                    {
                        fsId: req.body.fsId,
                        organizationId: req.body.organizationId,
                        name: req.body.currentActiveContainerPosition[i].name,
                        row: req.body.currentActiveContainerPosition[i].row,
                        col: req.body.currentActiveContainerPosition[i].col,
                        "occupancy": { "$elemMatch": { "level": req.body.currentActiveContainerPosition[i].level } }
                    },

                    {
                        '$set':

                        {
                            'occupancy.$.containerId': req.body.currentActiveContainerId,
                            'occupancy.$.status': OCCUPIED,
                            'occupancy.$.lastUpdated': getEpochTime()
                        }
                    },
                    { upsert: false }
                );

            if (addContainer.modifiedCount == 1)
                flag++;
        }

        if (count == req.body.currentActiveContainerPosition.length && flag == req.body.currentActiveContainerPosition.length)
            message.push('slots updated');

        let container = await client
            .collection(CONTAINERS)
            .updateOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                },
                {
                    "$set": {
                        latestPositionImage: req.body.latestPositionImage
                    }
                },
                { upsert: false }
            );

        if (container.modifiedCount == 1)
            message.push("latest position image saved");

        let jobcard = await client
            .collection(JOB_CARDS)
            .findOneAndUpdate(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId,
                    status: OPEN
                },
                {
                    "$set": {
                        status: DONE
                    }
                },
                { upsert: false }
            );

        console.log(jobcard);
        if (jobcard.lastErrorObject.updatedExisting)
            message.push("jobcard status set to done");
        let jobCardDetails = jobcard.value

        // socket 
        console.log("Socket ");
        const socketObject = socketIOClient(`${process.env.SOCKET_URL}?machineId=${jobCardDetails.machineId}`);
        await new Promise((resolve, reject) => {
            try {
                let obj = { jobCardId: jobCardDetails.jobCardId, fsId: jobCardDetails.fsId, organizationId: jobCardDetails.organizationId }
                socketObject.emit("taskClose", obj)
                resolve({
                    message: 'Emit Success',
                    data: obj
                })
                console.log("emitted data ", obj);
            } catch (err) {
                reject(err)
            }
        })

    } catch (err) {

        await genericErrorLog(err, "interimSlotUpdate");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const captureMovementLog = async (req, res) => {

    try {

        // await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let container = await client
            .collection(CONTAINERS)
            .findOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                }
            );

        let containerSizeId = container.containerSizeId;
        let currentZoneName = " ";

        if (!req.body.currentActiveContainerPosition.length)
            currentZoneName = GATE_OUT;
        else
            currentZoneName = req.body.currentActiveContainerPosition[0].name;

        let logs = await client
            .collection(MOVEMENT_LOGS)
            .updateOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId,
                    containerSizeId: containerSizeId
                },
                {
                    "$set": {
                        currentZoneName: currentZoneName
                    },
                    "$push": {
                        "movementDetails": {
                            machineId: req.body.machineId,
                            movedTo: req.body.currentActiveContainerPosition,
                            activityTime: getEpochTime(filter = true),
                            actualActivityTime: getEpochTime(),
                            typeOfActivity: PRODUCTIVE,
                            image: req.body.latestPositionImage
                        }
                    },
                },
                {
                    upsert: true
                }
            );

        if (logs.modifiedCount == 1 || logs.upsertedCount == 1)
            message.push("movement captured");

    } catch (err) {

        await genericErrorLog(err, "captureMovementLog");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const checkSlotAvailability = async (req, res) => {

    try {

        //await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let count = 0;

        if (req.body.slots.length == 1 || req.body.slots.length == 2) {

            for (let i = 0; i < req.body.slots.length; i++) {

                let availability = await client
                    .collection(SLOTS)
                    .findOne(
                        {
                            fsId: req.params.fsId,
                            name: req.body.slots[i].name,
                            row: req.body.slots[i].row,
                            col: req.body.slots[i].col,
                            "occupancy": { "$elemMatch": { "level": req.body.slots[i].level, "status": EMPTY } }
                        }
                    );
                console.log(availability)
                if (availability) {
                    count = count + 1;
                }

            };

            if (count < req.body.slots.length) {

                if (req.body.slots.length == 1) {
                    return sendResponse(res, 200, true, Messages.SLOT_OCCUPIED);
                }

                else {
                    return sendResponse(res, 200, true, Messages.SLOT_COMBINATION_NOT_AVAILABLE);
                };
            }

            else {

                if (req.body.slots.length == 1) {
                    return sendResponse(res, 200, true, Messages.SLOT_AVAILABLE);
                }

                else {
                    return sendResponse(res, 200, true, Messages.SLOT_COMBINATION_AVAILABLE);
                };
            };
        }

        else {
            return sendResponse(res, 404, false, Messages.SLOT_ARRAY_LENGTH_ERROR);
        };

    } catch (err) {

        await genericErrorLog(err, checkSlotAvailability);
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const machineMovements = async (req, res) => {

    try {

        // await saveActivityLog(req, res);

        const client = await dbService.getClient();

        let container = await client
            .collection(CONTAINERS)
            .findOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    containerId: req.body.currentActiveContainerId
                }
            );

        let containerSizeId = container.containerSizeId;
        let containerTypeId = container.containerTypeId;

        let logs = await client
            .collection(MACHINE_MOVEMENTS)
            .updateOne(
                {
                    fsId: req.body.fsId,
                    organizationId: req.body.organizationId,
                    machineId: req.body.machineId,
                },
                {
                    "$push": {
                        "movementDetails": {
                            containerId: req.body.currentActiveContainerId,
                            containerSizeId: containerSizeId,
                            containerTypeId: containerTypeId,
                            movedTo: req.body.currentActiveContainerPosition,
                            activityTime: getEpochTime(filter = true),
                            actualActivityTime: getEpochTime(),
                            typeOfActivity: PRODUCTIVE,
                            image: req.body.latestPositionImage
                        }
                    },
                },
                {
                    upsert: true
                }
            );

        if (logs.modifiedCount == 1 || logs.upsertedCount == 1)
            message.push("machine movement captured");

    } catch (err) {

        await genericErrorLog(err, "machineMovements");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    getMachineDetails,
    getUniqueMachineDetails,
    addMachineDetails,
    updateMachineDetails,
    deleteMachine,
    getFreightStations,
    getActiveFreightStations,
    getUniqueFreightStation,
    addFrieghtStation,
    getSlots,
    updateSlots,
    checkSlotAvailability,
}
