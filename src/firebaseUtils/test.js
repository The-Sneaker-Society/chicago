const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "sneaker-society",
    private_key_id: "ee1ed93e70adb003b085775ba80f2b0e011ca8d3",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD6Oy7sFvGzMm4g\nzOmOQGLIkteVf5y2f0A/83wlBJYUvc46Us47YnYsVjRjHr6Uxt5tTh8yAswWNLJU\nMtjZfbcyaltw/mEn6eVZxPwrMTB+C1o0QWMHtmadRoLUV+gtEkXhA30qGojStz0I\n9MAyKHxW3OL8LK6nBc9wR3t66oW2U5bFHg2HKWY90O0mb/8FD0PCbtS+flpoeFxH\nRv097SMKBeQuiY1JQU6/0wn9DljO2zb6dun70q+VKm4bJ0FPenCS09p3jLLiAsTC\nzf1FMthndciNUSbMyc66xT1sw0w++MSNUSOD6cYI8zCEBquhtGUb74uWII/PnXLE\nWbAHOkuDAgMBAAECggEAKDsSWjF+KUS3DAhQlzxRetSRBfTUafWfi33xZwo2ZEii\nkCH2t6Qm7Q3sXPCjzMuvFdJ06td5nysDGM0WrDECySpBtV2l79gyYEfEEIsCCYx4\nXjpnr4/Ag7zDFVy6HrT3YyvqbbXXwE5m6Q+17tqE0yUETBhATujSPHJhr0C8FV9I\nVORs4mtcaV/2LZM6rCGNqo1yXASUnAFQGoF63+iuDjoZC5TtdaKqZWMRK4Fwwx+l\nGyMIyeFaJrMlDevb/BRzJlXiNT4ipu4eQLYaD9baqPfx5vlTGm8zRlmyTD+b/U7k\nr679nku8FGnWVwNo4aESBdv8XnTM/nW8oa3DPxpxwQKBgQD/VJ0DwxroT9LFYHaq\nCzMv2RlYbi0dJ4FcyG7qaxDZzAjI7SBF9FJsOuH/LnkCOx2DWazC40NYI9si6eYV\n+YmL8GsDLfJZkmQZAFPfL+iQxX2NKap5Cmb59/hLecn6AUITvo5fw9fhqQB1dpnN\n54CzQSUMmh5JxiBfoqTkwYh1EQKBgQD64yWoZh80IfHrxfCUTqXJ++Kj2THqGSdL\nyifozmac4TTLbSDyuBMNidBXojAIechrNOlZyazWFsA+hC3liuVc8iP01iv/ncUP\n/Dp1iM3SsRVVcdvaW0xjeJOfeSfNUa4Gcg4AmuV4PMDTCU0OlfxXKLNHlBtDajOk\nPgJ8mLrnUwKBgQD05Kj8lMNYEkesPAtUqQ1dVTL0GCh5EA0Jesy3Vh2BaCr83ELa\nFa6AVDGy2VYDB8QU2YvUGLnc7fcek4y1gvOkHuHk2MrbkocjW6cWKBM9183F+TKi\niZGfK3Egox1QBqjj2x8fRu3maHwiLbDzRpmwVEk+vwtR4w/l6k+RgPZqoQKBgQDg\n1ietXregFLulO+J6RnE1LlLR25dr39bjiOtzK2WyOfECTW41ltkcTOE1Z9f8AIen\n6+cj3CTUR9dJL1OiXnNmdGncxQLxNQahaL1LD6rEooYn6L3KVf+DNU+2nvEYg5ad\nmCEMUcRLmMaFWdSAudFGmubvwr8cD1TwX9ICryzwmQKBgB3alolXDiEa0fWDJctW\nTxBV3d5SAhox0Lv3eyKese5o+Sf2rqk0WX42dpU/iYH6DjlTFvnWxmCbEn4ljANw\nmAgy2ast+PCywpy58urQSvfbCqLVHpNOY1+5MRz5+wE0jLcsH+2EjkZmhAa05Urh\nU68e2DsuCBAuZZpMLZQKqbz/\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-3v528@sneaker-society.iam.gserviceaccount.com",
    client_id: "106307883832998006587",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-3v528%40sneaker-society.iam.gserviceaccount.com",
  }),
  databaseURL: `https://snaker-society.firebaseio.com/`,
});

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
