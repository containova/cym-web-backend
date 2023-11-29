const { compareHash, getHashedText, generateSalt } = require('../services/crypto.service');
const { getAccessToken, getRefreshToken, getMachineAccessToken, getMachineRefreshToken } = require('../services/jwt.service');
const { ObjectId } = require('mongodb');
const { USER_COLL, REFRESH_TOKEN_COLL, MACHINES, MOBILES } = require('../constants/collections');
const dbService = require('../lib/database');
const { sendResponse, getEpochTime, getUniqueId, saveActivityLog, genericErrorLog } = require('../lib/utils');
const Messages = require('../constants/messages');
const roles = require('../constants/roles');
const { APPROVAL_STATUS, ACTIVE } = require('../constants/status');
const { ACCESS_TOKEN_VALIDITY, REFRESH_TOKEN_VALIDITY } = require('../constants/tokens')


const register = async (req, res) => {

	try {

		if (!req.body.firstName || !req.body.password || !req.body.role || !req.body.organizationId || !req.body.fsId || !req.body.contactNumber)
			return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);


		let role = roles.find(role => role.roleName == req.body.role);

		if (!role)
			return sendResponse(res, 400, false, Messages.INCORRECT_ROLE);

		const salt = generateSalt();
		const encrytedPassword = getHashedText(req.body.password, salt);

		const employee = {
			userId: getUniqueId(),
			firstName: req.body.firstName || "",
			lastName: req.body.lastName || "",
			userName: parseInt(req.body.contactNumber),
			organizationId: req.body.organizationId,
			fsId: req.body.fsId,
			password: encrytedPassword,
			role,
			createdAt: getEpochTime(),
			//createdBy:req.tokenData.userId
			status: APPROVAL_STATUS
		};

		const client = await dbService.getClient();
		//TODO
		//Check that whether the user is already present or not
		// if (user)
		// 	return sendResponse(res, 409, false, Messages.CONFLICT_USER_EXISTS);
		await client
			.collection(USER_COLL)
			.insertOne(employee);

		return sendResponse(res, 201, true, Messages.USER_REGISTRATION_SUCCESS);

	} catch (err) {

		await genericErrorLog(err, 'register');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}
};

const login = async (req, res) => {

	try {

		if (!req.body.userName || !req.body.password)
			return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

		const client = await dbService.getClient();

		const userArr = await client
			.collection(USER_COLL)
			.find({
				userName: req.body.userName
			})
			.toArray();

		if (!userArr.length)
			return sendResponse(res, 404, false, Messages.USER_NOT_FOUND);

		// TODO: encryption will be used instead of hashing
		let user;

		for (let i=0;i<userArr.length; i++){
			if (compareHash(req.body.password, userArr[i].password)){
				user=userArr[i];
				break
			}
		}
		console.log(user)
		if (!user)
			return sendResponse(res, 401, false, Messages.INCORRECT_PASSWORD);

		let payload = {
			userName: user.userName,
			userId: user.userId,
			role: user.roleName,
			// organizationId: user.organizationId,
			// fsId: user.fsId
		}

		const accessToken = getAccessToken(payload, ACCESS_TOKEN_VALIDITY);

		const refreshToken = getRefreshToken(payload, REFRESH_TOKEN_VALIDITY);

		if (!accessToken || !refreshToken)
			return sendResponse(res, 500, false, Messages.TOKEN_GENERATION_ERROR);

		return sendResponse(res, 200, true, Messages.USER_AUTHENTICATION_SUCCESS, { accessToken, refreshToken });

	} catch (err) {

		await genericErrorLog(err, 'login');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}
};

const machineLogin = async (req, res) => {
	try {
		if (!req.body.vehicleNo || !req.body.mobileNo)
			return sendResponse(res, 400, false, Messages.MANDATORY_INPUTS_REQUIRED);

		const client = await dbService.getClient();

		const vehicle = await client
			.collection(MACHINES)
			.aggregate([
				{
					$match:
					{
						vehicleNo: req.body.vehicleNo,
						status: ACTIVE
					},
				},
				{
					$lookup: {
						from: "mobileDevices",
						localField: "mobileId",
						foreignField: "deviceId",
						as: "mobiles",
					},
				},
				{
					$project: {
						organizationId: 1,
						fsId: 1,
						machineId: 1,
						vehicleNo: 1,
						mobileNo: {
							$first:
								"$mobiles.mobileNo",
						}
					}
				}
			]).toArray()

		if (!vehicle.length)
			return sendResponse(res, 400, false, Messages.NO_VEHICLE_REGISTERED);

		if (req.body.mobileNo !== vehicle[0].mobileNo)
			return sendResponse(res, 400, false, Messages.MOBILE_NOT_TAGGED);

		let payload = {
			organizationId: vehicle[0].organizationId,
			fsId: vehicle[0].fsId,
			machineId: vehicle[0].machineId,
			vehicleNo: vehicle[0].vehicleNo,
			mobileNo: vehicle[0].mobileNo,
			isAuthenticated: true,
		}

		const accessToken = getMachineAccessToken(payload, ACCESS_TOKEN_VALIDITY);

		const refreshToken = getMachineRefreshToken(payload, REFRESH_TOKEN_VALIDITY);

		if (!accessToken || !refreshToken)
			return sendResponse(res, 500, false, Messages.TOKEN_GENERATION_ERROR);

		return sendResponse(res, 200, true, Messages.MACHINE_AUTHENTICATION_SUCCESS, { accessToken, refreshToken });

	} catch (err) {
		await genericErrorLog(err, 'machineLogin');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
	}
}

const getMachineProfile = async (req, res) => {

	try {
		await saveActivityLog(req, res);

		return sendResponse(res, 200, true, Messages.MACHINE_PROFILE_FETCHED, req.tokenData);
	} catch (err) {
		await genericErrorLog(err, 'getMachineProfile');
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);
	}
};

module.exports = {
	register,
	login,
	machineLogin,
	getMachineProfile
};
