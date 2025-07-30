import mongoose, { Schema } from 'mongoose';
import { IComment } from '../types';
import { logger } from '../utils/logger';

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      minlength: [1, 'Comment cannot be empty']
    },
    issueId: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue ID is required']
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret: any) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

//Indexes for better performance
commentSchema.index({ issueId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });

// Static method to get comments for an issue with pagination
commentSchema.statics.getCommentsForIssue = function(
  issueId: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;
  
  return Promise.all([
    this.find({ issueId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ issueId })
  ]);
};

//Post middleware to update issue's comments array when comment is created
commentSchema.post('save', async function() {
  try {
    await mongoose.model('Issue').findByIdAndUpdate(
      this.issueId,
      { $addToSet: { comments: this._id } }
    );
  } catch (error) {
    logger.error('Error updating issue comments array:', error);
  }
});

//Post middleware to remove comment from issue's comments array when comment is deleted

//Pre-remove middleware to clean up associated comments and files
commentSchema.pre('deleteOne', { document: true }, async function() {
  try {
    // Remove all comments associated with this issue
    await mongoose.model('Issue').deleteMany({ issueId: this._id });
    
    // Remove all files associated with this issue
  } catch (error) {
    logger.error('Error cleaning up issue dependencies:', error);
  }
});

export const Comment = mongoose.model<IComment>('Comment', commentSchema);