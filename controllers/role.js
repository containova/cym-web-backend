const Messages = require('../constants/messages');
const { sendResponse, getUniqueId, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { ROLES } = require('../constants/collections');
const messages = require('../constants/messages');

const addRoles = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        let obj = req.body;

        if (!obj.roleId)
            obj.roleId = getUniqueId();

        const client = await dbService.getClient();

        await client
            .collection(ROLES)
            .findOneAndUpdate(
                { roleId: obj.roleId },
                { $set: obj },
                { upsert: true }
            );

        return sendResponse(res, 201, true, Messages.ROLES_ADDED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const getRoles = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        let findBy = {};

        if (req.query.hasOwnProperty('organizationId'))
            findBy['organizationId'] = req.query.organizationId;

		if (req.query.hasOwnProperty('organizationName'))
			findBy['organizationName'] = {
				$regex: `.*${req.query.organizationName}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('fsId'))
			findBy.fsId = req.query.fsId;

		if (req.query.hasOwnProperty('fsName'))
			findBy['fsName'] = {
				$regex: `.*${req.query.fsName}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('roleId'))
            findBy['roleId'] = req.query.roleId;

		if (req.query.hasOwnProperty('roleLevel'))
			findBy['roleLevel'] = {$gte: parseInt(req.query.roleLevel)};

		if (req.query.hasOwnProperty('address'))
			findBy['address'] = {
				$regex: `.*${req.query.address}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('isActive'))
			findBy['isActive'] = JSON.parse(req.query.isActive);


        let roles = await client
            .collection(ROLES)
            .find(findBy)
            .toArray();

        if (!roles.length)
            return sendResponse(res, 204, false, Messages.NO_ROLES_FOUND, []);

        return sendResponse(res, 200, true, Messages.ROLES_FETCHED, roles);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

const deleteRole = async (req, res) => {
    try {
        await saveActivityLog(req, res);
        const client = await dbService.getClient();

        await client
            .collection(ROLES)
            .deleteOne({ role: req.params.roleId });

        return sendResponse(res, 200, true, Messages.ROLE_DELETED);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};


const getUniqueRole = async (req, res) => {
    try {
		await saveActivityLog(req, res);
        const client = await dbService.getClient();

		console.log('Mobile No: ', req.params.roleId);

        const mobile = await client
            .collection(ROLES)
            .findOne({ roleId: req.params.roleId });

        if (!mobile)
            return sendResponse(res, 204, true, Messages.NO_ROLES_FOUND);

        return sendResponse(res, 200, true, Messages.DATA_FETCHED, mobile);

    } catch (err) {
        console.log(err);
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
    }
};

module.exports = {
    addRoles,
    getRoles,
	getUniqueRole,
    deleteRole
}
