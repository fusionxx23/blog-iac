import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { getConfig } from "./config";

export class PortfolioIacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const config = getConfig();

    const destinationBucket = new s3.Bucket(this, "DestinationBucket", {
      bucketName: config.DEST_BUCKET_NAME,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const uploadBucket = new s3.Bucket(this, "uploadBucket", {
      bucketName: config.UPLOAD_BUCKET_NAME,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const resizeImageLambda = new NodejsFunction(this, "ResizeImages", {
      handler: "handler",
      entry: "./src/index.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.X86_64,
      timeout: cdk.Duration.seconds(12),
      // Sharp is os and architecture dependent
      // Ensure correct version is installed
      bundling: {
        nodeModules: ["sharp"],
        forceDockerBundling: true,
      },
      environment: {
        DEST_BUCKET: config.DEST_BUCKET_NAME,
      },
    });
    uploadBucket.grantRead(resizeImageLambda);
    uploadBucket.grantDelete(resizeImageLambda);
    destinationBucket.grantWrite(resizeImageLambda);

    new Distribution(this, "BlogImageCache", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(destinationBucket),
      },
    });

    const s3PutEventSource = new eventSources.S3EventSource(uploadBucket, {
      events: [s3.EventType.OBJECT_CREATED],
    });

    resizeImageLambda.addEventSource(s3PutEventSource);
  }
}
