const admin = require('firebase-admin');
const functions = require('firebase-functions');

// CORS Express middleware to enable CORS Requests.
const cors = require('cors');

admin.initializeApp(functions.config().firebase);

exports.createUserRecord = functions.auth.user().onCreate(event => {
  const user = event.data;
  return admin.database().ref('users/' + user.uid).set({
    displayName: user.displayName || null,
    email: user.email || null,
    photoURL: user.photoURL || null
  });
});

exports.processMemberDues = functions.https.onRequest((req, res) => {
  cors({origin: true, methods: ['POST']})(req, res, () => {
    const uid = req.body.uid;
    const sku = req.body.sku;
    const tokenId = req.body.tokenId;

    const skuParts = sku.split('_');
    const year = skuParts[1];
    const now = new Date();

    console.log('Processing %s payment for uid %s', sku, uid);
    return admin.database().ref('users/' + uid).once('value').then(snapshot => {
      const user = snapshot.val();
      throw Error('Unimplemented');
    }).then(orderId => {
      console.log('Created order ' + orderId);
      return orderId;
    }).then(orderId => {
      console.log('Paid order ' + orderId);
      return admin.database().ref('members/' + year + '/' + uid).set({
        orderId: orderId,
        paidOn: now.toJSON()
      });
    }).then(() => {
      return admin.database().ref('members/all/' + uid).set({
        year: year,
        paidOn: now.toJSON()
      });
    }).then(() => {
      res.status(200).end();
    }).catch(error => {
      console.error(error.message);
      res.status(400).send(error.message);
    });
  });
});
