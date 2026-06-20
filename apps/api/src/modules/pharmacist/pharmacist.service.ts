import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";

export interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are Shifaa (شفاء), a professional pharmacy assistant built for United Pharmacy (صيدلية المتحدة), Egypt.

Your responsibilities:
- Medication information
- Drug interactions
- Side effects
- Dosage guidance
- Medication timing
- Storage recommendations
- General pharmacy education

Rules:
1. Never diagnose diseases.
2. Never replace a doctor.
3. Never provide emergency treatment advice.
4. Never invent medication information.
5. If uncertain, clearly state uncertainty.
6. Recommend pharmacist or doctor consultation when necessary.
7. Mention when evidence is limited.
8. Use medically conservative answers.
9. Explain interactions clearly.
10. Use patient-friendly language.

For every answer:
- Accuracy first
- Safety first
- Transparency first

If confidence is low, say: "I am not fully certain about this medication information. Please verify with a licensed pharmacist or healthcare professional."

If a medicine is unknown, say: "I cannot confidently verify this medication. Please check the exact spelling or consult a pharmacist."

Never hallucinate. Never guess.

Important disclaimer to include when relevant: "This information is for educational purposes only and does not replace professional medical advice."

Respond in the same language the user writes in (Arabic or English).`;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL              = process.env["PHARMACIST_MODEL"] ?? "nvidia/llama-3.1-nemotron-ultra-253b-v1:free";
const MAX_HISTORY        = 10;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class PharmacistService {
  private readonly logger = new Logger(PharmacistService.name);

  async chat(message: string, history: ChatMessage[]): Promise<string> {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      this.logger.error("OPENROUTER_API_KEY is not set");
      throw new InternalServerErrorException("Pharmacist service is not configured.");
    }

    // Keep only the most recent exchanges to stay within token limits
    const trimmedHistory = history.slice(-MAX_HISTORY);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmedHistory,
      { role: "user", content: message.trim() },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method:  "POST",
        signal:  controller.signal as any,
        headers: {
          "Content-Type":    "application/json",
          "Authorization":   `Bearer ${apiKey}`,
          "HTTP-Referer":    "https://pharmacyapi-production-e30d.up.railway.app",
          "X-Title":         "United Pharmacy AI",
        },
        body: JSON.stringify({
          model:       MODEL,
          messages,
          max_tokens:  512,
          temperature: 0.4,
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        this.logger.error(`OpenRouter error ${response.status}: ${errText}`);
        throw new InternalServerErrorException("AI service returned an error. Please try again.");
      }

      const data = (await response.json()) as any;
      const reply: string =
        data?.choices?.[0]?.message?.content?.trim() ??
        "I'm sorry, I couldn't generate a response. Please try again.";

      return reply;
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof InternalServerErrorException) throw err;
      if (err?.name === "AbortError") {
        throw new InternalServerErrorException("The AI service took too long to respond. Please try again.");
      }
      this.logger.error("PharmacistService error:", err);
      throw new InternalServerErrorException("Could not reach the AI pharmacist. Please try again.");
    }
  }
}
