const webpush = require('web-push');
const vapidKeys = require('../config/vapidkeys');

webpush.setVapidDetails(
  'mailto:subhankar.saha@blucocoondigital.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// API endpoint for sending push notifications
app.post('/send-notification', (req, res) => {
  const subscription = req.body.subscription;
  const payload = JSON.stringify({
    title: 'New Notification',
    message: 'Hello, you have a new notification!'
  });

  webpush.sendNotification(subscription, payload)
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch((error) => {
      console.error('Failed to send push notification:', error);
      res.status(500).json({ success: false, error: 'Failed to send push notification' });
    });
});
