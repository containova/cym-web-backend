const Messages = require('../constants/messages');
const { sendResponse, getUniqueId, findDuplicate, getEpochTime, genericErrorLog, saveActivityLog, generateRandomString } = require('../lib/utils');
const dbService = require('../lib/database');
const { USER_COLL } = require('../constants/collections');
const { getHashedText, generateSalt } = require('../services/crypto.service');
const { APPROVAL_STATUS } = require('../constants/status');
const { mailSend } = require('./mail');

const checkDuplicate = async (payload) => {
	const duplicate = await findDuplicate(
		USER_COLL,
		{	// Fields to check for duplication
			email: payload.email,
			contactNumber: payload.contactNumber,
		},
		{	// Unique field name & value
			name: 'userId',
			value: payload.userId
		},
		{
			// Fields to check for duplication
			organizationId: payload.organizationId
		}
	);
	let message = '';
	if (duplicate.isDuplicate) {
		switch (duplicate.fieldName) {
			case 'email':
				message = Messages.EMAIL_EXISTS;
				break;
			case 'contactNumber':
				message = Messages.MOBILE_NO_EXISTS;
				break;
			default:
				message = Messages.BAD_REQUEST;
				break;
		}
	}
	duplicate.message = message;
	return duplicate;
}

const userRegistration = async (req, res) => {

	try {

		await saveActivityLog(req, res);

		let payload = req.body;

		if (
			!payload.firstName ||
			!payload.roleId ||
			!payload.permissions ||
			!payload.organizationId ||
			!payload.email
		) {
			return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);
		}

		const client = await dbService.getClient();

		// let role = roles.find(role => role.roleName == req.body.role);

		// if (!role)
		// 	return sendResponse(res, 400, false, Messages.INCORRECT_ROLE);

		// const password = generateUserName();
		let password;
		let user = {
			...payload,
			userName: payload.email,
			displayName: payload.firstName
		}

		if (payload.lastName)
			user.displayName = user.displayName + ' ' + payload.lastName;

		if (!payload.userId) {
			password = generateRandomString(8);
			const salt = generateSalt();
			const encrytedPassword = getHashedText(password, salt);
			user.userId = getUniqueId();
			user.password = encrytedPassword;
			user.createdAt = getEpochTime();
			user.status = APPROVAL_STATUS;
		}
		const duplicateCheck = await checkDuplicate(user);

		if (duplicateCheck.isDuplicate) {
			return sendResponse(res, 400, false, duplicateCheck.message);
		}

		//TODO
		// Check that whether the user is already present or not
		// if (user)
		// 	return sendResponse(res, 409, false, Messages.CONFLICT_USER_EXISTS);

		// await client
		// 	.collection(USER_COLL)
		// 	.insertOne(user);

		let resu = await client
			.collection(USER_COLL)
			.findOneAndUpdate(
				{ userId: user.userId },
				{ $set: user },
				{ upsert: true }
			);
		let obj = {}
		if (resu) {
			obj.automaticGenerate = true;
			obj.to = [req.body.email]
			obj.subject = "Registration Confirmation: Password Enclosed"
			obj.msg = `Dear ${user.firstName}, \n\t Welcome to the CYM. \n User Name :${payload.email}  \n Password: ${password}`
			req.body = obj
			await mailSend(req, res)
			console.log(obj);
		}
		return sendResponse(res, 201, true, Messages.USER_REGISTRATION_SUCCESS);

	} catch (err) {

		await genericErrorLog(err, 'userRegistration');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}

};

const getUsers = async (req, res) => {

	try {

		await saveActivityLog(req, res);

		const client = await dbService.getClient();
		let findBy = {};

		if (req.query.organizationId)
			findBy.organizationId = req.query.organizationId;

		if (req.query.fsId != 'undefined' && req.query.fsId != undefined && req.query.fsId != null) {
			findBy.fsId = req.query.fsId;
		}

		if (req.query.hasOwnProperty('email'))
			findBy['email'] = {
				$regex: `.*${req.query.email}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('contactNumber'))
			findBy['contactNumber'] = {
				$regex: `.*${req.query.contactNumber}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('address'))
			findBy['address'] = {
				$regex: `.*${req.query.address}.*`,
				$options: 'i',
			};

		if (req.query.hasOwnProperty('isActive'))
			findBy['isActive'] = JSON.parse(req.query.isActive);

		if (req.query.hasOwnProperty('name'))
			findBy['fullName'] = {
				$regex: `.*${req.query.name}.*`,
				$options: "i",
			}
				

		// let users = await client
		// 	.collection(USER_COLL)
		// 	.find(findBy)
		// 	.toArray();

		let users = await client
			.collection(USER_COLL)
			.aggregate([
				{
					$addFields: {
						fullName: {
							$concat: ["$firstName", " ", "$lastName"]
						}
					}
				},
				{
					$match: findBy
				},
				{
					$lookup: {
						from: "organizations",
						localField: "organizationId",
						foreignField: "organizationId",
						as: "organizationDetails",
					},
				},
				{
					$lookup: {
						from: "freightStations",
						localField: "fsId",
						foreignField: "fsId",
						as: "freightStationDetails",
					},
				},
				{
					$lookup: {
						from: "roles",
						localField: "roleId",
						foreignField: "roleId",
						as: "roleDetails",
					},
				},
				{
					$project: {
						userId: 1,
						displayName: 1,
						email: 1,
						contactNumber: 1,
						organizationId: 1,
						fsId: 1,
						roleId: 1,
						isActive: 1,
						createdAt: 1,
						organizationName: {
							$first: "$organizationDetails.organizationName",
						},
						fsName: {
							$first: "$freightStationDetails.fsName",
						},
						roleName: {
							$first: "$roleDetails.roleName",
						},
						roleLevel: {
							$first: "$roleDetails.roleLevel",
						}
					},
				},
			])
			.toArray();

		if (users.length < 1)
			return sendResponse(res, 204, true, Messages.NO_USER_FOUND, []);

		return sendResponse(res, 200, true, Messages.USER_FETCHED_SUCCESSFULLY, users);

	} catch (err) {

		await genericErrorLog(err, 'getUsers');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}

};

