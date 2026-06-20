import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { PharmacistService, ChatMessage } from "./pharmacist.service";

class PharmacistChatDto {
  message!: string;
  conversationHistory?: ChatMessage[];
}

@Controller("pharmacist")
export class PharmacistController {
  constructor(private readonly pharmacistService: PharmacistService) {}

  @Post("chat")
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: PharmacistChatDto): Promise<{ reply: string }> {
    const reply = await this.pharmacistService.chat(
      body.message,
      body.conversationHistory ?? [],
    );
    return { reply };
  }
}
