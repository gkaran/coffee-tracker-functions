import * as functions from 'firebase-functions';

export const portionsSum = functions.firestore
    .document('/users/{userid}/portions/{portionid}')
    .onWrite(change => updateSumForUser(change, 'portions'));

export const paidPortionsSum = functions.firestore
    .document('/users/{userid}/payments/{paymentid}')
    .onWrite(change => updateSumForUser(change, 'paidPortions'));

function updateSumForUser(change, field) {
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