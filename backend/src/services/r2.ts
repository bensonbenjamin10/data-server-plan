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
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

const R2_CONFIGURED =
  !!(accountId && accessKeyId && secretAccessKey && bucketName);

if (!R2_CONFIGURED) {
  console.warn(
    "[R2] Credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
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

/** Verify R2 connection and bucket access. Call at startup. */
export async function checkR2Connection(): Promise<{
  ok: boolean;
  bucket: string;
  endpoint: string;
  error?: string;
}> {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  if (!R2_CONFIGURED) {
    return { ok: false, bucket: bucketName ?? "?", endpoint, error: "R2 credentials not configured" };
  }
  try {
    await s3Client.send(
      new HeadBucketCommand({ Bucket: bucketName })
    );
    console.log(`[R2] Connection OK: bucket=${bucketName} endpoint=${endpoint}`);
    return { ok: true, bucket: bucketName!, endpoint };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[R2] Connection failed:`, msg);
    return { ok: false, bucket: bucketName!, endpoint, error: msg };
  }
}

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
  const url = await getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
  console.log(`[R2] Presigned PUT generated key=${key}`);
  return url;
}

export async function getPresignedGetUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
  console.log(`[R2] Presigned GET generated key=${key}`);
  return url;
}

export async function createMultipartUpload(key: string): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
  });
  const result = await s3Client.send(command);
  if (!result.UploadId) throw new Error("Failed to create multipart upload");
  console.log(`[R2] Multipart upload created key=${key} uploadId=${result.UploadId}`);
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
  console.log(`[R2] Multipart upload completed key=${key}`);
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
