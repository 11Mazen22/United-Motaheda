import { Body, Controller, Headers, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { PromotionCopilotService } from "./promotion-copilot.service";

@Controller("admin/promotion-copilot")
export class PromotionCopilotController {
  constructor(private readonly promotionCopilot: PromotionCopilotService) {}

  /**
   * Produces an editable promotion proposal only. This endpoint deliberately
   * has no write capability; the staff member must review and save the draft
   * through the existing promotion workflow.
   */
  @Post("propose")
  async propose(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cancellation = new AbortController();
    const cancelDisconnectedRequest = () => {
      if (!response.writableEnded) cancellation.abort(new Error("Client disconnected"));
    };
    request.once("aborted", cancelDisconnectedRequest);
    response.once("close", cancelDisconnectedRequest);

    try {
      return await this.promotionCopilot.propose(authorization, body, {
        requestId,
        signal: cancellation.signal,
      });
    } finally {
      request.off("aborted", cancelDisconnectedRequest);
      response.off("close", cancelDisconnectedRequest);
    }
  }
}
