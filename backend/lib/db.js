import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const mongoUri = String(process.env.MONGODB_URI || "").trim();

        if (!mongoUri) {
            throw new Error(
                "Missing MONGODB_URI. Create backend/.env from backend/.env.example and set your MongoDB connection string."
            );
        }

        await mongoose.connect(mongoUri, {
            dbName: "designhub",
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 45000,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
        });
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;
