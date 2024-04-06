dotenv.config({ path: 'config.env' });
import dotenv from 'dotenv';
import admin from './firebase-config';
import axios from 'axios';
export const authFirebase = async (token) => {
  if (!token) {
    throw new Error('Missing token');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw error;
  }
};

export const generateCustomeDevToken = async (email) => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const token = await admin.auth().createCustomToken(user.uid);

    const res = await axios({
      url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${process.env.FB_API_KEY}`,
      method: 'post',
      data: {
        token: token,
        returnSecureToken: true,
      },
      json: true,
    });

    return res.data.idToken;
  } catch (e) {
    throw e;
  }
};
