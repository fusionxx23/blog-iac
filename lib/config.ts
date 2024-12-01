const path = require("path");
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export type ConfigProps = {
  DEST_BUCKET_NAME: string;
};

export const getConfig = (): ConfigProps => ({
  DEST_BUCKET_NAME: process.env.DEST_BUCKET_NAME as string,
});
