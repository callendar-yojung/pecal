// S3 클라이언트 (lazy initialization with dynamic import)
// biome-ignore lint/suspicious/noExplicitAny: Dynamic import를 위해 any 사용
let s3ClientInstance: any = null;

async function getS3Client() {
  if (!s3ClientInstance) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3ClientInstance = new S3Client({
      region: process.env.AWS_REGION || "ap-northeast-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3ClientInstance;
}

// S3 사용 가능 여부 체크
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
}

/**
 * 파일을 S3에 업로드
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucketName = process.env.AWS_S3_BUCKET || "";
  const region = process.env.AWS_REGION || "ap-northeast-2";

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  const client = await getS3Client();
  await client.send(command);

  // 공개 URL 반환 (CloudFront 또는 S3 직접 URL)
  const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (cloudFrontDomain) {
    return `https://${cloudFrontDomain}/${key}`;
  }

  // S3 직접 URL
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * S3에서 파일 삭제
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!isS3Configured()) {
    return; // S3가 설정되지 않았으면 무시
  }

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const bucketName = process.env.AWS_S3_BUCKET || "";

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const client = await getS3Client();
  await client.send(command);
}

/**
 * S3 key 생성 (uploads/personal/{ownerId}/{storedName} 형식)
 */
export function generateS3Key(
  ownerType: "team" | "personal",
  ownerId: number,
  storedName: string
): string {
  const folder = ownerType === "team" ? "teams" : "personal";
  return `uploads/${folder}/${ownerId}/${storedName}`;
}

/**
 * URL에서 S3 key 추출
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // CloudFront 또는 S3 URL에서 path 추출
    const path = urlObj.pathname;
    // 앞의 / 제거
    return path.startsWith("/") ? path.slice(1) : path;
  } catch {
    // 로컬 경로인 경우 (예: /uploads/personal/3/xxx.png)
    if (url.startsWith("/uploads/")) {
      return url.slice(1); // 앞의 / 제거
    }
    return null;
  }
}
