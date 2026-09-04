import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiResponseInterceptor } from "./common/api-response.interceptor";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { RateLimitMiddleware } from "./common/rate-limit.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Explicit CORS — Railway's proxy drops the header when cors:true is passed
  // to NestFactory.create, so we call enableCors() instead which attaches a
  // proper Express middleware that handles OPTIONS preflight correctly.
  app.enableCors({
    origin: [
      "https://unitedpharmacy.net",
      "https://www.unitedpharmacy.net",
      "https://unitedpharmacy.io",
      "https://www.unitedpharmacy.io",
      // Allow all localhost ports for local development
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-request-id"],
    credentials: true,
    // Cache preflight response for 24 hours to reduce OPTIONS round-trips
    maxAge: 86400,
  });

  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(new RateLimitMiddleware().use.bind(new RateLimitMiddleware()));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

