import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp(functions.config().firebase);

export const portionsSum = functions.firestore
    .document('/portions/{portionid}')
    .onWrite(change => updateUserStats(change, 'totalPortions', 'amount'));

export const paidPortionsSum = functions.firestore
    .document('/payments/{paymentid}')
    .onWrite(change => updateUserStats(change, 'paidPortions', 'portions'));

export const initUserData = functions.auth.user().onCreate((user) => {
    return admin.firestore().doc(`/users/${user.uid}`).set({
        totalPortions: 0,
        paidPortions: 0,
        maxPortions: 0,
        name: user.displayName
    }, {merge: true})
});

function updateUserStats(change, userFieldForUpdate, collectionAmountField) {
    let increment = 0;
    if (change.after.exists && change.before.exists) { // UPDATE
        increment = change.after.get(collectionAmountField) - change.before.get(collectionAmountField)
    } else if (change.after.exists && !change.before.exists) { // CREATE
        increment = change.after.get(collectionAmountField);
    } else if (!change.after.exists && change.before.exists) { // DELETE
        increment = -change.before.get(collectionAmountField);
    }

    const userRef = admin.firestore().doc(`/users/${change.after.get('user')}`);
    console.log(`Amount to be added: ${increment}`);
    return userRef
        .get()
        .then(user => {
            console.log(`Current value of ${userFieldForUpdate}: ${user.get(userFieldForUpdate)}`);
            return userRef.set({[userFieldForUpdate]: user.get(userFieldForUpdate) + increment}, {merge: true})
        });
}

