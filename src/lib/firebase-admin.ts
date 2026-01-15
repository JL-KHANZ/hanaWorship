import * as admin from "firebase-admin";

function initializeAdmin() {
    if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
            console.warn("Firebase Admin environment variables are missing. Some server-side auth features might not work.");
            return null;
        }

        try {
            return admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                }),
            });
        } catch (error) {
            console.error("Firebase admin initialization error", error);
            return null;
        }
    }
    return admin.app();
}

// Export initialization function and getters instead of module-level constants
export const getAdminAuth = () => {
    initializeAdmin();
    return admin.auth();
};

export const getAdminDb = () => {
    initializeAdmin();
    return admin.firestore();
};
