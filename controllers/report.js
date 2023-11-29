const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, saveActivityLog, getEpochTime } = require('../lib/utils');
const dbService = require('../lib/database');
const { CONTAINERS, SLOTS, TRAILERS, MACHINE_MOVEMENTS, MOVEMENT_LOGS } = require('../constants/collections');

const shippinglinewiseinventory = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let inventory = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        statusId: 1
                    }
                },
                {
                    $project: {
                        shippingLine: {
                            $substr: ["$containerId", 0, 3],
                        },
                        containerSizeId: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            shippingLine: "$shippingLine",
                            containerSizeId: "$containerSizeId",
                        },
                        count: {
                            $count: {},
                        },
                    },
                },
                {
                    $project: {
                        shippingline: "$_id.shippingLine",
                        containerSizeId: "$_id.containerSizeId",
                        count: 1,
                        '_id': 0
                    }
                },
                {
                    $sort: {
                        count: -1,
                    }
                }
            ])
            .toArray();

        console.log(inventory);

        if (!inventory.length)
            return sendResponse(res, 204, true, Messages.NO_INVENTORY_FOUND, []);

        const containerSizeIds = [1, 2, 3];

        const shippingLineDetails = {};

        inventory.forEach(obj => {
            const { shippingline, containerSizeId, count } = obj;

            if (!shippingLineDetails.hasOwnProperty(shippingline)) {
                shippingLineDetails[shippingline] = {};

                containerSizeIds.forEach(id => {
                    shippingLineDetails[shippingline][id] = 0;
                });
            }

            shippingLineDetails[shippingline][containerSizeId] += count;
        });

        const shippingLines = Object.keys(shippingLineDetails);
        const containerIdsArr = containerSizeIds.slice();
        const counts = [];

        shippingLines.forEach(shippingline => {
            containerIdsArr.forEach(containerSizeId => {
                counts.push(shippingLineDetails[shippingline][containerSizeId] || 0);
            });
        });

        let twentyFeetCount = [];
        let fortyFeetCount = [];
        let fortyFiveFeetCount = [];

        for (let i = 0; i < counts.length; i++) {
            if (i % 3 == 0) {
                twentyFeetCount.push(counts[i]);
            }
            else if (i % 3 == 1) {
                fortyFeetCount.push(counts[i]);
            }
            else if (i % 3 == 2) {
                fortyFiveFeetCount.push(counts[i]);
            }
        };

        let reportObj = {
            originalresponse: inventory,
            shippingLines: shippingLines,
            twentyFeetCount: twentyFeetCount,
            fortyFeetCount: fortyFeetCount,
            fortyFiveFeetCount: fortyFiveFeetCount
        };

        return sendResponse(res, 200, true, Messages.INVENTORY_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, 'shippinglinewiseinventory');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

};

