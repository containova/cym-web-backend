const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const {CONTAINER_SIZES, CONTAINER_STATUSES, CONTAINER_TYPES, DAMAGE_LEVEL, PRIORITY, PURPOSE, MOVEMENT_TYPES, ZONE} = require('../constants/collections')

const getCollectionData = async (req, res) => {
  try {

    await saveActivityLog(req, res);

    if (!req.query.collectionName)
      return sendResponse(res, 400, false, Messages.COLLECTION_NAME_REQUIRED);

    const client = await dbService.getClient();

    const masterCollection = [CONTAINER_SIZES, CONTAINER_STATUSES, CONTAINER_TYPES, DAMAGE_LEVEL, PRIORITY, PURPOSE, MOVEMENT_TYPES, ZONE];

    // let sortFeild = req.query.collectionName.substr(0, req.query.collectionName.length - 1);
    // console.log('sortFeild', sortFeild);
    if(masterCollection.includes(req.query.collectionName))
    {

      let masterData = await client
        .collection(req.query.collectionName)
        .find()
        .toArray();
      console.log("inside master data");
      return sendResponse(res, 200, true, Messages.DATA_FETCHED, masterData);

    };

    let data = await client
      .collection(req.query.collectionName)
      .find({
        $or: [
          { isActive: true },
          { status: "active" }
        ],
        organizationId: req.query.organizationId,
        fsId: req.query.fsId
      })
      .toArray();
      console.log("normal data")
    return sendResponse(res, 200, true, Messages.DATA_FETCHED, data);

  } catch (err) {

    await genericErrorLog(err, 'getMasterData');
    console.log(err);
    return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

  }

};

module.exports = {
  getCollectionData
}
