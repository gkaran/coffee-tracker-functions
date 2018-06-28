import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// ========================================================================
//                        USER PORTION HANDLING
// ========================================================================

export const update_user_portions = functions.firestore
    .document('/portions/{portionid}')
    .onWrite((change, context) => {
        const userId = change.after.exists ? change.after.get('user') : change.before.get('user');
        if (!userId) {
            return false;
        }
        const userRef = db.doc(`/users/${userId}`);
        return update_user_total_portions(context.eventId, userRef, userId);
    });

function update_user_total_portions(eventId: string, userRef: FirebaseFirestore.DocumentReference, userId: string) {
    return db.runTransaction(transaction => transaction.get(db.collection('/portions').where('user', '==', userId).select('amount'))
        .then(portions => portions.docs.map(d => d.get('amount') || 0).reduce((a, b) => a + b, 0))
        .then(totalPortions => {
            console.log(`${eventId}: Updating total portions to ${totalPortions} for user ${userId}`);
            return transaction.update(userRef, {totalPortions});
        }));
}


// ========================================================================
//                        USER PAYMENT HANDLING
// ========================================================================

export const update_user_payments = functions.firestore
    .document('/payments/{paymentid}')
    .onWrite((change, context) => {
        const userId = change.after.exists ? change.after.get('user') : change.before.get('user');
        if (!userId) {
            return false;
        }
        const userRef = db.doc(`/users/${userId}`);
        return update_user_total_paid_portions(context.eventId, userRef, userId);
    });

function update_user_total_paid_portions(eventId: string, userRef: FirebaseFirestore.DocumentReference, userId: string) {
    return db.runTransaction(transaction => transaction.get(db.collection('/payments').where('user', '==', userId).select('portions'))
        .then(portions => portions.docs.map(d => d.get('portions') || 0).reduce((a, b) => a + b, 0))
        .then(paidPortions => {
            console.log(`${eventId}: Updating paid portions to ${paidPortions} for user ${userId}`);
            return transaction.update(userRef, {paidPortions});
        }));
}


// ========================================================================
//                        USER CREATION HANDLING
// ========================================================================

export const init_user_data = functions.auth.user().onCreate((user) => {
    return admin.firestore().doc(`/users/${user.uid}`).set({
        totalPortions: 0,
        paidPortions: 0,
        maxPortions: 0,
        name: user.displayName || user.email
    }, {merge: true})
});
