import Stripe from 'stripe';
import { env } from '~/env/server';

let stripe: Stripe;
export const getServerStripe = async () => {
  if (!env.STRIPE_SECRET_KEY) {
    return;
  }

  if (!stripe)
    stripe = await new Stripe(env.STRIPE_SECRET_KEY, {
      typescript: true,
      apiVersion: '2022-11-15',
    });
  return stripe;
};
