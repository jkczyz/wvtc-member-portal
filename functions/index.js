const admin = require('firebase-admin');
const functions = require('firebase-functions');
const stripe = require("stripe")("sk_test_Irhk77KavFhME0JraJhXVUQK");

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
    var orderId;
    return admin.database().ref('users/' + uid).once('value').then(snapshot => {
      const user = snapshot.val();
      return processStripeOrder(user, sku, tokenId);
    }).then(order => {
      orderId = order.id;
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
      return fulfillStripeOrder(orderId);
    }).then(() => {
      res.status(200).end();
    }).catch(error => {
      console.error(error.message);
      res.status(400).send(error.message);
    });
  });
});

var processStripeOrder = function(user, sku, tokenId) {
  return stripe.orders.create({
    currency: 'usd',
    email: user.email,
    items: [{
      type: 'sku',
      parent: sku,
      quantity: 1
    }]
  }).then(order => {
    return stripe.orders.pay(order.id, {
      source: tokenId
    });
  }).then(order => {
    console.log('Processed order %s', order.id);
    return order;
  });
};

var fulfillStripeOrder = function(orderId) {
  return stripe.orders.update(orderId, {
    status: 'fulfilled'
  }).then(order => {
    console.log('Fulfilled order %s', order.id);
  });
};
