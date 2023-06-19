import cron from 'node-cron';
import { sendEmail } from '../utils/sendEmail';
import EmailModel from '../models/Email.model';

const emailSender = async () => {
  try {
    const emails = await EmailModel.find();
    console.log(emails);

    emails.forEach((emailObj) => {
      const { email, firstName, lastName, recieved } = emailObj;
      console.log({
        email: email,
        name: `${firstName} ${lastName}`,
        recieved: recieved,
      });

      // Perform the necessary actions for sending the email and updating the received emails
      // sendEmail(email, subject, text, html)
      // updateReceivedEmails(emailObj._id);
    });
  } catch (error) {
    throw error;
  }
};

const emailCron = cron.schedule('*/10 * * * * *', async () => {
  await emailSender();
  // Sending the email
  //   sendEmail(
  //     'Thank You',
  //     'alanisyates96@gmail.com',
  //     { time: new Date().toLocaleString() },
  //     'src/emails/test.html'
  //   );
});
export default emailCron;
