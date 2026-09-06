import { handleShippoWebhook } from "../shipping.webhook.js";
import { shippingService } from "../shipping.service.js";
import { shippingRepository } from "../shipping.repository.js";
import { contractRepository } from "../../contracts/contract.repository.js";
import { contractStatus } from "../../contracts/contract.constants.js";

jest.mock("../shipping.service.js");
jest.mock("../shipping.repository.js");
jest.mock("../../contracts/contract.repository.js");

describe("handleShippoWebhook cancellation guards", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      sendStatus: jest.fn(),
    };
  });

  it("ignores transaction_created/updated if contract is CANCELED", async () => {
    shippingService.verifyShippoEvent.mockReturnValue({
      event: "transaction_created",
      data: {
        object_id: "tx_123",
        shipment: "shp_123",
        tracking_number: "TRK123",
      },
    });

    shippingRepository.findByShippoId.mockResolvedValue({
      _id: "c_canceled",
      status: contractStatus.canceled,
      inboundShipmentId: "shp_123",
    });

    req = { body: {} };

    await handleShippoWebhook(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(shippingRepository.saveLabels).not.toHaveBeenCalled();
  });

  it("ignores track_updated if contract is CANCELED", async () => {
    shippingService.verifyShippoEvent.mockReturnValue({
      event: "track_updated",
      data: {
        tracking_number: "TRK999",
        tracking_status: { status: "TRANSIT" },
      },
    });

    shippingRepository.findByTrackingNumber.mockResolvedValue({
      contract: {
        _id: "c_canceled",
        status: contractStatus.canceled,
      },
      leg: "inbound",
    });

    shippingService.normalizeTrackingStatus.mockReturnValue("IN_TRANSIT");

    req = { body: {} };

    await handleShippoWebhook(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(contractRepository.updateById).not.toHaveBeenCalled();
  });

  it("does not regress UNDER_MANUAL_REVIEW on outbound redelivery", async () => {
    shippingService.verifyShippoEvent.mockReturnValue({
      event: "track_updated",
      data: {
        tracking_number: "TRK456",
        tracking_status: { status: "DELIVERED" },
      },
    });

    shippingRepository.findByTrackingNumber.mockResolvedValue({
      contract: {
        _id: "c_frozen",
        status: contractStatus.underManualReview,
        payoutEligibleAt: new Date(),
      },
      leg: "outbound",
    });

    shippingService.normalizeTrackingStatus.mockReturnValue("delivered");

    req = { body: {} };

    await handleShippoWebhook(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(contractRepository.updateById).not.toHaveBeenCalled();
  });

  it("advances RETURN_SHIPPED to DELIVERED_TO_USER on outbound delivery", async () => {
    shippingService.verifyShippoEvent.mockReturnValue({
      event: "track_updated",
      data: {
        tracking_number: "TRK789",
        tracking_status: { status: "DELIVERED" },
      },
    });

    shippingRepository.findByTrackingNumber.mockResolvedValue({
      contract: {
        _id: "c_return",
        status: contractStatus.returnShipped,
      },
      leg: "outbound",
    });

    shippingService.normalizeTrackingStatus.mockReturnValue("delivered");
    contractRepository.updateById.mockResolvedValue({});

    req = { body: {} };

    await handleShippoWebhook(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(contractRepository.updateById).toHaveBeenCalledWith(
      "c_return",
      expect.objectContaining({ status: contractStatus.deliveredToUser })
    );
  });
});
