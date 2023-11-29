const Messages = require('../constants/messages');
const { sendResponse, getEpochTime, genericErrorLog, saveActivityLog, getNextSequenceSort } = require('../lib/utils');
const dbService = require('../lib/database');
const { SLOTS, BUCKETS } = require('../constants/collections');
const { getUniqueId } = require('../lib/utils');

const getSlotDetails = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.query.organizationId || !req.query.fsId)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    let findBy = {
      organizationId: req.query.organizationId,
      fsId: req.query.fsId
    };

    const client = await dbService.getClient();

    let slots = await client
      .collection(SLOTS)
      .aggregate([
        {
          $match: findBy
        },
        {
          $project: {
            _id: {
              $toString: "$_id"
            },
            "name": 1,
            "row": 1,
            "col": 1,
          }
        },
        {
          $lookup: {
            from: "buckets",
            localField: "_id",
            foreignField: "slotIds",
            as: "result"
          }
        },
        {
          $addFields:
          {
            color:
            {
              $cond: {
                if: { $lte: ["$result", []] },
                then: "",
                else: { $first: "$result.color" }
              }
            }
          },
        },
        {
          $addFields:
          {
            bucketId:
            {
              $cond: {
                if: { $lte: ["$result", []] },
                then: "",
                else: { $first: "$result.bucketId" }
              }
            }
          }
        },
        {
          $project: {
            "_id": 1,
            "name": 1,
            "row": 1,
            "col": 1,
            "color": 1,
            "bucketId": 1
          }
        },
        {
          $group: {
            _id: "$name",
            count: { $sum: 1 },
            layout: { $push: "$$ROOT" }
          }
        },
        {
          $project: {
            name: "$_id",
            count: 1,
            layout: 1,
            _id: 0
          }
        },
        {
          $unset: "layout.name"
        }
      ])
      .toArray();

    if (!slots.length)
      return sendResponse(res, 204, true, Messages.NO_SLOTS_FOUND, []);

    return sendResponse(res, 200, true, Messages.SLOTS_FETCHED_SUCCESSFULLY, slots);

  } catch (err) {

    await genericErrorLog(err, 'getSlotDetails');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

const postBucket = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.body.organizationId || !req.body.fsId || !req.body.bucketName || !req.body.color || !req.body.slotIds || !req.body.rules)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    const client = await dbService.getClient();

    let bucket = await client
      .collection(BUCKETS)
      .find(
        {
          fsId: req.body.fsId,
          bucketName: req.body.bucketName
        }
      )
      .toArray();

    if (bucket.length)
      return sendResponse(res, 400, false, Messages.BUCKET_NAME_ALREADY_PRESENT);

    let bucketId = getUniqueId();

    let obj = {
      bucketId: bucketId,
      bucketName: req.body.bucketName,
      color: req.body.color,
      slotIds: req.body.slotIds,
      createdAt: getEpochTime(),
      rules: req.body.rules,
      slotIds: req.body.slotIds,
      createdBy: {
        userId: req.tokenData.userId
      },
      organizationId: req.body.organizationId,
      fsId: req.body.fsId,
      sortId: await getNextSequenceSort(client, { "organizationId": req.body.organizationId, "fsId": req.body.fsId }),
      //TODO
      //modifiedBy
      //createdBy
    };

    await client
      .collection(BUCKETS)
      .insertOne(obj);

    return sendResponse(res, 201, true, Messages.BUCKET_ADDED);

  } catch (err) {

    await genericErrorLog(err, 'postBucket');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

const updateBucket = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.body.organizationId || !req.body.fsId)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    let updateBy = {
      organizationId: req.body.organizationId,
      fsId: req.body.fsId,
      bucketId: req.body.bucketId
    };

    const client = await dbService.getClient();
    let obj = req.body;

    if (obj.hasOwnProperty('_id')) {
      delete obj._id;
      obj["modifiedAt"] = getEpochTime();
      obj["modifiedBy"] = {
        userId: req.tokenData.userId
      }
    }
    else {
      obj["createdAt"] = getEpochTime();
      obj["createdBy"] = {
        userId: req.tokenData.userId
      }
    };

    // if (req.body.color)
    //   obj["color"] = req.body.color;
    // if (req.body.bucketName)
    //   obj["bucketName"] = req.body.bucketName;
    // if (req.body.slotIds)
    //   obj

    await client
      .collection(BUCKETS)
      .updateOne(
        updateBy,
        {
          $set: obj
        },
        { upsert: false }
      );

    return sendResponse(res, 200, true, Messages.BUCKET_UPDATED);

  } catch (err) {

    await genericErrorLog(err, 'updateBucket');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};


