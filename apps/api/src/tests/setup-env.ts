import path from "path";
import dotenv from "dotenv";

// Tests need the same environment resolution as the API runtime.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
