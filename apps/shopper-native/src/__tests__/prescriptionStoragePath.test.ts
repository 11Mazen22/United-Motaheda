import {
  normalizePrescriptionStoragePath,
  PRESCRIPTION_IMAGE_BUCKET,
} from "../../../../packages/domain-prescriptions/src/storagePath";

describe("prescription storage paths", () => {
  it("uses the canonical private bucket", () => {
    expect(PRESCRIPTION_IMAGE_BUCKET).toBe("prescriptions");
  });

  it.each([
    ["user-id/rx-id/image.jpg", "user-id/rx-id/image.jpg"],
    ["/user-id/rx-id/image.png", "user-id/rx-id/image.png"],
    ["prescriptions/user-id/rx-id/image.webp", "user-id/rx-id/image.webp"],
    [
      "https://example.supabase.co/storage/v1/object/public/prescriptions/user-id/rx-id/image.jpg",
      "user-id/rx-id/image.jpg",
    ],
    [
      "https://example.supabase.co/storage/v1/object/sign/prescriptions/user-id/rx-id/image%20one.jpg?token=secret",
      "user-id/rx-id/image one.jpg",
    ],
    [
      "https://example.supabase.co/storage/v1/object/authenticated/prescriptions/user-id/rx-id/image.jpg",
      "user-id/rx-id/image.jpg",
    ],
  ])("normalizes %s", (raw, expected) => {
    expect(normalizePrescriptionStoragePath(raw)).toBe(expected);
  });

  it.each([
    "",
    "https://example.com/not-the-prescription-bucket/image.jpg",
    "../private/image.jpg",
    "user-id/../image.jpg",
    "user-id\\rx-id\\image.jpg",
    "user-id//image.jpg",
  ])("rejects unsafe or unusable path %s", (raw) => {
    expect(normalizePrescriptionStoragePath(raw)).toBe("");
  });
});
