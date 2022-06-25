import { s3Uploadv2 } from "./s3Service";

export const uploadImage = async (req, res) => {
  try {
    // console.log(req.files);
    return res.send("Image Route");
  } catch (e) {
    throw e;
  }
};
