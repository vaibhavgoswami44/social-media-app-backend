import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.URI;
const connectToMongo = () => {
  mongoose
    .connect(uri)
    .then(console.log("\nConnected To Database"))
    .catch((err) => console.log(err));
};

export default connectToMongo;
