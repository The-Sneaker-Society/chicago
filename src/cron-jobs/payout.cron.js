// 72h auto-payout cron (plan-escrow-dispute.md §4).
//
// Why node-cron over Agenda: single-instance dev, no extra Mongo/Redis
// collections; revisit when horizontally scaled. Runs hourly at minute :15
// (offset avoids the :00 pileup). Started from server.js:startApolloServer
// with a DISABLE_CRON=1 guard. The service-layer funnel is
// contractService.autoReleasePayouts — failures stay pending + eligible
// and are retried next hour (email alerts later, #8).
import cron from "node-cron";
import { contractService } from "../contracts/contract.service.js";

export const runAutoPayout = async (now = new Date()) => {
  try {
    const result = await contractService.autoReleasePayouts(now);
    console.log(
      `[PAYOUT_CRON] checked=${result.checked} released=${result.released} failed=${result.failed.length}`
    );
    return result;
  } catch (e) {
    console.log(`[PAYOUT_CRON] run failed: ${e.message}`);
    throw e;
  }
};

let payoutTask = null;

export const startPayoutCron = () => {
  if (process.env.DISABLE_CRON === "1") {
    console.log("[PAYOUT_CRON] disabled via DISABLE_CRON=1");
    return null;
  }
  if (payoutTask) {
    return payoutTask;
  }
  payoutTask = cron.schedule("15 * * * *", () => runAutoPayout());
  return payoutTask;
};

export const stopPayoutCron = () => {
  if (payoutTask) {
    payoutTask.stop();
    payoutTask = null;
  }
};

export default startPayoutCron;