const emptySlots = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let emptySlots = await client
            .collection(SLOTS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId
                    }
                },
                {
                    $unwind: "$occupancy",
                },

                {
                    $match: {
                        "occupancy.status": "empty",
                    },
                },
                {
                    $group: {
                        _id: "$name",
                        emptySlots: {
                            $count: {},
                        },
                    },
                },
                {
                    $project: {
                        name: "$_id",
                        emptySlots: 1,
                        _id: 0,
                    },
                },
                {
                    $sort: {
                        name: 1,
                    },
                },
            ])
            .toArray();

        if (!emptySlots.length)
            return sendResponse(res, 204, true, Messages.NO_EMPTY_SLOTS);

        let labels = [];
        let count = [];

        for (let i = 0; i < emptySlots.length; i++) {
            labels.push(emptySlots[i].name);
            count.push(emptySlots[i].emptySlots);
        };

        let reportObj = {
            labels: labels,
            count: count
        };

        return sendResponse(res, 200, true, Messages.EMPTY_SLOTS_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, 'emptySlots');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const blockwiseinventory = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let inventory = await client
            .collection(SLOTS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId
                    }
                },
                {
                    $unwind: "$occupancy",
                },
                {
                    $match: {
                        "occupancy.status": "occupied",
                    },
                },
                {
                    $lookup: {
                        from: "containers",
                        localField: "occupancy.containerId",
                        foreignField: "containerId",
                        as: "result",
                    },
                },
                {
                    $group: {
                        _id: {
                            name: "$name",
                            containerSizeId:
                                "$result.containerSizeId",
                        },
                        count: { $count: {} },
                    },
                },
                {
                    $sort: {
                        "_id.name": 1,
                    },
                },
                {
                    $project: {
                        name: "$_id.name",
                        containerSizeId: {
                            $first: "$_id.containerSizeId",
                        },
                        count: 1,
                        _id: 0,
                    },
                },
            ])
            .toArray();

        if (!inventory.length)
            return sendResponse(res, 204, true, Messages.NO_INVENTORY_FOUND, []);

        let inventoryDetails = [];

        for (let i = 0; i < inventory.length; i++) {

            if (inventory[i].containerSizeId) {

                if (inventory[i].containerSizeId == 2 || inventory[i].containerSizeId == 3) {
                    let obj = {};
                    obj.count = inventory[i].count / 2;
                    obj.name = inventory[i].name;
                    obj.containerSizeId = inventory[i].containerSizeId;
                    inventoryDetails.push(obj);

                }

                else
                    inventoryDetails.push(inventory[i]);

            }

        };

        const nameFieldName = 'name';
        const containerSizeIdFieldName = 'containerSizeId';
        const containerSizeIds = [1, 2, 3];
        const LaneDetails = {};

        inventoryDetails.forEach(obj => {

            const name = obj[nameFieldName];
            const containerSizeId = obj[containerSizeIdFieldName];
            const count = obj.count;

            if (!LaneDetails.hasOwnProperty(name)) {

                LaneDetails[name] = {};
                containerSizeIds.forEach(id => {
                    LaneDetails[name][id] = 0;
                });

            }

            LaneDetails[name][containerSizeId] += count;

        });

        const Lanes = Object.keys(LaneDetails);
        const containerSizeIdsArr = containerSizeIds.slice();
        const counts = [];

        Lanes.forEach(name => {
            containerSizeIdsArr.forEach(containerSizeId => {
                counts.push(LaneDetails[name][containerSizeId] || 0);
            });
        });

        console.log(Lanes);
        console.log(containerSizeIdsArr);
        console.log(counts);

        let twentyFeetCount = [];
        let fortyFeetCount = [];
        let fortyFiveFeetCount = [];

        for (let i = 0; i < counts.length; i++) {
            if (i % 3 == 0) {
                twentyFeetCount.push(counts[i]);
            }
            else if (i % 3 == 1) {
                fortyFeetCount.push(counts[i]);
            }
            else if (i % 3 == 2) {
                fortyFiveFeetCount.push(counts[i]);
            }
        }

        let reportObj = {
            originalresponse: inventoryDetails,
            Lanes: Lanes,
            twentyFeetCount: twentyFeetCount,
            fortyFeetCount: fortyFeetCount,
            fortyFiveFeetCount: fortyFiveFeetCount
        };

        return sendResponse(res, 200, true, Messages.INVENTORY_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, 'blockwiseinventory');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

};

