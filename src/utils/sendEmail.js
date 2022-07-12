// import { s3Uploadv2 } from "./s3Service";
import nodemailer from "nodemailer";
import fs, { readFile } from "fs";
import Handlebars from "handlebars";

export const sendEmail = async (firstName, lastName, contractId, email) => {
  try {
    const filePath = "src/emails/new_contract.html";
    const source = fs.readFileSync(filePath, "utf-8").toString();
    const template = Handlebars.compile(source);
    const replacements = {
      userName: `${firstName} ${lastName}`,
      link: `${process.env.APP_URL}/dashboard`,
    };
    const htmlToSend = template(replacements);

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: "alanis.yates@thesneakerssociety.com",
      //   to: "alanis.yates@thesneakerssociety.com",
      to: email,
      subject: "New Contract!",
      //   text: "YOOOOOOO THIS WORKED",
      html: htmlToSend,
      // attachments: test,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
  } catch (e) {
    throw e;
  }
};
