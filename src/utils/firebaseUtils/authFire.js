import admin from "./firebase-config";

export const authFirebase = async (token) => {
  if (!token) {
    throw new Error("Missing token");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw error;
  }
};
