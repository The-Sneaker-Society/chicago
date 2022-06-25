import { s3Uploadv2 } from "./s3Service";
import nodemailer from "nodemailer";
import fs from "fs";
export const uploadImage = async (req, res) => {
  try {
    const htmlFilestream = fs.createReadStream("src/emails/new_contract.html");
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
      html: htmlFilestream,
      // attachments: test,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    console.log(req.files);
    return res.send("done");
  } catch (e) {
    throw e;
  }
};
