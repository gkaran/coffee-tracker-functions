import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// ========================================================================
//                        USER PORTION HANDLING
// ========================================================================

export const update_user_portions = functions.firestore
    .document('/portions/{portionid}')
    .onWrite(async (change, context) => {
        const userId = change.after.exists ? change.after.get('user') : change.before.get('user');
        if (!userId) {
            return false;
        }

        if (change.after.exists) {
            await updatePortionCost(change, context);
        }

        return await updateUserPortionTotals(userId, context.eventId);
    });

async function updateUserPortionTotals(userId, eventId) {
    const userRef = db.doc(`/users/${userId}`);


    const portions = await db.collection('/portions').where('user', '==', userId).get();
    const {totalPortions, totalPortionsCost} = portions.docs.map(d => ({
        totalPortions: d.get('amount') || 0,
        totalPortionsCost: d.get('cost') || 0
    })).reduce((a, b) => ({
        totalPortions: a.totalPortions + b.totalPortions,
        totalPortionsCost: a.totalPortionsCost + b.totalPortionsCost
    }), {totalPortions: 0, totalPortionsCost: 0});

    console.log(`${eventId}: Updating total portions to ${totalPortions} and cost to ${totalPortionsCost} for user ${userId}`);
    return userRef.update({totalPortions, totalPortionsCost});
}

async function updatePortionCost(change, context) {
    const cost = await db.collection('/portion-costs')
        .where('effective date', '<=', change.after.get('date'))
        .orderBy('effective date', 'desc').get();

    const effectiveCost = cost.docs[0].data();
    console.log(`${context.eventId}: Will use cost of ${JSON.stringify(effectiveCost)}`);

    await change.after.ref.update({
        cost: +((change.after.get('amount') || 0) * (effectiveCost.cost || 0)).toFixed(2)
    });
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

        return db.runTransaction(async (t) => {
            await updateUserPaymentTotals(t, userId, context);
        });
    });

async function updateUserPaymentTotals(t, userId, context) {
    const userRef = db.doc(`/users/${userId}`);
    const portions = await t.get(db.collection('/payments').where('user', '==', userId).select('cost'));
    const totalPayments = portions.docs.map(d => d.get('cost') || 0).reduce((a, b) => a + b, 0);

    console.log(`${context.eventId}: Updating total payments to ${totalPayments} for user ${userId}`);
    return await t.update(userRef, {totalPayments});
}

// ========================================================================
//                        USER CREATION HANDLING
// ========================================================================

export const init_user_data = functions.auth.user().onCreate((user) => {
    return db.doc(`/users/${user.uid}`).set({
        totalPortions: 0,
        totalPortionsCost: 0,
        paidPortions: 0,
        totalPayments: 0,
        maxPortions: 0,
        name: user.displayName || user.email
    }, {merge: true})
});

// ========================================================================
//                        HTTP HELPER FUNCTION CALLS
// ========================================================================

export const update_payment_costs = functions.https.onRequest(async (req, res) => {
    const snapshot = await db.collection('/payments').get();
    await Promise.all(snapshot.docs.map((doc) => {
        return doc.ref.update({
            cost: +((doc.get('portions') || 0) * 0.15).toFixed(2),
        })
    }));
    res.send({message: 'All payments have been updated'});
    res.sendStatus(200);
});

export const update_portions_costs = functions.https.onRequest(async (req, res) => {
    const oldCostPortions = await db.collection('/portions')
        .where('date', '<=', new Date(2019, 4, 14, 12))
        .get();
    const newCostPortions = await db.collection('/portions')
        .where('date', '>', new Date(2019, 4, 14, 12))
        .get();

    await Promise.all([
        ...oldCostPortions.docs.map(doc => doc.ref.update({
            cost: +((doc.get('amount') || 0) * 0.15).toFixed(2)
        })),
        ...newCostPortions.docs.map(doc => doc.ref.update({
            cost: +((doc.get('amount') || 0) * 0.18).toFixed(2)
        })),
    ]);

    res.send({message: 'All portions have been updated'});
    res.sendStatus(200);
});

export const update_user_data = functions.https.onRequest(async (req, res) => {
    const users = (await db.collection('/users').get()).docs;
    const payments = (await db.collection('/payments').get()).docs;
    const coffees = (await db.collection('/portions').get()).docs;

    await Promise.all(users.map(user => {
        const totalPayments = payments.filter(payment => payment.get('user') === user.id)
            .map(payment => payment.get('cost'))
            .reduce((a, b) => a + b, 0);
        const totalPortionsCost = coffees.filter(coffee => coffee.get('user') === user.id)
            .map(coffee => coffee.get('cost'))
            .reduce((a, b) => a + b, 0);
        return user.ref.update({totalPayments, totalPortionsCost});
    }));

    res.send({message: 'All users have been updated'});
    res.sendStatus(200);
});
