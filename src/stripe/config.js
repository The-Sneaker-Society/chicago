dotenv.config({ path: 'config.env' });

import Stripe from 'stripe';
import dotenv from 'dotenv';

const { STRIPE_API_KEY } = process.env;
export const stripe = new Stripe(STRIPE_API_KEY);