const monthlyGateInGateOut = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let year;

        if (!req.query.year) {
            let currentDate = new Date();
            year = currentDate.getFullYear();
        }
        else
            year = parseInt(req.query.year);

        let yearString = year.toString().substring(2, 4);

        let monthsInString = ['Jan' + '-' + yearString, 'Feb' + '-' + yearString, 'Mar' + '-' + yearString, 'Apr' + '-' + yearString, 'May' + '-' + yearString, 'Jun' + '-' + yearString, 'Jul' + '-' + yearString, 'Aug' + '-' + yearString, 'Sept' + '-' + yearString, 'Oct' + '-' + yearString, 'Nov' + '-' + yearString, 'Dec' + '-' + yearString]


        const client = await dbService.getClient();

        let monthlyGateIn = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        statusId: 1
                    }
                },
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        gateInTime: {
                            $add: [
                                new Date("1970-01-01T00:00:00Z"),
                                "$gateInModifiedTime",
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        gateInYear: {
                            $year: "$gateInTime",
                        },
                    },
                },
                {
                    $match: { gateInYear: year },
                },
                {
                    $group: {
                        _id: {
                            gateInMonth: { $month: "$gateInTime" }
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: null,
                        counts: {
                            $push: {
                                month: "$_id.gateInMonth",
                                count: "$count"
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        counts: {
                            $map: {
                                input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                as: "m",
                                in: {
                                    $let: {
                                        vars: {
                                            matched: {
                                                $filter: {
                                                    input: "$counts",
                                                    cond: { $eq: ["$$this.month", "$$m"] }
                                                }
                                            }
                                        },
                                        in: {
                                            month: "$$m",
                                            count: {
                                                $cond: {
                                                    if: { $ne: [{ $size: "$$matched" }, 0] },
                                                    then: { $arrayElemAt: ["$$matched.count", 0] },
                                                    else: 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ])
            .toArray();

        let monthlyGateOut = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        statusId: 2
                    }
                },
                {
                    $addFields: {
                        gateOutModifiedTime: {
                            $multiply: [
                                "$gateOutDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        gateOutTime: {
                            $add: [
                                new Date("1970-01-01T00:00:00Z"),
                                "$gateOutModifiedTime",
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        gateOutYear: {
                            $year: "$gateOutTime",
                        },
                    },
                },
                {
                    $match: { gateOutYear: year },
                },
                {
                    $group: {
                        _id: {
                            gateOutMonth: { $month: "$gateOutTime" }
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: null,
                        counts: {
                            $push: {
                                month: "$_id.gateOutMonth",
                                count: "$count"
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        counts: {
                            $map: {
                                input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                as: "m",
                                in: {
                                    $let: {
                                        vars: {
                                            matched: {
                                                $filter: {
                                                    input: "$counts",
                                                    cond: { $eq: ["$$this.month", "$$m"] }
                                                }
                                            }
                                        },
                                        in: {
                                            month: "$$m",
                                            count: {
                                                $cond: {
                                                    if: { $ne: [{ $size: "$$matched" }, 0] },
                                                    then: { $arrayElemAt: ["$$matched.count", 0] },
                                                    else: 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ])
            .toArray();

        let transformedOutputGateIn = [];
        let transformedOutputGateOut = [];
        let months = [];
        let gateInCount = [];
        let gateOutCount = [];

        if (monthlyGateIn.length) {
            transformedOutputGateIn = monthlyGateIn[0].counts.map(count => ({
                month: monthsInString[count.month - 1],
                count: count.count
            }));
        }

        if (monthlyGateOut.length) {
            transformedOutputGateOut = monthlyGateOut[0].counts.map(count => ({
                month: monthsInString[count.month - 1],
                count: count.count
            }));
        }

        for (let i = 0; i < 12; i++) {
            const month = monthsInString[i];
            const gateIn = transformedOutputGateIn.find(item => item.month === month);
            const gateOut = transformedOutputGateOut.find(item => item.month === month);

            months.push(month);
            gateInCount.push(gateIn ? gateIn.count : 0);
            gateOutCount.push(gateOut ? gateOut.count : 0);
        }

        if (!monthlyGateIn.length) {
            months = monthsInString;
            gateInCount = new Array(12).fill(0);
        }

        if (!monthlyGateOut.length) {
            months = monthsInString;
            gateOutCount = new Array(12).fill(0);
        }

        let report = {
            months: months,
            gateInCount: gateInCount,
            gateOutCount: gateOutCount
        };

        return sendResponse(res, 200, true, Messages.MONTHLY_GATEIN_GATEOUT_REPORT_FETCHED, report);

    } catch (err) {

        await genericErrorLog(err, 'monthlyGateInGateOut');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const containerAging = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let currentTime = Date.now();
        let threeDaysAgo = currentTime - (3 * 24 * 60 * 60 * 1000);
        let fifteenDaysAgo = currentTime - (15 * 24 * 60 * 60 * 1000);
        let thirtyDaysAgo = currentTime - (30 * 24 * 60 * 60 * 1000);
        let sixtyDaysAgo = currentTime - (60 * 24 * 60 * 60 * 1000);

        const client = await dbService.getClient();

        let zeroToThree = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        "gateInModifiedTime": {
                            $gt: threeDaysAgo,
                            $lte: currentTime
                        },
                        statusId: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        let threeToFifteen = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        "gateInModifiedTime": {
                            $gt: fifteenDaysAgo,
                            $lte: threeDaysAgo
                        },
                        statusId: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        let fifteenToThirty = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        "gateInModifiedTime": {
                            $gt: thirtyDaysAgo,
                            $lte: fifteenDaysAgo
                        },
                        statusId: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        let thirtyToSixty = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        "gateInModifiedTime": {
                            $gt: sixtyDaysAgo,
                            $lte: thirtyDaysAgo
                        },
                        statusId: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        let moreThanSixty = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $addFields: {
                        gateInModifiedTime: {
                            $multiply: [
                                "$gateInDetails.modifiedTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        "gateInModifiedTime": {
                            $gt: sixtyDaysAgo,
                            $lte: thirtyDaysAgo
                        },
                        statusId: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        let totalCount = await client
            .collection(CONTAINERS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        statusId: 1
                    },
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                    },
                },
            ])
            .toArray();

        let zeroToThreeCount = zeroToThree[0]?.count || 0;
        let threeToFifteenCount = threeToFifteen[0]?.count || 0;
        let fifteenToThirtyCount = fifteenToThirty[0]?.count || 0;
        let thirtyToSixtyCount = thirtyToSixty[0]?.count || 0;
        let moreThanSixtyCount = moreThanSixty[0]?.count || 0;
        totalCount = (zeroToThreeCount + threeToFifteenCount + fifteenToThirtyCount + thirtyToSixtyCount + moreThanSixtyCount);

        let reportObj = {
            zeroToThreeCount: zeroToThreeCount,
            threeToFifteenCount: threeToFifteenCount,
            fifteenToThirtyCount: fifteenToThirtyCount,
            thirtyToSixtyCount: thirtyToSixtyCount,
            moreThanSixtyCount: moreThanSixtyCount,
            total: totalCount
        }

        return sendResponse(res, 200, true, Messages.CONTAINER_AGING_REPORT_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, 'monthlyGateInGateOut');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const trailerInCount = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        const client = await dbService.getClient();

        let trailerInCount = await client
            .collection(TRAILERS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId,
                        withinYard: true,
                    },
                },
                {
                    $lookup: {
                        from: "purpose",
                        localField: "gateInDetails.purposeId",
                        foreignField: "purposeId",
                        as: "result",
                    },
                },
                {
                    $group: {
                        _id: { $first: "$result.purpose" },
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        gateInType: "$_id",
                        count: "$count",
                        _id: 0,
                    },
                },
            ])
            .toArray();

        if (!trailerInCount.length)
            return sendResponse(res, 204, true, Messages.NO_TRAILERS_INSIDE_YARD, []);

        return sendResponse(res, 200, true, Messages.TRAILER_IN_COUNT_REPORT_FETCHED, trailerInCount);

    } catch (err) {

        await genericErrorLog(err, 'trailerCount');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }

};

const machineMovements = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let matchByObj = {};
        let lessThan, greaterThan;

        if (!req.query.filterByDate) {

            lessThan = getEpochTime(fiter = true);
            greaterThan = lessThan - (24 * 60 * 60);

            matchByObj["movementDetails.actualActivityTime"] = {
                "$gte": greaterThan,
                "$lt": lessThan
            };

        }

        else if (req.query.filterByDate == 'oneMonth') {

            lessThan = getEpochTime(fiter = true);
            greaterThan = lessThan - (30 * 24 * 60 * 60);

            matchByObj["movementDetails.actualActivityTime"] = {
                "$gte": greaterThan,
                "$lt": lessThan
            };

        }

        else if (req.query.filterByDate == 'threeMonth') {

            lessThan = getEpochTime(fiter = true);
            greaterThan = lessThan - (3 * 30 * 24 * 60 * 60);

            matchByObj["movementDetails.actualActivityTime"] = {
                "$gte": greaterThan,
                "$lt": lessThan
            };

        }

        else if (req.query.filterByDate == 'sixMonth') {

            lessThan = getEpochTime(fiter = true);
            greaterThan = lessThan - (6 * 30 * 24 * 60 * 60);

            matchByObj["movementDetails.actualActivityTime"] = {
                "$gte": greaterThan,
                "$lt": lessThan
            };

        }

        const client = await dbService.getClient();
        let pipeline = [
            {
                $match: {
                    organizationId: req.query.organizationId,
                    fsId: req.query.fsId
                }
            },
            {
                $unwind: "$movementDetails",
            },
            {
                $match: matchByObj
            },
            {
                $lookup: {
                    from: "machines",
                    localField: "machineId",
                    foreignField: "machineId",
                    as: "machineDetails"
                }

            },
            {
                $group: {
                    _id: "$machineId",
                    machineNameArr: {
                        $first: "$machineDetails.machineName"
                    },
                    movementCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    machineName: { $first: "$machineNameArr" },
                    _id: 0,
                    movementCount: 1
                }
            }

        ]
        let reportObj = await client
            .collection(MACHINE_MOVEMENTS)
            .aggregate(pipeline)
            .toArray();

        console.log(JSON.stringify(pipeline));

        if (!reportObj.length)
            return sendResponse(res, 204, true, Messages.NO_MACHINE_MOVEMENTS, []);

        return sendResponse(res, 200, true, Messages.MACHINE_MOVEMENTS_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, "machineMovements");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const monthlyContainerMovements = async (req, res) => {

    try {

        await saveActivityLog(req, res);

        if (!req.query.fsId || !req.query.organizationId)
            return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

        let year;

        if (!req.query.year) {
            let currentDate = new Date();
            year = currentDate.getFullYear();
        }
        else
            year = parseInt(req.query.year);

        let yearString = year.toString().substring(2, 4);

        let monthsInString = ['Jan' + '-' + yearString, 'Feb' + '-' + yearString, 'Mar' + '-' + yearString, 'Apr' + '-' + yearString, 'May' + '-' + yearString, 'Jun' + '-' + yearString, 'Jul' + '-' + yearString, 'Aug' + '-' + yearString, 'Sept' + '-' + yearString, 'Oct' + '-' + yearString, 'Nov' + '-' + yearString, 'Dec' + '-' + yearString];

        const client = await dbService.getClient();

        let containerMovement = await client
            .collection(MOVEMENT_LOGS)
            .aggregate([
                {
                    $match: {
                        organizationId: req.query.organizationId,
                        fsId: req.query.fsId
                    }
                },
                { $unwind: "$movementDetails" },
                {
                    $addFields: {
                        activityModifiedTime: {
                            $multiply: [
                                "$movementDetails.activityTime",
                                1000,
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        activityTime: {
                            $add: [
                                new Date("1970-01-01T00:00:00Z"),
                                "$activityModifiedTime",
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        activityYear: {
                            $year: "$activityTime",
                        },
                    },
                },
                {
                    $match: { activityYear: year },
                },
                {
                    $group: {
                        _id: {
                            activityMonth: { $month: "$activityTime" },
                            containerSizeId: '$containerSizeId',
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: "$_id.containerSizeId",
                        counts: {
                            $push: {
                                month: "$_id.activityMonth",
                                count: "$count"
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        containerSizeId: "$_id",
                        counts: {
                            $map: {
                                input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                as: "m",
                                in: {
                                    month: "$$m",
                                    count: {
                                        $let: {
                                            vars: {
                                                matched: {
                                                    $filter: {
                                                        input: "$counts",
                                                        cond: { $eq: ["$$this.month", "$$m"] }
                                                    }
                                                }
                                            },
                                            in: {
                                                $cond: [
                                                    { $ne: [{ $size: "$$matched" }, 0] },
                                                    { $arrayElemAt: ["$$matched.count", 0] },
                                                    0
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ])
            .toArray();

        console.log(containerMovement);

        if (!containerMovement.length)
            return sendResponse(res, 204, true, Messages.NO_CONTAINER_MOVEMENTS, []);

        let twentyFeetCount = [];
        let fortyFeetCount = [];
        let fortyFiveFeetCount = [];

        for (let i = 0; i < containerMovement.length; i++) {

            if (containerMovement[i].containerSizeId == 1) {
                for (let j = 0; j < 12; j++) {
                    twentyFeetCount.push(containerMovement[i].counts[j].count);
                }
            }

            else if (containerMovement[i].containerSizeId == 2) {
                for (let j = 0; j < 12; j++) {
                    fortyFeetCount.push(containerMovement[i].counts[j].count);
                }
            }

            else if (containerMovement[i].containerSizeId == 3) {
                for (let j = 0; j < 12; j++) {
                    fortyFiveFeetCount.push(containerMovement[i].counts[j].count);
                }
            }

        };

        twentyFeetCount = twentyFeetCount.length ? twentyFeetCount : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        fortyFeetCount = fortyFeetCount.length ? fortyFeetCount : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        fortyFiveFeetCount = fortyFiveFeetCount.length ? fortyFiveFeetCount : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];


        let reportObj = {
            months: monthsInString,
            twentyFeetCount: twentyFeetCount,
            fortyFeetCount: fortyFeetCount,
            fortyFiveFeetCount: fortyFiveFeetCount
        };

        return sendResponse(res, 200, true, Messages.MONTHLY_CONTAINER_MOVEMENTS_FETCHED, reportObj);

    } catch (err) {

        await genericErrorLog(err, "monthlyContainerMovements");
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    shippinglinewiseinventory,
    emptySlots,
    blockwiseinventory,
    monthlyGateInGateOut,
    containerAging,
    trailerInCount,
    machineMovements,
    monthlyContainerMovements
}
