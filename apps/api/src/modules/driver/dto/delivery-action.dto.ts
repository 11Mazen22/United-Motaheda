import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class AcceptOrderDto {
  // Optional: driver confirms they are at the right location when accepting
  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;
}

export class RejectOrderDto {
  @IsOptional()
  @IsString()
  reason?: string; // Optional rejection reason
}

export class ArrivedPharmacyDto {
  @IsNumber()
  currentLat: number;

  @IsNumber()
  currentLng: number;
}

export class PickedUpDto {
  @IsOptional()
  @IsString()
  notes?: string; // Any pickup notes
}

export class ArrivedCustomerDto {
  @IsNumber()
  currentLat: number;

  @IsNumber()
  currentLng: number;
}

export class CompleteDeliveryDto {
  @IsString()
  proofPhotoUrl: string; // Uploaded proof photo URL

  @IsOptional()
  @IsString()
  customerSignature?: string; // Base64 signature

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  customerRating?: number;

  @IsOptional()
  @IsString()
  customerFeedback?: string;
}