const getUserDetails = async (req, res) => {

	try {

		await saveActivityLog(req, res);

		const client = await dbService.getClient();

		const users = await client
			.collection(USER_COLL)
			.aggregate([
				{
					$match:
						{ userId: req.tokenData.userId }
				},
				{
					$lookup: {
						from: "organizations",
						localField: "organizationId",
						foreignField: "organizationId",
						as: "organizationDetails",
					},
				},
				{
					$lookup: {
						from: "freightStations",
						localField: "fsId",
						foreignField: "fsId",
						as: "freightStationDetails",
					},
				},
				{
					$lookup: {
						from: "roles",
						localField: "roleId",
						foreignField: "roleId",
						as: "roleDetails",
					},
				},
				{
					$project: {
						userId: 1,
						displayName: 1,
						email: 1,
						organizationId: 1,
						fsId: 1,
						roleId: 1,
						organizationLogo: {
							$first:
								"$organizationDetails.organizationLogo",
						},
						organizationName: {
							$first:
								"$organizationDetails.organizationName",
						},
						fsName: {
							$first: "$freightStationDetails.fsName",
						},
						roleName: {
							$first: "$roleDetails.roleName",
						},
						roleLevel: {
							$first: "$roleDetails.roleLevel",
						},
						permissions: {
							$first: "$roleDetails.permissions",
						},
					},
				},
			])
			.toArray();

		if (!users.length)
			return sendResponse(res, 404, false, Messages.NO_USER_FOUND);

		return sendResponse(res, 200, true, Messages.USER_FETCHED_SUCCESSFULLY, users[0]);

	} catch (err) {

		await genericErrorLog(err, "getUserDetails");
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}

};

const getUniqueUser = async (req, res) => {

	try {

		await saveActivityLog(req, res);

		const client = await dbService.getClient();
		let pipeline = [
			{
				$match: {
					userId: req.params.userId,
				},
			},
			{
				$lookup: {
					from: "organizations",
					localField: "organizationId",
					foreignField: "organizationId",
					as: "organizationDetails",
				},
			},
			{
				$lookup: {
					from: "freightStations",
					localField: "fsId",
					foreignField: "fsId",
					as: "freightStationDetails",
				},
			},
			{
				$lookup: {
					from: "roles",
					localField: "roleId",
					foreignField: "roleId",
					as: "roleDetails", // Corrected the "as" field here
				},
			},
			{
				$project: {
					userId: 1,
					displayName: 1,
					email: 1,
					contactNumber: 1,
					organizationId: 1,
					fsId: 1,
					roleId: 1,
					isActive: 1,
					firstName: 1,
					lastName: 1,
					createdAt: 1,
					organizationName: {
						$first: "$organizationDetails.organizationName",
					},
					fsName: {
						$first: "$freightStationDetails.fsName",
					},
					roleName: {
						$first: "$roleDetails.roleName",
					},
					roleLevel: {
						$first: "$roleDetails.roleLevel",
					}
				}
			}
		]


		let user = await client
			.collection(USER_COLL).aggregate(pipeline).toArray()

		if (user.length == 0)
			return sendResponse(res, 404, false, Messages.NO_USER_FOUND);

		return sendResponse(res, 200, true, Messages.USER_FETCHED_SUCCESSFULLY, user[0]);

	} catch (err) {

		await genericErrorLog(err, "getUniqueUser");
		console.log(err);
		return sendResponse(res, 500, true, Messages.INTERNAL_SERVER_ERROR);

	}

};


module.exports = {
	userRegistration,
	getUsers,
	getUserDetails,
	getUniqueUser
}
