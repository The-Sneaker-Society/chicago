import admin from "./firebase-config";

export const authFirebase = async (token) => {
  try {
    if (!token) {
      throw new Error("Missing Token");
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (e) {
    throw e;
  }
};
