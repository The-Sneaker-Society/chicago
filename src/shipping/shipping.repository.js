import ContractModel from "../models/Contract.model.js";
import { contractEvent } from "../contracts/contract.constants.js";

/**
 * Thin persistence for the shipping domain. Owns no business rules —
 * all validation/pricing lives in shipping.service.js. Cross-domain reads
 * go through the owning repositories (AGENTS.md).
 */
export const shippingRepository = {
  /**
   * Finds a contract by Shippo shipment or transaction id
   * (for transaction_created/updated webhooks, which carry object_id).
   */
  async findByShippoId(id) {
    if (!id) return null;
    return await ContractModel.findOne({
      $or: [
        { inboundShipmentId: id },
        { outboundShipmentId: id },
        { inboundTransactionId: id },
        { outboundTransactionId: id },
      ],
    });
  },

  /**
   * Finds a contract by carrier tracking number (for track_updated
   * webhooks, which carry only tracking_number + carrier).
   * Returns { contract, leg } so the webhook can apply the leg matrix.
   */
  async findByTrackingNumber(number) {
    if (!number) return null;
    const contract = await ContractModel.findOne({
      $or: [
        { "inboundTracking.trackingNumber": number },
        { "outboundTracking.trackingNumber": number },
      ],
    });
    if (!contract) return null;
    const leg =
      contract?.inboundTracking?.trackingNumber === number
        ? "inbound"
        : "outbound";
    return { contract, leg };
  },

  /**
   * Persists a purchased label onto the contract and records the
   * INBOUND/OUTBOUND_LABEL_GENERATED timeline event.
   */
  async saveLabels(contractId, leg, label) {
    const prefix = leg === "inbound" ? "inbound" : "outbound";
    const event =
      leg === "inbound"
        ? contractEvent.inboundLabelGenerated
        : contractEvent.outboundLabelGenerated;
    return await ContractModel.findByIdAndUpdate(contractId, {
      [`${prefix}ShipmentId`]: label.shipmentId,
      [`${prefix}TransactionId`]: label.transactionId,
      [`${prefix}LabelUrl`]: label.labelUrl,
      [`${prefix}Tracking`]: {
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
      },
      $push: { timeline: { event, date: new Date() } },
    });
  },

  async pushTimeline(contractId, event) {
    return await ContractModel.findByIdAndUpdate(contractId, {
      $push: { timeline: { event, date: new Date() } },
    });
  },

  async saveAddressSnapshot(contractId, snapshot, addressMismatch) {
    return await ContractModel.findByIdAndUpdate(contractId, {
      addressSnapshot: snapshot,
      addressMismatch,
    });
  },
};
