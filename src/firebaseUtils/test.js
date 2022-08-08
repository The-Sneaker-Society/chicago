const admin = require("firebase-admin");

admin.initializeApp();

const getToken = (token) => {
  if (token.startsWith("Bearer ")) {
    return token.substring(7, token.length);
  } else {
    throw new Error("Invalid Token");
  }
};

export const fireAuth = async (token) => {
  try {
    if (!token) {
      throw new Error("missing Token");
    }

    const formattedToken = getToken(token);

    const decoded = await admin.auth().verifyIdToken(formattedToken);

    return { id: decoded.uid };
  } catch (e) {
    throw e;
  }
};
