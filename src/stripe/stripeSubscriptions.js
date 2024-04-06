import { stripe } from './config';
import MemberModel from '../models/Member.model';

/**
 *
 *  curl -X POST \
  http://localhost:4000/webhook \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "customer.subscription.created",
  "data": {
     "object": {
      "id": "pi_1J5sDh2eZvKYlo2c5Aykjezq",
      "customer": "cus_PaXdBpygBjmmku",
      "status": "active"
    }
  }
}'
 */

export const handleStripeSubscriptionCreated = async ({
  customerId,
  subscriptionStatus,
  subscriptionId,
}) => {
  /**
   * 1. get the customerId and the subscripitionId
   * 2. Look up the customer in stripe with the customerId to get the email
   * 3. Update the DB with the customerId, subscriptionID, and the status.
   */
  //   console.log({ customerId, subscriptionId, subscriptionStatus });
  const customer = await stripe.customers.retrieve(customerId);

  const member = await MemberModel.find({ email: customer.email });

  if (!member) {
    return false;
  }

  member[0].subscriptionId = subscriptionId;
  member[0].customerId = customerId; // Add to Model
  member[0].subscriptionStatus = subscriptionStatus; // add to Model
  member[0].save();

  return true;
};
