import Stripe from 'stripe';
const stripe = new Stripe(
  'sk_test_51MEhewEtfRIDf54VFCVLh45XFX6AKm4I4zxoWmswNLmaJEacdUPzWuLgUAVMipvZOS5R80ZK0kNuQSck3aHn3JwE00Ep73AOVu'
);
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

    return 'hello';
  } catch (error) {
    throw error;
  }
};
