const nodemailer = require("nodemailer");
const { genericErrorLog } = require("../lib/utils");
const dbService = require('../lib/database');
const { EMAIL_LOG } = require('../constants/collections');
const { SENT, ERROR } = require("../constants/status");

// async..await is not allowed in global scope, must use a wrapper
const mailTransport = async (obj) => {
  const client = await dbService.getClient();
  try {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    // let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: JSON.parse(process.env.MATL_SECURE), // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USERID, //testAccount.user, // generated ethereal user
        pass: process.env.MAIL_PASSWORD // testAccount.pass, // generated ethereal password
      },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: process.env.MAIL_SENDER_ID, // sender address
      to: obj.to, // list of receivers
      subject: obj.subject, // Subject line
      text: obj.msg, // plain text body
    });

    console.log("Message sent: %s", info);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
    await client
      .collection(EMAIL_LOG)
      .findOneAndUpdate({ "mailId": obj.mailId },
        { $set: { status: SENT, "messageInformation": info } },
        { upsert: false });

    return true

  } catch (err) {
    console.log(err);
    await client
      .collection(EMAIL_LOG)
      .findOneAndUpdate({ "mailId": obj.mailId },
        { $set: { status: ERROR, err: err.toString() } },
        { upsert: false });

    await genericErrorLog(err.toString(), 'mailTransport')
    return false
  }
}

module.exports = { mailTransport }
