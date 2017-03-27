const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);

exports.createUserRecord = functions.auth.user().onCreate(event => {
  const user = event.data;
  return admin.database().ref('users/' + user.uid).set({
    displayName: user.displayName || null,
    email: user.email || null,
    photoURL: user.photoURL || null
  });
});
