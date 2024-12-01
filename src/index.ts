import type { S3Event, Context, Callback } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client({});

export const lambdaHandler = async (
  event: S3Event,
  _: Context,
  callback: Callback,
): Promise<void> => {
  console.log("S3 Event received:", JSON.stringify(event));
  const destBucket = process.env.DEST_BUCKET;
  console.log(destBucket);
  try {
    // Extract bucket name and object key from the event
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
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
      const outputBuffer150 = await sharp(image).resize(150).toBuffer();

      const outputBuffer800 = await sharp(image).resize(800).toBuffer();
      // store new image in the destination bucket

      const keyId = objectKey.split(".")[0];
      const ext = objectKey.split(".")[1];
      await s3Client.send(
        new PutObjectCommand({
          Bucket: destBucket,
          Key: `${keyId}_150x.${ext}`,
          Body: outputBuffer150,
          ContentType: objectData.ContentType,
        }),
      );

      await s3Client.send(
        new PutObjectCommand({
          Bucket: destBucket,
          Key: `${keyId}_800x.${ext}`,
          Body: outputBuffer800,
          ContentType: objectData.ContentType,
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
