import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.warn(
    "R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId ?? "",
    secretAccessKey: secretAccessKey ?? "",
  },
});

const PRESIGN_EXPIRY = 3600; // 1 hour

export async function getPresignedPutUrl(
  key: string,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function getPresignedGetUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function createMultipartUpload(key: string): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
  });
  const result = await s3Client.send(command);
  if (!result.UploadId) throw new Error("Failed to create multipart upload");
  return result.UploadId;
}

export async function getPresignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export interface PartInfo {
  partNumber: number;
  etag: string;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: PartInfo[]
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
    },
  });
  await s3Client.send(command);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
  });
  await s3Client.send(command);
}

export async function listParts(
  key: string,
  uploadId: string
): Promise<PartInfo[]> {
  const command = new ListPartsCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
  });
  const result = await s3Client.send(command);
  return (result.Parts ?? []).map((p) => ({
    partNumber: p.PartNumber!,
    etag: p.ETag!,
  }));
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await s3Client.send(command);
}

export { bucketName };
