const admin = require('firebase-admin');
// 1. Load the service account key file
const serviceAccount = require("../serviceAccountKey.json");

// 2. Initialize the Admin SDK with the service account credential
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function setManagerClaim(uid) {
  try {
    // 3. Set the custom user claim
    await admin.auth().setCustomUserClaims(uid, { role: 'manager' });
    console.log(`Successfully set manager claim for user: ${uid}`);

    // Verify the claim was set
    const userRecord = await admin.auth().getUser(uid);
    console.log('User Claims:', userRecord.customClaims);
  } catch (error) {
    console.error('Error setting custom claim:', error);
  } finally {
    process.exit(0);
  }
}

// 4. Get the UID from command line arguments
const targetUid = process.argv[2];

if (!targetUid) {
  console.error('Usage: node scripts/setManagerClaim.js <UID>');
  process.exit(1);
}

setManagerClaim(targetUid);