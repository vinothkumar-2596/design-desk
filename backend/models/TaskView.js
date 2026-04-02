import mongoose from "mongoose";

const TaskViewSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: "" },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TaskViewSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskViewSchema.index({ userId: 1, readAt: -1 });

TaskViewSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export default mongoose.model("TaskView", TaskViewSchema);
