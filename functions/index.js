const admin = require('firebase-admin');
const functions = require('firebase-functions');
const stripe = require("stripe")("sk_test_Irhk77KavFhME0JraJhXVUQK");

// CORS Express middleware to enable CORS Requests.
const cors = require('cors');

admin.initializeApp();

exports.createUserRecord = functions.auth.user().onCreate((userRecord, context) => {
  return admin.database().ref('users/' + userRecord.uid).set({
    displayName: userRecord.displayName || null,
    email: userRecord.email || null,
    photoURL: userRecord.photoURL || null
  });
});

exports.processMemberDues = functions.https.onRequest((req, res) => {
  cors({origin: true, methods: ['POST']})(req, res, () => {
    const uid = req.body.uid;
    const email = req.body.email;
    const sku = normalizeStripeSku(req.body.sku);
    const tokenId = req.body.tokenId;

    console.log('Processing %s payment for uid %s', sku, uid);
    var orderId;
    var chargeId;
    return processStripeOrder(uid, email, sku, tokenId).then(order => {
      orderId = order.id;
      chargeId = order.charge;
      return updateStripeCharge(chargeId, email);
    }).then(charge => {
      return updateMemberDatabase(uid, orderId, sku);
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

var updateMemberDatabase = function(uid, orderId, sku) {
  const isLifetime = isLifetimeMembership(sku);
  const now = new Date();
  const year = isLifetime ? 'lifetime' : now.getFullYear().toString();
  return admin.database().ref('members/all/' + uid).set({
    year: year,
    paidOn: now.toJSON()
  }).then(() => {
    return admin.database().ref('members/' + year + '/' + uid).set({
      orderId: orderId,
      paidOn: now.toJSON()
    });
  });
};

var isLifetimeMembership = function(sku) {
  return sku == 'new_lifetime_membership';
};

var normalizeStripeSku = function(sku) {
  const isNotYear = x => isNaN(parseInt(x));
  return sku.split('_').filter(isNotYear).join('_');
};

var processStripeOrder = function(uid, email, sku, tokenId) {
  return stripe.orders.create({
    currency: 'usd',
    email: email,
    items: [{
      type: 'sku',
      parent: sku,
      quantity: 1
    }],
    metadata: {
      uid: uid
    }
  }).then(order => {
    return stripe.orders.pay(order.id, {
      source: tokenId
    });
  }).then(order => {
    console.log('Processed order %s', order.id);
    return order;
  });
};

var updateStripeCharge = function(chargeId, email) {
  return stripe.charges.update(chargeId , {
    description: 'Payment for member dues',
    receipt_email: email
  });
};

var fulfillStripeOrder = function(orderId) {
  return stripe.orders.update(orderId, {
    status: 'fulfilled'
  }).then(order => {
    console.log('Fulfilled order %s', order.id);
  });
};
