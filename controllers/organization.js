const Messages = require('../constants/messages');
const { sendResponse, getUniqueId, genericErrorLog, saveActivityLog, findDuplicate } = require('../lib/utils');
const dbService = require('../lib/database');
const Config = require("../constants/configuration");
const { ORGANIZATIONS } = require('../constants/collections');

const checkDuplicate = async (payload) => {
    const duplicate = await findDuplicate(
        ORGANIZATIONS,
        {	// Fields to check for duplication
            email: payload.email,
            // contactNumber: payload.contactNumber,
        },
        {	// Unique field name & value
            name: 'organizationId',
            value: payload.organizationId
        }
    );
    let message = '';
    if (duplicate.isDuplicate) {
        switch (duplicate.fieldName) {
            case 'email':
                message = Messages.EMAIL_EXISTS;
                break;
            // case 'contactNumber':
            //     message = Messages.MOBILE_NO_EXISTS;
            //     break;
            default:
                message = Messages.BAD_REQUEST;
                break;
        }
    }
    duplicate.message = message;
    return duplicate;
}

const addOrganization = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        let obj = req.body;
        console.log(req.body);
        if (!obj.organizationId) {
            obj.organizationId = getUniqueId();
        }

        const duplicateCheck = await checkDuplicate(obj);

        if (duplicateCheck.isDuplicate) {
            return sendResponse(res, 400, false, duplicateCheck.message);
        }

        const client = await dbService.getClient();

        await client
            .collection(ORGANIZATIONS)
            .findOneAndUpdate(
                { organizationId: obj.organizationId },
                { $set: obj },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.ORGANIZATION_ADDED);

    } catch (err) {

        await genericErrorLog(err, 'addOrganization');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getOrganizations = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let findBy = {};
        let pageNumber = parseInt(req.query.pageNumber) || Config.PAGE_INDEX;
        let size = parseInt(req.query.pageSize) || Config.PAGE_SIZE;
        let skip = (pageNumber - 1) * size;

        if (req.query.hasOwnProperty('organizationName')) {
            findBy["organizationName"] = {
                $regex: `.*${req.query.organizationName}.*`,
                $options: "i",
            };
        }

        if (req.query.hasOwnProperty('address')) {
            findBy["address"] = {
                $regex: `.*${req.query.address}.*`,
                $options: "i",
            };
        }

        if (req.query.hasOwnProperty('contactNumber')) {
            findBy["contactNumber"] = {
                $regex: `.*${req.query.contactNumber}.*`,
                $options: "i",
            };
        }

        if (req.query.hasOwnProperty('isActive')) {
            findBy["isActive"] = JSON.parse(req.query.isActive);
        }

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

        let organizations = await client
            .collection(ORGANIZATIONS)
            .aggregate(pipeline)
            .toArray();

        if (!organizations.length)
            return sendResponse(res, 204, true, Messages.NO_ORGANIZATIONS_FOUND, []);

        return sendResponse(res, 200, true, Messages.ORGANIZATIONS_DETAILS_FETCHED, organizations);

    } catch (err) {

        await genericErrorLog(err, 'getOrganizations');
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getActiveOrganizations = async (req, res) => {

    try {

        await saveActivityLog(req, res);
        const client = await dbService.getClient();
        console.log('**** getActiveOrganizations ***** ');
        let findBy = {
            isActive: true
        };

        let organizations = await client
            .collection(ORGANIZATIONS)
            .find(findBy)
            .project({
                organizationId: 1,
                organizationName: 1,
                _id: 0
            })
            .sort({ organizationName: 1 })
            .toArray();

        if (!organizations.length) {
            return sendResponse(res, 204, true, Messages.NO_ORGANIZATIONS_FOUND, []);
        }

        return sendResponse(res, 200, true, Messages.ORGANIZATIONS_DETAILS_FETCHED, organizations);

    } catch (error) {

        await genericErrorLog(error, 'getActiveOrganizations');
        console.log(error);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

    }

};

const getUniqueOrganization = async (req, res) => {

    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let organization = await client
            .collection(ORGANIZATIONS)
            .findOne({ organizationId: req.params.organizationId });

        if (!organization)
            return sendResponse(res, 204, true, Messages.NO_ORGANIZATIONS_FOUND, []);

        return sendResponse(res, 200, true, Messages.ORGANIZATIONS_DETAILS_FETCHED, organization);

    } catch (err) {

        await genericErrorLog(err, 'getUniqueOrganization')
        console.log(err);
        return sendResponse(res, 500, true, Messages.INTERNAL_SERVER_ERROR);

    }

};

module.exports = {
    addOrganization,
    getOrganizations,
    getActiveOrganizations,
    getUniqueOrganization
}
