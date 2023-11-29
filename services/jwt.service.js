const jwt = require('jsonwebtoken');
const { storeRefreshToken } = require('./token.service');
const { sendResponse, genericErrorLog } = require('../lib/utils');
const Messages = require('../constants/messages');


const ACCESS_TOKEN_SECRET = process.env.ACC_TOKEN_SECRET || 'topSecret';
const REFRESH_TOKEN_SECRET = process.env.REF_TOKEN_SECRET || 'refreshTopSecret'
const TOKEN_ISSUER = process.env.TOKEN_ISSUER || "cym-node-app"

const getAccessToken = (payload, accessTokenValidity) => {

	try {
		const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
			expiresIn: accessTokenValidity || '30d',
			subject: payload.userName,
			issuer: TOKEN_ISSUER
		})

		return accessToken;

	} catch (err) {
		console.log('Access Token', err.toString())
		return null;
	}
}

const getRefreshToken = (payload, refreshTokenValidity) => {

	try {
		console.log(payload);
		const refreshToken = jwt.sign({ userName: payload.userName },
			REFRESH_TOKEN_SECRET, {
			expiresIn: refreshTokenValidity || '180d',
			subject: payload.userName,
			issuer: TOKEN_ISSUER
		})

		storeRefreshToken(
			refreshToken,
			payload.userId
		);

		return refreshToken;

	} catch (err) {
		console.log('Refresh token', err.toString())
		return null;
	}
}

const getVerifiedACTokenData = (token)=>{
	try{
		const decode = jwt.verify(token, ACCESS_TOKEN_SECRET);
		return decode
	}catch(err){
		return null
	}

}

const verifyAccessToken = async (req, res, next) => {
	try {

		let authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];

		if (!token)
			return sendResponse(res, 400, false, Messages.NO_TOKEN_FOUND);
		const tokenData = getVerifiedACTokenData(token);

		if (!tokenData)
			return sendResponse(res, 401, false, Messages.INVALID_EXPIRED_TOKEN);

		req['tokenData'] = tokenData;

		next();
	} catch (err) {

		await genericErrorLog(err, "verifyAccessToken");
		console.log(err);
		return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR);

	}

};

const getMachineAccessToken = (payload, accessTokenValidity) => {

	try {
		const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
			expiresIn: accessTokenValidity || '30d',
			subject: payload.vehicleNo,
			issuer: TOKEN_ISSUER
		})

		return accessToken;

	} catch (err) {
		console.log('Access Token', err.toString())
		return null;
	}
}

const getMachineRefreshToken = (payload, refreshTokenValidity) => {

	try {
		const refreshToken = jwt.sign( payload,
			REFRESH_TOKEN_SECRET, {
			expiresIn: refreshTokenValidity || '180d',
			subject: payload.vehicleNo,
			issuer: TOKEN_ISSUER
		})

		storeRefreshToken(
			refreshToken,
			payload.userId
		);

		return refreshToken;

	} catch (err) {
		console.log('Refresh token', err.toString())
		return null;
	}
}



module.exports = {
	getAccessToken,
	getRefreshToken,
	getVerifiedACTokenData,
	verifyAccessToken,
	getMachineAccessToken,
	getMachineRefreshToken
}
