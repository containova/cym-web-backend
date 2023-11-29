const { REFRESH_TOKEN_COLL } = require('../constants/collections');
const { getHashedText } = require('./crypto.service');
const dbService = require('../lib/database');
const { getEpochTime } = require('../lib/utils');

const storeRefreshToken = async (refreshToken, userId) => {

	try {
		const client = await dbService.getClient();

		await client
			.collection(REFRESH_TOKEN_COLL)
			.updateOne({
				subject: userId
			}, {
				$set: {
					subject: userId,
					token: getHashedText(refreshToken, 10),
					createdAt: getEpochTime(),
					isActive: true
				}
			}, {
				upsert: true
			});
	} catch (err) {
		console.log(err.toString());
	}
}

module.exports = {
	storeRefreshToken
}