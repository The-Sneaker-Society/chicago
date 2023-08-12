import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config({ path: 'config.env' });

const { STRIPE_API_KEY } = process.env;

const stripe = new Stripe(STRIPE_API_KEY);
export const getMemberSubscription = async () => {
  try {
    const { subscriptions } = await stripe.customers.retrieve(
      'cus_OOyBkQham29oRv',
      {
        expand: ['subscriptions'],
      }
    );

    if (subscriptions.data.length === 0) {
      return 'not_avtive';
    }

    const subStuff = subscriptions.data;

    const subData = subscriptions.data.map((sub) => {
      return {
        subId: sub.id,
        active: sub.status,
      };
    });

    // TODO Do a lookup of sub id in our db to return the correct status or type
    console.log({ subscriptions, subData, subStuff });

    return subData[0].active;
  } catch (error) {
    throw error;
  }
};
