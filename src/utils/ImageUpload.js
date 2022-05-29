import aws from "aws-sdk";
import multerS3 from "multer-S3";
import multer from "multer";

const s3 = new aws.S3();

aws.config.update({
  secretAccessKey: process.env.S3_SECRET,
  accessKeyId: process.env.S3_ACCESS_KEY,
  region: "us-east-2",
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type, only JPEG and PNG is allowed!"), false);
  }
};

const upload = multer({
  fileFilter,
  storage: multerS3({
    acl: "public-read",
    s3,
    bucket: "", // {bucket name},
    metadata: function (req, file, cb) {
      cb(null, { fieldName: "TESTING_METADATA" });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString());
    },
  }),
});

export const uploadImage = (req, res) => {
  return res.send("image upload service");
};

/* 
info: https://levelup.gitconnected.com/file-upload-express-mongodb-multer-s3-7fad4dfb3789
*/
