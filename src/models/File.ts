import mongoose, { Schema } from 'mongoose';
import { IFile } from '../types';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Generic factory pattern for File model
const fileSchema = new Schema<IFile>(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true
    },
    mimetype: {
      type: String,
      required: [true, 'File mimetype is required']
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative']
    },
    path: {
      type: String,
      required: [true, 'File path is required']
    },
    issueId: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue ID is required']
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by user ID is required']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false, // We're using uploadedAt instead
    toJSON: {
      virtuals: true,
      transform: function(doc, ret: any) {
        delete ret.__v;
        delete ret.path; // Don't expose file system path
        return ret;
      }
    }
  }
);

//Indexes for better performance
fileSchema.index({ issueId: 1, uploadedAt: -1 });
fileSchema.index({ uploadedBy: 1 });

//Virtual for file extension
fileSchema.virtual('extension').get(function() {
  return path.extname(this.originalName).toLowerCase();
});

//Virtual for human-readable file size
fileSchema.virtual('sizeFormatted').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

//Static method to get files for an issue
fileSchema.statics.getFilesForIssue = function(issueId: string) {
  return this.find({ issueId })
    .populate('uploadedBy', 'firstName lastName email')
    .sort({ uploadedAt: -1 })
    .lean();
};

//Method to check if file exists on disk
fileSchema.methods.fileExists = function(): boolean {
  try {
    return fs.existsSync(this.path);
  } catch (error) {
    return false;
  }
};

//Method to delete file from disk
fileSchema.methods.deleteFromDisk = function(): boolean {
  try {
    if (this.fileExists()) {
      fs.unlinkSync(this.path);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting file from disk:', error);
    return false;
  }
};

//Post middleware to update issue's files array when file is created
fileSchema.post('save', async function() {
  try {
    await mongoose.model('Issue').findByIdAndUpdate(
      this.issueId,
      { $addToSet: { files: this._id } }
    );
  } catch (error) {
    logger.error('Error updating issue files array:', error);
  }
});

//Pre middleware to delete file from disk when document is deleted
fileSchema.pre('deleteOne', { document: true }, function(this: IFile) {
  this.deleteFromDisk();
});

// Pre middleware for findOneAndDelete
fileSchema.pre('findOneAndDelete', async function() {
  try {
    const file = await this.model.findOne(this.getQuery()) as IFile;
    if (file && file.fileExists()) {
      file.deleteFromDisk();
    }
  } catch (error) {
    logger.error('Error deleting file from disk:', error);
  }
});

//Pre-remove middleware to clean up associated comments and files
fileSchema.pre('deleteOne', { document: true }, async function() {
  try {
    // Remove all comments associated with this issue
    await mongoose.model('Comment').deleteMany({ issueId: this._id });
    
    // Remove all files associated with this issue
    const files = await mongoose.model('Issue').find({ issueId: this._id });
    for (const file of files) {
      // Delete file from disk and database
      await file.deleteOne();
    }
  } catch (error) {
    logger.error('Error cleaning up issue dependencies:', error);
  }
});


//Post middleware for findOneAndDelete
fileSchema.post('findOneAndDelete', async function(doc: IFile | null) {
  try {
    if (doc) {
      await mongoose.model('Issue').findByIdAndUpdate(
        doc.issueId,
        { $pull: { files: doc._id } }
      );
    }
  } catch (error) {
    logger.error('Error removing file from issue files array:', error);
  }
});

export const File = mongoose.model<IFile>('File', fileSchema);