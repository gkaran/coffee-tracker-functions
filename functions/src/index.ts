import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// ========================================================================
//                        USER PORTION HANDLING
// ========================================================================

export const update_user_portions_on_portion_creation = functions.firestore
    .document('/portions/{portionid}')
    .onCreate((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = change.get('amount') || 0;
        return update_user_total_portions(context.eventId, userRef, userId, increment);
    });

export const update_user_portions_on_portion_update = functions.firestore
    .document('/portions/{portionid}')
    .onUpdate((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = (change.after.get('amount') || 0) - change.before.get('amount') || 0;
        return update_user_total_portions(context.eventId, userRef, userId, increment);
    });

export const update_user_portions_on_portion_deletion = functions.firestore
    .document('/portions/{portionid}')
    .onDelete((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = change.get('amount') || 0;
        return update_user_total_portions(context.eventId, userRef, userId, -increment);
    });

function update_user_total_portions(eventId: string, userRef: FirebaseFirestore.DocumentReference, userId: string, increment: number) {
    return db.runTransaction(transaction => transaction.get(userRef).then(user => {
        const oldPortions = user.get('totalPortions') || 0;
        const newPortions = oldPortions + increment;
        console.log(`${eventId}: Updating total portions from ${oldPortions} to ${newPortions} for user ${userId}`);
        return transaction.update(userRef, {totalPortions: newPortions});
    }));
}


// ========================================================================
//                        USER PAYMENT HANDLING
// ========================================================================

export const update_user_payments_on_payment_creation = functions.firestore
    .document('/payments/{paymentid}')
    .onCreate((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = change.get('portions') || 0;
        return update_user_total_paid_portions(context.eventId, userRef, userId, increment);
    });

export const update_user_payments_on_payment_update = functions.firestore
    .document('/payments/{paymentid}')
    .onUpdate((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = (change.after.get('portions') || 0) - change.before.get('portions') || 0;
        return update_user_total_paid_portions(context.eventId, userRef, userId, increment);
    });

export const update_user_payments_on_payment_deletion = functions.firestore
    .document('/payments/{paymentid}')
    .onDelete((change, context) => {
        const userId = context.auth.uid;
        const userRef = db.doc(`/users/${userId}`);
        const increment = change.get('portions') || 0;
        return update_user_total_paid_portions(context.eventId, userRef, userId, -increment);
    });

function update_user_total_paid_portions(eventId: string, userRef: FirebaseFirestore.DocumentReference, userId: string, increment: number) {
    return db.runTransaction(transaction => transaction.get(userRef).then(user => {
        const oldPortions = user.get('paidPortions') || 0;
        const newPortions = oldPortions + increment;
        console.log(`${eventId}: Updating paid portions from ${oldPortions} to ${newPortions} for user ${userId}`);
        return transaction.update(userRef, {paidPortions: newPortions});
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
