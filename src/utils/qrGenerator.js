import QRCode from 'qrcode';
export const createQRCode = async (text, options = {}) => {
  try {
    const qrDataURL = await new Promise((resolve, reject) => {
      QRCode.toDataURL(text, (err, string) => {
        if (err) {
          reject(err);
        } else {
          resolve(string);
        }
      });
    });
    return qrDataURL;
  } catch (e) {
    console.error('Error generating QR code:', e);
    throw new Error('Failed to generate QR code');
  }
};
