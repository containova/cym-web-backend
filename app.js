require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cron = require('node-cron');


const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const containerRoutes = require('./routes/container');
const freightStationRoutes = require('./routes/freightstation');
const fileRoutes = require('./routes/file');
const jobCardRoutes = require('./routes/jobcard');
const userRoutes = require("./routes/user");
const movementLogs = require('./routes/movementlog');
const buckets = require('./routes/bucket');
const demo = require('./routes/demo');
const reports = require('./routes/report');
const machines = require('./routes/machine');
const organizations = require('./routes/organization');
const yards = require('./routes/yard');
const roles = require('./routes/role');
const trailers = require('./routes/trailer');
const notify = require('./routes/notification');
const mail = require('./routes/mail');
const collectionData = require('./routes/collection');
const devices = require('./routes/devices');
const { archiveNotificationLog } = require('./controllers/notification');
const { EMAIL_LOG, NOTIFICATION_LOG_HIST, GENERIC_ERR_LOG, USR_ACT_LOG } = require('./constants/collections');
const { removeLog } = require('./lib/utils');

const app = express();
const apiLogFormat = process.env.NODE_ENV == 'production' ? 'common' : 'dev';

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(morgan(apiLogFormat));
app.use(cors({ origin: process.env.ORIGIN }));

app.use('/auth', authRoutes);
app.use('/config', configRoutes);
app.use('/containers', containerRoutes);
app.use('/freightstations', freightStationRoutes);
app.use('/files', fileRoutes);
app.use('/jobcards', jobCardRoutes);
app.use("/users", userRoutes);
app.use('/movementlogs', movementLogs);
app.use('/buckets', buckets);
app.use('/demo', demo);
app.use('/reports', reports);
app.use('/machines', machines);
app.use('/organizations', organizations);
app.use('/yards', yards);
app.use('/roles', roles);
app.use('/trailers', trailers);
app.use('/notify', notify);
app.use('/sendemail',mail);
app.use('/collection', collectionData);
app.use('/devices', devices);

cron.schedule('0 0 * * *', async() => {
	try {
		// Make the API call to trigger the desired endpoint
		await archiveNotificationLog();
		let obj = {collectionName : EMAIL_LOG}
		await removeLog(obj);
		obj = {collectionName : NOTIFICATION_LOG_HIST}
		await removeLog(obj);
		obj = {collectionName : GENERIC_ERR_LOG}
		await removeLog(obj);
		obj = {collectionName : USR_ACT_LOG}
		await removeLog(obj);
			
	} catch (err) {
		console.log(err)
	}
});

app.get('/ping', (req, res) => {
	res.status(200).json({
		success: true,
		message: 'hello from cyms-backend'
	})
})

app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
