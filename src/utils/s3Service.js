import S3 from 'aws-sdk/clients/s3';
// import multer from "multer";

// const fileFilter = (req, file, cb) => {
//   if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
//     cb(null, true);
//   } else {
//     cb(new Error("Invalid file type, only JPEG and PNG is allowed!"), false);
//   }
// };

// const storage = multer.memoryStorage();

// const upload = multer({
//   storage,
//   fileFilter,
// });

export const s3Uploadv2 = async (file) => {
  const s3 = new S3();

  const param = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: "/test/name-tester",
    Body: file.buffer,
  };

  const result = await s3.upload(param).promise();
  return result;
};
