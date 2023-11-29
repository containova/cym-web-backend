const { v4: uuidv4 } = require('uuid');
const { SEQUENCE, DB_NAME, GENERIC_ERR_LOG, USR_ACT_LOG } = require('../constants/collections');
const database = require('./database');

const sendResponse = (res, statusCode, success, message, data) => {
	res.status(statusCode).json({ success, message, ...data && { data } });
}

const getUniqueId = () => uuidv4();

const getEpochTime = (forFilter = false) => {
	if (!forFilter) {
		return Math.floor(new Date().getTime() / 1000);
	}
	else {
		let date = new Date().setHours(23, 59, 59, 999);
		return Math.floor(new Date(date).getTime() / 1000);
	}
};

async function getNextSequence(client, sequenceId) {
	if (!sequenceId) {
		throw new Error("sequenceId is missing");
	}
	const result = await client
		.collection(SEQUENCE)
		.findOneAndUpdate(
			{ _id: sequenceId },
			{ $inc: { currVal: 1 } },
			{ returnNewDocument: true, upsert: true, returnOriginal: false }
		);
	return result.value.currVal;
}


async function getNextSequenceSort(client, filterObj) {
	if (!filterObj?.organizationId && !filterObj?.fsId) {
		throw new Error("organizationId or fsId is missing");
	}
	let result;
	try {
		result = await client
			.collection(SEQUENCE)
			.findOneAndUpdate(
				{ ...filterObj },
				{ $inc: { currVal: 1 } },
				{ returnNewDocument: true, upsert: true, returnOriginal: false }
			);
		return result.value.currVal;
	} catch (err) {
		filterObj["currVal"] = 1;
		result = await client
			.collection(SEQUENCE)
			.insertOne(filterObj);
		return 1;
	}
}

const generateRandomString = (stringLength = 8) => {
	let chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let randomString = "";

	for (var i = 0; i <= stringLength; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		randomString += chars.substring(randomNumber, randomNumber + 1);
	}

	return randomString;
}

const generateRandomNumber = (length = 4) => {
	const digits = "0123456789";
	let OTP = '';

	for (let i = 0; i < 4; i++) {
		OTP += digits[Math.floor(Math.random() * 10)];
	}

	return OTP;
}

const generateUserName = () => {

	let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let randomString = "";

	for (var i = 0; i < 4; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		randomString += chars.substring(randomNumber, randomNumber + 1);
	}
	return randomString + generateRandomNumber().toString()
}

const genericErrorLog = async (err, errorSource) => {
	try {
		let errorMessage = err.toString();
		let errorStack = err.stack;
		let client = await database.getClient();
		await client.collection(GENERIC_ERR_LOG).insertOne({
			errorMessage,
			errorStack,
			errorSource,
			createdTimeUnix: getEpochTime(),
			createdDt: new Date(),
		});
	} catch (err) {
		console.error(err);
	}
};

const saveActivityLog = async (
	req,
	res) => {
	try {
		let method = req.method;
		let url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`).href //req.url;
		let body = req.body;
		let query = req.query;
		let containerId = null;
		let fsId = "";
		let organizationId = "";
		let pathname = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`).pathname;
		let activityUserId = req.tokenData.userId;

		if (method === "GET" || method === "DELETE") {
			// activityUserId = query?.activityUserId;
			if (query?.containerId) {
				containerId = query.containerId;
			}
			if (query?.fsId) {
				fsId = query.fsId;
			}
			if (query?.organizationId) {
				organizationId = query.organizationId;
			}
		};

		if (method === "POST" || method === "PATCH") {
			//activityUserId = body?.activityUserId;
			if (body?.containerId) {
				containerId = body.containerId;
			}
			if (body?.fsId) {
				fsId = body.fsId;
			}
			if (body?.containerId) {
				organizationId = body.organizationId;
			}
		};

		let client = await database.getClient();

		await client.collection(USR_ACT_LOG).insertOne({
			url,
			pathname,
			method,
			body,
			query,
			activityUserId,
			containerId,
			fsId,
			organizationId,
			createdTimeUnix: getEpochTime(),
		});
	} catch (err) {
		console.error(err);
	}
};

const removeLog = async (obj) => {
	try {
		if (!obj.collectionName) {
			return;
		}
		let collectionName = obj.collectionName;
		let client = await database.getClient();
		// Create a new Date object for the current date
		const currentDate = new Date();

		// Subtract months from the current date
		currentDate.setMonth(currentDate.getMonth() - process.env.LOG_RETENTION_MONTHS);

		// Get the epoch time of three months ago
		const threeMonthsAgoEpochTime = Math.floor(currentDate.getTime() / 1000);

		await client.collection(collectionName).deleteMany({ createdTimeUnix: { $lte: threeMonthsAgoEpochTime } })

	} catch (err) {
		console.log(err)
	}
}

const findDuplicate = async (collectionName, fields, uniqueKey, andFields) => {
	try {
		let client = await database.getClient();

		const query = { $or: [] };
		if (andFields) {
			query.$and = [];
		}
		for (const field in fields) {
			query.$or.push({ [field]: fields[field] })
		}

		for (const field in andFields) {
			query.$and.push({ [field]: andFields[field] })
		}
		query[uniqueKey.name] = { $ne: uniqueKey.value };
		const duplicateDoc = await client.collection(collectionName).findOne(query);
		if (duplicateDoc) {
			for (const field in fields) {
				if (fields[field] === duplicateDoc[field]) {
					return {
						isDuplicate: true,
						fieldName: field
					}
				}
			}
		}
		return {
			isDuplicate: false,
			fieldName: null
		}
	} catch (error) {
		await genericErrorLog(err, 'findDuplicate');
		console.error('Error finding matching field value:', error);
		return {
			isDuplicate: true,
			fieldName: null
		}
	}
};

module.exports = {
	sendResponse,
	getUniqueId,
	getEpochTime,
	generateRandomString,
	generateRandomNumber,
	generateUserName,
	getNextSequence,
	genericErrorLog,
	saveActivityLog,
	getNextSequenceSort,
	removeLog,
	findDuplicate,
}
