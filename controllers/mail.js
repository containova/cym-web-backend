const Messages = require('../constants/messages');
const { sendResponse, genericErrorLog, getUniqueId, getEpochTime, saveActivityLog } = require('../lib/utils');
const dbService = require('../lib/database');
const { mailTransport } = require('../services/mail.service');
const { EMAIL_LOG } = require('../constants/collections');
const { PENDING } = require('../constants/status');

const mailSend = async (req, res) => {
    try {
        if(!req.body || !req.body.hasOwnProperty('to') || !req.body.hasOwnProperty('msg') || !req.body.hasOwnProperty('subject') ){
            return sendResponse(res, 500, false, Messages.MANDATORY_INPUTS_REQUIRED)
        }
        let obj = req.body
        obj["mailSentTime"] = getEpochTime();
        obj["mailId"] = getUniqueId();
        obj["status"] = PENDING

        const client = await dbService.getClient();
        await client
            .collection(EMAIL_LOG)
            .insertOne(obj);

        let resu = await mailTransport(obj)
        if (req.body.automaticGenerate) {
            return
        }
        if (resu) {
            return sendResponse(res, 200, true, Messages.EMAIL_SEND)
        }
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
    } catch (err) {
        console.log(err);
        await genericErrorLog(err.toString(), 'mailSend')
        return sendResponse(res, 500, false, Messages.INTERNAL_SERVER_ERROR)
    }
}

module.exports = { mailSend }