const sortBucket = async (req, res) => {

  try {

    await saveActivityLog(req, res);
    let bucketArray = req.body;
    if (bucketArray.length == 0)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    const client = await dbService.getClient();


    // let updateBy = {
    //   organizationId: req.body.organizationId,
    //   fsId: req.body.fsId,
    //   bucketId: req.body.bucketId
    // };
    // if (obj.hasOwnProperty('_id')) {
    //   delete obj._id;
    //   obj["modifiedAt"] = getEpochTime();
    //   obj["modifiedBy"] = {
    //     userId: req.tokenData.userId
    //   }
    // }
    // else {
    //   obj["createdAt"] = getEpochTime();
    //   obj["createdBy"] = {
    //     userId: req.tokenData.userId
    //   }
    // };


    for (let i = 0; i < bucketArray.length; i++) {
      const bucket = bucketArray[i];
      const { bucketId } = bucket;
      const sortId = i + 1;
      await client.collection(BUCKETS).updateOne({ bucketId }, { $set: { sortId } });
    }


    return sendResponse(res, 200, true, Messages.BUCKET_SORTED);

  } catch (err) {

    await genericErrorLog(err, 'sortBucket');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};


const getAllBuckets = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.query.organizationId || !req.query.fsId)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    let findBy = {
      organizationId: req.query.organizationId,
      fsId: req.query.fsId
    }

    const client = await dbService.getClient();

    let bucketDetails = await client
      .collection(BUCKETS)
      .aggregate([
        {
          $match: findBy
        },
        {
          $project: {
            createdAt: 1,
            color: 1,
            bucketId: 1,
            sortId: 1,
            bucketName: 1,
            slotIds: {
              $map: {
                input: "$slotIds",
                as: "slots",
                in: {
                  $convert: {
                    input: "$$slots",
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
            localField: "slotIds",
            foreignField: "_id",
            as: "result",
          },
        },
        {
          $group: {
            _id: "$bucketId",
            count: {
              $sum: {
                $size: "$slotIds",
              },
            },
            createdAt: {
              $max: "$createdAt",
            },
            allocatedLanes: {
              $push: "$result.name",
            },
            bucketName: {
              $push: "$bucketName",
            },
            color: {
              $push: "$color"
            },
            sortId: {
              $push: "$sortId"
            }
          },
        },
        {
          $addFields: {
            uniqueLanes: {
              $reduce: {
                input: {
                  $first: "$allocatedLanes",
                },
                initialValue: [],
                in: {
                  $cond: {
                    if: {
                      $in: ["$$this", "$$value"],
                    },
                    then: "$$value",
                    else: {
                      $concatArrays: [
                        "$$value",
                        ["$$this"],
                      ],
                    },
                  },
                },
              },
            },
          },
        },

        {
          $project: {
            count: 1,
            createdAt: 1,
            uniqueLanes: 1,
            color: { $first: "$color" },
            bucketName: { $first: "$bucketName" },
            bucketId: "$_id",
            sortId: { $first: "$sortId" },
            _id: 0,
          },
        },
        {
          $sort: { sortId: 1 }
        }
      ])
      .toArray();

    if (!bucketDetails.length)
      return sendResponse(res, 204, true, Messages.NO_BUCKETS_FOUND, []);

    return sendResponse(res, 200, true, Messages.BUCKETS_FETCHED, bucketDetails);

  } catch (err) {

    await genericErrorLog(err, 'getAllBuckets');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

const getSpecificBucket = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.query.organizationId || !req.query.fsId)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    let findBy = {
      organizationId: req.query.organizationId,
      fsId: req.query.fsId,
      bucketId: req.query.bucketId
    };

    const client = await dbService.getClient();

    let bucket = await client
      .collection(BUCKETS)
      .findOne(findBy);

    if (!bucket)
      return sendResponse(res, 204, true, Messages.NO_BUCKETS_FOUND, []);

    return sendResponse(res, 200, true, Messages.BUCKETS_FETCHED, bucket);

  } catch (err) {

    await genericErrorLog(err, 'getSpecificBucket');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

const deleteBucket = async (req, res) => {

  try {
    await saveActivityLog(req, res);
    if (!req.query.organizationId || !req.query.fsId)
      return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

    let deleteBy = {
      organizationId: req.query.organizationId,
      fsId: req.query.fsId,
      bucketId: req.params.bucketId
    };

    const client = await dbService.getClient();

    let deleteBucket = await client
      .collection(BUCKETS)
      .deleteOne(deleteBy);

    if (deleteBucket.deletedCount == 0)
      return sendResponse(res, 200, true, Messages.NO_BUCKET_DELETED);

    return sendResponse(res, 200, true, Messages.BUCKET_DELETED);

  } catch (err) {

    await genericErrorLog(err, 'deleteBucket');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

module.exports = {
  getSlotDetails,
  postBucket,
  updateBucket,
  getAllBuckets,
  getSpecificBucket,
  deleteBucket,
  sortBucket
};
