import mongoose, { Schema } from 'mongoose';
import { IIssue } from '../types';
import { logger } from '../utils/logger';

// Generic factory patter for Issue model
const issueSchema = new Schema<IIssue>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'complete'],
      default: 'pending',
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      required: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    },
    comments: [{
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    }],
    files: [{
      type: Schema.Types.ObjectId,
      ref: 'File'
    }]
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
issueSchema.index({ status: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ createdBy: 1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ title: 'text', description: 'text' });

//Virtual for comment count
issueSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

//Virtual for file count
issueSchema.virtual('fileCount').get(function() {
  return this.files ? this.files.length : 0;
});

//Static method to get issues with pagination
issueSchema.statics.getPaginatedIssues = function(
  filter: any = {},
  page: number = 1,
  limit: number = 20,
  sort: any = { createdAt: -1 }
) {
  const skip = (page - 1) * limit;
  
  return Promise.all([
    this.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);
};

//Pre-remove middleware to clean up associated comments and files
issueSchema.pre('deleteOne', { document: true }, async function() {
  try {
    // Remove all comments associated with this issue
    await mongoose.model('Comment').deleteMany({ issueId: this._id });
    
    // Remove all files associated with this issue
    const files = await mongoose.model('File').find({ issueId: this._id });
    for (const file of files) {
      // Delete file from disk and database
      await file.deleteOne();
    }
  } catch (error) {
    logger.error('Error cleaning up issue dependencies:', error);
  }
});

//Pre-remove middleware for findOneAndDelete
issueSchema.pre('findOneAndDelete', async function() {
  try {
    const issue = await this.model.findOne(this.getQuery());
    if (issue) {
      // Remove all comments associated with this issue
      await mongoose.model('Comment').deleteMany({ issueId: issue._id });
      
      // Remove all files associated with this issue
      const files = await mongoose.model('File').find({ issueId: issue._id });
      for (const file of files) {
        await file.deleteOne();
      }
    }
  } catch (error) {
    logger.error('Error cleaning up issue dependencies:', error);
  }
});

//Instance method to add comment
issueSchema.methods.addComment = function(commentId: mongoose.Types.ObjectId) {
  if (!this.comments.includes(commentId)) {
    this.comments.push(commentId);
    return this.save();
  }
  return Promise.resolve(this);
};

//Instance method to remove comment
issueSchema.methods.removeComment = function(commentId: mongoose.Types.ObjectId) {
  this.comments = this.comments.filter((id: mongoose.Types.ObjectId) => !id.equals(commentId));
  return this.save();
};

//Instance method to add file
issueSchema.methods.addFile = function(fileId: mongoose.Types.ObjectId) {
  if (!this.files.includes(fileId)) {
    this.files.push(fileId);
    return this.save();
  }
  return Promise.resolve(this);
};

//Instance method to remove file
issueSchema.methods.removeFile = function(fileId: mongoose.Types.ObjectId) {
  this.files = this.files.filter((id: mongoose.Types.ObjectId) => !id.equals(fileId));
  return this.save();
};

export const Issue = mongoose.model<IIssue>('Issue', issueSchema);