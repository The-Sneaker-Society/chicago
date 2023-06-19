import cron from 'node-cron';
import { sendEmail } from '../utils/sendEmail';

const emailCron = cron.schedule('*/1 * * * *', () => {
  // Sending the email
  sendEmail(
    'Thank You',
    'alanisyates96@gmail.com',
    { time: new Date().toLocaleString() },
    'src/emails/test.html'
  );
});
export default emailCron;
