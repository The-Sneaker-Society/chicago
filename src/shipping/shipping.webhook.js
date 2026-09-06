import { contractStatus, contractEvent } from "../contracts/contract.constants.js";
import { contractRepository } from "../contracts/contract.repository.js";
import { shippingRepository } from "./shipping.repository.js";
import { shippingService } from "./shipping.service.js";
import { trackingState } from "./shipping.constants.js";

/**
 * POST /webhook/shippo — Shippo sends JSON (no HMAC; route security is the
 * unguessable URL + Clerk bypass in server.js). Always answers 200 after
 * processing so Shippo doesn't retry-storm. Unknown ids are logged, never
 * thrown. See plan-shipping.md §2.7.
 */

const transition = async (contract, toStatus, event) => {
  if (!contract || contract.status === contractStatus.canceled || contract.status === toStatus) {
    return; // idempotent — duplicate webhook deliveries or canceled contracts are no-ops
  }
  await contractRepository.updateById(contract._id, {
    status: toStatus,
    $push: { timeline: { event, date: new Date() } },
  });
};

const applyTrackUpdate = async (contract, leg, rawStatus) => {
  if (!contract || contract.status === contractStatus.canceled) {
    return;
  }
  const state = shippingService.normalizeTrackingStatus(rawStatus);
  if (leg === "inbound") {
    if (state === trackingState.inTransit) {
      await transition(contract, contractStatus.inboundShipped, contractEvent.inboundShipped);
    } else if (state === trackingState.delivered) {
      await transition(contract, contractStatus.arrivedAtMember, contractEvent.inboundDelivered);
    }
  } else {
    if (state === trackingState.inTransit || state === trackingState.preTransit) {
      await transition(contract, contractStatus.returnShipped, contractEvent.returnShipped);
    } else if (state === trackingState.delivered) {
      // Outbound delivered opens the 72h review window
      // (plan-escrow-dispute.md §3). Fully idempotent: only RETURN_SHIPPED
      // may advance here — a redelivery arriving after COMPLETED, CANCELED,
      // or UNDER_MANUAL_REVIEW is a no-op (never regress status out of a
      // terminal/frozen queue), and payoutEligibleAt is only ever set when
      // absent so retries can never reset the 72h clock.
      if (contract.status !== contractStatus.returnShipped) {
        return;
      }
      const update = {
        status: contractStatus.deliveredToUser,
        $push: {
          timeline: {
            $each: [
              { event: contractEvent.returnDelivered, date: new Date() },
              { event: contractEvent.reviewWindowOpened, date: new Date() },
            ],
          },
        },
      };
      if (!contract.payoutEligibleAt) {
        update.payoutEligibleAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      }
      await contractRepository.updateById(contract._id, update);
    }
  }
};

export async function handleShippoWebhook(req, res, next) {
  try {
    let event;
    let data;
    try {
      ({ event, data } = shippingService.verifyShippoEvent(req.body));
    } catch (e) {
      return res.status(400).send(e.message);
    }

    if (event === "transaction_created" || event === "transaction_updated") {
      const found = await shippingRepository.findByShippoId(data.object_id);
      if (!found) {
        console.log(`[SHIPPING_HOOK] unknown transaction ${data.object_id}`);
        return res.sendStatus(200);
      }
      if (found.status === contractStatus.canceled) {
        return res.sendStatus(200);
      }
      // Backfill tracking/label if the purchase-time save missed them.
      const shipmentMatch =
        data.shipment === found.inboundShipmentId
          ? "inbound"
          : data.shipment === found.outboundShipmentId
            ? "outbound"
            : null;
      if (shipmentMatch && data.tracking_number) {
        const tracked = found[`${shipmentMatch}Tracking`] || {};
        if (!tracked.trackingNumber) {
          await shippingRepository.saveLabels(found._id, shipmentMatch, {
            shipmentId: data.shipment,
            transactionId: data.object_id,
            trackingNumber: data.tracking_number,
            carrier: data.rate?.provider || tracked.carrier || null,
            labelUrl: data.label_url || found[`${shipmentMatch}LabelUrl`] || null,
          });
        }
      }
      return res.sendStatus(200);
    }

    if (event === "track_updated") {
      const trackingNumber =
        data.tracking_number || data.trackingNumber || null;
      const found = await shippingRepository.findByTrackingNumber(trackingNumber);
      if (!found) {
        console.log(`[SHIPPING_HOOK] unknown tracking ${trackingNumber}`);
        return res.sendStatus(200);
      }
      await applyTrackUpdate(
        found.contract,
        found.leg,
        data.tracking_status?.status || data.tracking_status || data.status
      );
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error handling Shippo webhook:", error);
    next(error);
  }
}
