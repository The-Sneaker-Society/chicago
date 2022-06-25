import { s3Uploadv2 } from "./s3Service";
import nodemailer from "nodemailer";

export const uploadImage = async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const test = req.files.map((file) => {
      return {
        filename: file.originalname,
        path: file.path,
        contentType: "image/jpeg",
      };
    });
    const mailOptions = {
      from: "alanis.yates@thesneakerssociety.com",
      to: "alanis.yates@thesneakerssociety.com",
      subject: "Test email from alan",
      text: "YOOOOOOO THIS WORKED",
      html: "<p>TestImages</p>",
      html: `<h1>Hello</h1>`,
      attachments: test,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    console.log(req.files);
    return res.send("Image Route");
  } catch (e) {
    throw e;
  }
};
