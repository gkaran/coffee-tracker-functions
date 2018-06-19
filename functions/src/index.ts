import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp(functions.config().firebase);

export const portionsSum = functions.firestore
    .document('/portions/{portionid}')
    .onWrite(change => updateUserStats(change, 'totalPortions'));

export const paidPortionsSum = functions.firestore
    .document('/payments/{paymentid}')
    .onWrite(change => updateUserStats(change, 'paidPortions'));

export const initUserData = functions.auth.user().onCreate((user) => {
    return admin.firestore().collection('users').doc(user.uid).set({
        totalPortions: 0,
        paidPortions: 0,
        maxPortions: 0,
        name: user.displayName
    }, {merge: true})
});

function updateUserStats(change, field) {
    const portionsRef = change.after.ref.parent;

    let increment = 0;
    if (change.after.exists && change.before.exists) { // UPDATE
        increment = change.after.get('amount') - change.before.get('amount')
    } else if (change.after.exists && !change.before.exists) { // CREATE
        increment = change.after.get('amount');
    } else if (!change.after.exists && change.before.exists) { // DELETE
        increment = -change.before.get('amount');
    }

    const userRef = portionsRef.parent;
    return userRef.get().then((user) => userRef.set({[field]: user.get(field) + increment}, {merge: true}));
}

