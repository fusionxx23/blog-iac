import type { S3Event, Context, Callback } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client({});

export const handler = async (
  event: S3Event,
  _: Context,
  callback: Callback,
): Promise<void> => {
  console.log("S3 Event received:", JSON.stringify(event));
  const destBucket = process.env.DEST_BUCKET;
  try {
    // Extract bucket name and object key from the event
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    // Grab file name
    const objectKey = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " "),
    );

    console.log(`Bucket: ${bucketName}, Key: ${objectKey}`);

    // Get the object from S3 (optional: add processing logic here)
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const objectData = await s3Client.send(getObjectCommand);

    try {
      const image = await objectData.Body?.transformToByteArray();
      // resize image
      const outputBuffer150 = await sharp(image)
        .resize(150)
        .webp({ quality: 75 })
        .toBuffer();

      const outputBuffer800 = await sharp(image)
        .resize(800)
        .webp({ quality: 75 })
        .toBuffer();
      // store new image in the destination bucket

      const keyId = objectKey.split(".")[0];
      // const ext = objectKey.split(".")[1];
      await s3Client.send(
        new PutObjectCommand({
          Bucket: destBucket,
          Key: `${keyId}_150x.webp`,
          Body: outputBuffer150,
          ContentType: objectData.ContentType,
        }),
      );

      await s3Client.send(
        new PutObjectCommand({
          Bucket: destBucket,
          Key: `${keyId}_800x.webp`,
          Body: outputBuffer800,
          ContentType: objectData.ContentType,
        }),
      );
      // Delete image after processing
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: event.Records[0].s3.bucket.name,
          Key: objectKey,
        }),
      );
      callback(null, `Successfully uploaded object: ${objectKey}`);
    } catch (error) {
      console.log(error);
    }
    console.log(`Object retrieved: ${objectData.ContentLength} bytes`);
    callback(null, `Successfully processed object: ${objectKey}`);
  } catch (error) {
    console.error("Error processing S3 event:", error);
    callback(error as unknown as string);
  }
};
