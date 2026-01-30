// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Test HTTP en europe-west1
exports.testHttpEU = functions
  .region("europe-west1")
  .https.onRequest((req, res) => {
    console.log("testHttpEU called");
    res.send("ok europe-west1");
  });

// Callable pour poser la claim cleanEmail
exports.setUserCleanEmailClaim = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Utilisateur non authentifié");
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    if (!email || !email.endsWith("@etu.umontpellier.fr")) {
      throw new functions.https.HttpsError("failed-precondition", "Adresse non autorisée");
    }
    const cleanEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_");
    try {
      await admin.auth().setCustomUserClaims(uid, { cleanEmail });
      console.log("Claim set for", uid, cleanEmail);
      return { success: true, cleanEmail };
    } catch (err) {
      console.error("setCustomUserClaims error", err);
      throw new functions.https.HttpsError("internal", "Impossible de poser la claim");
    }
  });
